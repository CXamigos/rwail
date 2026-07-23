const fs = require('fs').promises;
const net = require('net');
const path = require('path');
const tls = require('tls');
const WebSocket = require('ws');
let { parentPort, workerData } = require('worker_threads');

function normalize_worker_config(workerData) {
    if (Array.isArray(workerData)) {
        return {
            user_agent: workerData[0],
            proxy: workerData[1],
            server_code: workerData[2],
            upgrade_data: workerData[3],
            bot_name: workerData[4],
            bot_pathfind: workerData[5],
            followbot_config: workerData[6],
            writer: workerData[7],
            options: workerData[8] || {}
        };
    }
    return workerData || {};
}

let {
    user_agent,
    proxy = "",
    server_code,
    upgrade_data = {},
    bot_name,
    bot_pathfind = false,
    followbot_config = {},
    writer = 0,
    mode = "followbot",
    observer_snapshot_interval = 150,
    options = {}
} = normalize_worker_config(workerData);

const INITIAL_SERVER_PACKET = Uint8Array.from(Buffer.from("00010001ffa47515f98112ce", "hex"));
const HANDSHAKE_B = Buffer.from(INITIAL_SERVER_PACKET.subarray(4)).reverse().toString("hex");
const default_user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
const party_code_pattern = "(?:\\d{4,6}|[a-z0-9]{32,128})";
const party_code_regex = new RegExp(`\\b(${party_code_pattern})\\b`, "i");
const party_code_exact_regex = new RegExp(`^${party_code_pattern}$`, "i");

options = options || {};
if (options.mode && mode === "followbot") mode = options.mode;
const observer_mode = mode === "observer";
const teamlink_mode = mode === "teamlink";
const upgrade_mapper_mode = mode === "upgrade_mapper";
const normal_bot_mode = !observer_mode && !teamlink_mode && !upgrade_mapper_mode;
const debug_mode = !!options.debug;
const SHOOTING_MOVE_FLAG = 16;
const mapper_path = Array.isArray(options.mapper_path)
    ? options.mapper_path.map(value => Number.parseInt(value, 10)).filter(value => Number.isFinite(value) && value >= 0 && value <= 255)
    : [];
const mapper_stable_ms = Math.max(100, Number.isFinite(options.mapper_stable_ms) ? options.mapper_stable_ms : 450);
const mapper_step_timeout_ms = Math.max(1000, Number.isFinite(options.mapper_step_timeout_ms) ? options.mapper_step_timeout_ms : 7000);
const mapper_total_timeout_ms = Math.max(5000, Number.isFinite(options.mapper_total_timeout_ms) ? options.mapper_total_timeout_ms : 45000);
const mapper_name_timeout_ms = Math.max(500, Number.isFinite(options.mapper_name_timeout_ms) ? options.mapper_name_timeout_ms : 4000);
let teamlink_sent = false;
let stop_requested = false;
let pending_teamlink_code = null;
let pending_teamlink_source = null;
let team_color = null;
let team_player_count = null;
let team_minimap_seen = false;
let team_minimap_ready = false;
let spawned_at = null;
const team_minimap_grace_ms = Number.isFinite(options.team_minimap_grace_ms) ? options.team_minimap_grace_ms : 1500;
const movement_interval_ms = Math.max(16, Number.isFinite(options.movement_interval_ms) ? options.movement_interval_ms : 100);
const upgrade_queue_check_interval_ms = Math.max(25, Math.min(movement_interval_ms, 100));
let sent_room_info = false;
let sent_spawned = false;
let bot_autofire_enabled = options.autofire_enabled !== false;
let bot_copy_shooting = options.copy_shooting === true;
let server_has_maze = false;
let pending_return_pathfinding = false;

if (!user_agent) user_agent = default_user_agent;
if (proxy == null) proxy = "";
if (bot_pathfind == null) bot_pathfind = false;
if (teamlink_mode && !bot_name) bot_name = "";

upgrade_data = Object.assign({
    tanks: [],
    stats: [],
    stat_targets: [],
    growth_extended_upgrades_order_to_max: [],
    pathfinding_facing_angle_offset: 0,
    autofire_forced: false
}, upgrade_data || {});
followbot_config = followbot_config || {};

if (bot_name == undefined) {
    bot_name = "";
    let chars = ` !"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_abcdefghijklmnopqrstuvwxyz{|}~`;
    let min_name_len = 5;
    let max_name_len = 24;
    let name_len = Math.floor(Math.random() * (max_name_len - min_name_len + 1)) + min_name_len;
    for (let char = 0; char < name_len; char++) bot_name += chars[Math.floor(Math.random() * chars.length)];
}

function escape_regexp(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function is_valid_party_code(value) {
    return party_code_exact_regex.test(String(value || "").trim());
}

function normalize_party_code(value, server) {
    if (!value) return null;
    let trimmed = String(value).trim();
    if (!trimmed) return null;
    try {
        if (/^https?:\/\//i.test(trimmed)) {
            let parsed = new URL(trimmed);
            if (parsed.hash.length > 1) trimmed = parsed.hash.slice(1);
        }
    } catch (_) {}
    if (trimmed.startsWith("#")) trimmed = trimmed.slice(1);
    if (server && trimmed.toLowerCase().startsWith(server.toLowerCase())) {
        trimmed = trimmed.slice(server.length);
        if (is_valid_party_code(trimmed)) return trimmed;
    }
    if (server) {
        let match = trimmed.match(new RegExp(`#${escape_regexp(server)}(${party_code_pattern})(?![a-z0-9])`, "i"));
        if (match && is_valid_party_code(match[1])) return match[1];
    }
    let match = trimmed.match(party_code_regex);
    return match && is_valid_party_code(match[1]) ? match[1] : null;
}

function extract_party_code_from_game_data(game_data, server) {
    if (!game_data) return null;
    let lowered = String(game_data).toLowerCase();
    let entries = String(game_data).split(",");
    for (let entry of entries) {
        let parts = entry.split("=");
        if (parts.length < 2) continue;
        let key = parts[0].trim().toLowerCase();
        let value = parts.slice(1).join("=").trim();
        if (key.includes("party") || key.includes("link") || key.includes("team") || key === "code") {
            let code = normalize_party_code(value, server);
            if (code) return code;
        }
    }
    if (server) {
        let match = String(game_data).match(new RegExp(`#${escape_regexp(server)}(${party_code_pattern})(?![a-z0-9])`, "i"));
        if (match && is_valid_party_code(match[1])) return match[1];
    }
    if (/(party|link|team|code)/.test(lowered)) {
        let match = String(game_data).match(party_code_regex);
        return match && is_valid_party_code(match[1]) ? match[1] : null;
    }
    return null;
}

function extract_party_code_from_text(text, server) {
    if (!text) return null;
    if (server) {
        let match = String(text).match(new RegExp(`#${escape_regexp(server)}(${party_code_pattern})(?![a-z0-9])`, "i"));
        if (match && is_valid_party_code(match[1])) return match[1];
    }
    let lowered = String(text).toLowerCase();
    if (!/(party|link|team|code)/.test(lowered)) return null;
    let match = String(text).match(party_code_regex);
    return match && is_valid_party_code(match[1]) ? match[1] : null;
}

function maybe_emit_teamlink() {
    if (!teamlink_mode || teamlink_sent) return;
    if (!pending_teamlink_code || !server_code) return;
    if (!Number.isFinite(team_color)) return;
    if (!team_minimap_seen || !Number.isFinite(team_player_count)) return;
    if (!team_minimap_ready) return;
    teamlink_sent = true;
    stop_requested = true;
    let link = `https://arras.io/#${server_code}${pending_teamlink_code}`;
    parentPort.postMessage({
        type: "teamlink",
        link,
        code: pending_teamlink_code,
        color: team_color,
        players: team_player_count,
        source: pending_teamlink_source
    });
}

function set_teamlink_code(code, source) {
    if (!teamlink_mode || !code) return;
    if (!is_valid_party_code(code)) return;
    pending_teamlink_code = code;
    pending_teamlink_source = source;
    maybe_emit_teamlink();
}

function emit_debug(event, value) {
    if (!teamlink_mode || !debug_mode) return;
    parentPort.postMessage({ type: "debug", event, value });
}

function emit_worker_error(message) {
    if (upgrade_mapper_mode) {
        parentPort.postMessage({ type: "upgrade_mapper_error", path: mapper_path, message });
    } else if (teamlink_mode) {
        parentPort.postMessage({ type: "error", message });
    } else {
        parentPort.postMessage([0, message]);
    }
}

function parse_game_data_fields(game_data) {
    let fields = {};
    if (!game_data) return fields;
    for (let entry of String(game_data).split(",")) {
        let parts = entry.split("=");
        if (!parts[0]) continue;
        let key = parts[0].trim();
        if (!key) continue;
        fields[key] = parts.slice(1).join("=").trim();
    }
    return fields;
}

// Normal fetch was having some errors if it failed, so figured I'd do this to prevent the process from crashing.
function safe_fetch(url, options = {}) {
    return fetch(url, options).catch(err => {
        return {
            ok: false,
            status: 0,
            json: async () => ({}),
            text: async () => "",
        };
    });
}

function normalizeServerSocketUrl(rawUrl) {
    let normalizedUrl = rawUrl;
    try {
        let parsedUrl = new URL(rawUrl);
        parsedUrl.searchParams.set("b", HANDSHAKE_B);
        parsedUrl.searchParams.set("t", Math.floor(Date.now() / 1000).toString());
        normalizedUrl = parsedUrl.toString();
    } catch (_) {}
    return normalizedUrl;
}

function parseProxyConfig(proxyString) {
    if (!proxyString) return null;

    if (proxyString.includes('://')) {
        const parsed = new URL(proxyString);
        return {
            host: parsed.hostname,
            port: Number(parsed.port),
            username: decodeURIComponent(parsed.username || ''),
            password: decodeURIComponent(parsed.password || ''),
        };
    }

    const [host, port, username = '', password = ''] = proxyString.split(':');
    return {
        host,
        port: Number(port),
        username,
        password,
    };
}

function createSocketReader(socket) {
    let buffered = Buffer.alloc(0);
    let pending = null;

    function tryFlush() {
        if (!pending || buffered.length < pending.bytes) return;
        const chunk = buffered.subarray(0, pending.bytes);
        buffered = buffered.subarray(pending.bytes);
        const resolve = pending.resolve;
        pending = null;
        resolve(chunk);
    }

    const onData = (chunk) => {
        buffered = Buffer.concat([buffered, chunk]);
        tryFlush();
    };

    socket.on('data', onData);

    function readBytes(bytes) {
        return new Promise((resolve, reject) => {
            if (pending) {
                reject(new Error('Concurrent SOCKS reads are not supported.'));
                return;
            }

            const onError = (error) => {
                socket.off('close', onClose);
                reject(error);
            };
            const onClose = () => {
                socket.off('error', onError);
                reject(new Error('SOCKS socket closed during handshake.'));
            };

            pending = {
                bytes,
                resolve: (value) => {
                    socket.off('error', onError);
                    socket.off('close', onClose);
                    resolve(value);
                },
            };

            socket.once('error', onError);
            socket.once('close', onClose);
            tryFlush();
        });
    }

    return {
        readBytes,
        cleanup() {
            socket.off('data', onData);
            buffered = Buffer.alloc(0);
            pending = null;
        }
    };
}

async function connectViaSocks5(destinationUrl, proxyString) {
    const proxyConfig = parseProxyConfig(proxyString);
    if (!proxyConfig) throw new Error('Missing proxy configuration.');

    const destination = new URL(destinationUrl);
    const destinationHost = destination.hostname;
    const destinationPort = Number(destination.port || (destination.protocol === 'wss:' ? 443 : 80));
    const socket = net.connect(proxyConfig.port, proxyConfig.host);

    await new Promise((resolve, reject) => {
        socket.once('connect', resolve);
        socket.once('error', reject);
    });

    const socketReader = createSocketReader(socket);
    const readBytes = socketReader.readBytes;

    try {
        const hasAuth = proxyConfig.username || proxyConfig.password;

        socket.write(Buffer.from([0x05, 0x01, hasAuth ? 0x02 : 0x00]));
        const methodResponse = await readBytes(2);
        if (methodResponse[0] !== 0x05) throw new Error('Invalid SOCKS version from proxy.');
        if (methodResponse[1] === 0xFF) throw new Error('SOCKS proxy rejected all auth methods.');

        if (hasAuth) {
            if (methodResponse[1] !== 0x02) throw new Error('SOCKS proxy did not accept username/password auth.');
            const username = Buffer.from(proxyConfig.username);
            const password = Buffer.from(proxyConfig.password);
            socket.write(Buffer.concat([
                Buffer.from([0x01, username.length]),
                username,
                Buffer.from([password.length]),
                password,
            ]));
            const authResponse = await readBytes(2);
            if (authResponse[1] !== 0x00) throw new Error('SOCKS proxy authentication failed.');
        } else if (methodResponse[1] !== 0x00) {
            throw new Error('SOCKS proxy requires authentication.');
        }

        const hostBuffer = Buffer.from(destinationHost);
        const connectRequest = Buffer.concat([
            Buffer.from([0x05, 0x01, 0x00, 0x03, hostBuffer.length]),
            hostBuffer,
            Buffer.from([(destinationPort >> 8) & 0xFF, destinationPort & 0xFF]),
        ]);
        socket.write(connectRequest);

        const responseHead = await readBytes(4);
        if (responseHead[1] !== 0x00) throw new Error(`SOCKS connect failed with code ${responseHead[1]}.`);

        let addressBytes = 0;
        if (responseHead[3] === 0x01) {
            addressBytes = 4;
        } else if (responseHead[3] === 0x04) {
            addressBytes = 16;
        } else if (responseHead[3] === 0x03) {
            addressBytes = (await readBytes(1))[0];
        } else {
            throw new Error('Unsupported SOCKS address type.');
        }

        await readBytes(addressBytes + 2);
        socketReader.cleanup();

        if (destination.protocol === 'wss:') {
            const secureSocket = tls.connect({
                socket,
                servername: destinationHost,
            });
            await new Promise((resolve, reject) => {
                secureSocket.once('secureConnect', resolve);
                secureSocket.once('error', reject);
            });
            return secureSocket;
        }

        return socket;
    } catch (error) {
        socketReader.cleanup();
        socket.destroy();
        throw error;
    }
}

function create_bot(url, proxy, connection_count) {
    (async () => {
        let [decode_packet, update_parser, broadcast_parser, mockup_parser, player_tab_parser, room_parser, maze_map_manager, yield_control_comps_from_angle, packet_constructors] = eval(await fs.readFile(path.resolve(__dirname, './wasm/protocol_utils.js'), "utf8"));
        // let [decode_entities, encode_entities] = eval(await fs.readFile(path.resolve(__dirname, './wasm/entity_parsing_utils.js'), "utf8"));
        let e = [],
            t = (t, r) => {
                e[t] = r
            },
            r = null,
            a = () => ((null == r || 0 === r.byteLength) && (r = u8 = new Uint8Array(f.e.buffer)),
                r),
            n = null,
            o = () => ((null == n || 0 === n.byteLength) && (n = new Int32Array(f.e.buffer)),
                n),
            s = null,
            i = () => ((null == s || 0 === s.byteLength) && (s = new Float64Array(f.e.buffer)),
                s),
            d = new TextEncoder("utf-8"),
            l = new TextDecoder("utf-8", {
                ignoreBOM: !0
            });
        l.decode();
        let c = /^[\x00-\x7f]*$/,
            u = (e, t) => {
                if (c.test(t)) {
                    let len = t ? (t.length ? t.length : 0) : 0;
                    let r = f.d(len, 1),
                        n = a();
                    for (let e = 0; e < len; e++)
                        n[r + e] = t.charCodeAt(e);
                    o().set([r, len], e >> 2)
                } else
                    y(e, d.encode(t))
            },
            p = (e, t) => {
                null != t && u(e, t)
            },
            y = (e, t) => {
                let r = f.d(t.length, 1);
                a().set(t, r),
                o().set([r, t.length], e >> 2)
            },
            h = (e, t) => {
                let r = f.d(t.length << 3, 8);
                i().set(t, r >> 3),
                    o().set([r, t.length], e >> 2)
            },
            m = [
                [(e, r, n) => {
                        // r = l.decode(a().subarray(r, r + n)),
                        t(e,
                            /* ( () => {
                                                let e = document.createElement("div");
                                                return e.id = r,
                                                document.body.appendChild(e),
                                                e
                                            }
                                            )() */
                            {})
                    }, (t, r) => {
                        y(t, (r = e[r]).shift())
                    }, (t, r) => {
                        //t = e[t],
                        //r >>>= 0,
                        //t.strokeStyle = `rgb(${r >> 16},${r >> 8 & 255},${255 & r})`
                    }, (t, r, a) => {
                        //(t = e[t]).moveTo(r, a)
                    }, () => {
                        /*let e = document.createElement("script");
                        e.defer = !0,
                        e.src = "https://static.cloudflareinsights.com/beacon.min.js",
                        e.setAttribute("data-cf-beacon", JSON.stringify({
                            token: "arras.io" === location.hostname.slice(-8) ? "ff5561cea47c47eaafe62003a2bb80fe" : "arrax.io" === location.hostname.slice(-8) ? "7ce137179299421288a5a93c26f71e2c" : "arras.netlify.app" === location.hostname.slice(-17) ? "73db2851ba12432c968cae9c6b385f3a" : "arras.cx" === location.hostname.slice(-8) ? "a5ebfa0ea9364b2ca5cddf829c28095e" : "1a3464390f784a2a800f401f1bfa6a30"
                        })),
                        document.body.appendChild(e)*/
                    }, t => /* (t = e[t]).readyState */ 1, () => true, (t, r, a, n, o, s) => {
                        /*t = e[t],
                        r = e[r],
                        t.drawImage(r, a, n, o, s)*/
                    }, t => {
                        //(t = e[t]).clip()
                    }, (e, r, n) => {
                        // r = l.decode(a().subarray(r, r + n)),
                        t(e,
                            /*( () => {
                                                let e = new Image;
                                                return e.src = r,
                                                e
                                            }
                                            )()*/
                            {})
                    }, t => /*!!((t = e[t]).captureStream && MediaRecorder && MediaRecorder.isTypeSupported("video/webm"))*/ true, (t, r, a, n) => {
                        //t = e[t],
                        //r >>>= 0,
                        //a >>>= 0,
                        //t.texParameteri(r, a, n)
                    }, e => {
                        /*t(e, e => {
                            (async () => navigator.clipboard.write([new ClipboardItem({
                                [e.type]: e
                            })]))().catch(e => alert("Failed to copy!"))
                        }
                        )*/
                    }, t => {
                        //(t = e[t]).id = "canvas",
                        //document.body.appendChild(t)
                    }, (t, r) => {
                        //(t = e[t]).lineWidth = r
                    }, (e, t, r, n) => {
                        // console.log(e = l.decode(a().subarray(e, e + t)), r = l.decode(a().subarray(r, r + n)))
                    }, e => {
                        t(e,
                            /*( () => {
                                                let e = [];
                                                try {
                                                    navigator.keyboard.getLayoutMap().then(t => {
                                                        e.push(Array.from(t).join("\n"))
                                                    }
                                                    ).catch(t => {
                                                        e.push("")
                                                    }
                                                    )
                                                } catch (t) {
                                                    e.push("")
                                                }
                                                return e
                                            }
                                            )()*/
                            [])
                    }, (t, r, a) => {
                        //t = e[t],
                        //r >>>= 0,
                        //a = e[a],
                        //t.bindTexture(r, a)
                    }, () => false, (t, r, n, o, s) => {
                        //t = e[t],
                        //r >>>= 0,
                        //n = a().subarray(n, n + o),
                        //s >>>= 0,
                        //t.bufferData(r, n, s)
                    }, (t, r, a, n, o) => {
                        //(t = e[t]).viewport(r, a, n, o)
                    }, (t, r, a) => {
                        //t = e[t],
                        //r = e[r],
                        //a = e[a],
                        //t.attachShader(r, a)
                    }, (t, r, n, o, s) => {
                        /*(t = e[t])(new Blob([r = a().subarray(r, r + n)],{
                            type: o = l.decode(a().subarray(o, o + s))
                        }))*/
                    }, t => 0 === (t = e[t]).length ? 0 : t[0].status ? 1 : t[0].signature ? 2 : 3, (t, r, a) => {
                        u(t, (r = e[r])[a].name)
                    }, (t, r, n, o) =>
                    /*(t = e[t],
                                r = e[r],
                                n = l.decode(a().subarray(n, n + o)),
                                t.getAttribLocation(r, n))*/
                    {}, (t, r, a, n, o) => {
                        //t = e[t],
                        //r = e[r],
                        //t.uniform3f(r, a, n, o)
                    },
                    t => "boolean" == typeof(t = e[t]), t => (t = e[t]).shift() ?? -1, e => {
                        t(e, /*window*/ {})
                    },
                    e => {
                        u(e,
                            /*( () => {
                                                let e;
                                                try {
                                                    e = localStorage.getItem("arras.io")
                                                } catch (e) {}
                                                return e || ""
                                            }
                                            )()*/
                        "")
                    },
                    e => {
                        u(e, "#" + url)
                    }, (t, r, n, o, s, i) => {
                        /*t = e[t],
                        r = e[r],
                        n = l.decode(a().subarray(n, n + o)),
                        s = l.decode(a().subarray(s, s + i)),
                        t(new Blob([r],{
                            type: n
                        }), s)*/
                    }, (t, r, n, o) => {
                        // t = l.decode(a().subarray(t, t + r)),
                        // n = e[n],
                        // o >>>= 0,
                        // fetch(t).then(e => e.arrayBuffer()).then(e => e.byteLength).catch( () => -1).then(e => n.push(o, e))
                    }, (t, r, a) => {
                        //t = e[t],
                        //r = e[r],
                        //t.uniform1i(r, a)
                    }, (e, t) => {
                        /*e = l.decode(a().subarray(e, e + t));
                        let r = document.createElement("canvas");
                        try {
                            return r.getContext(e, {
                                failIfMajorPerformanceCaveat: !0
                            }) ? 3 : r.getContext(e) ? 2 : 1
                        } catch (e) {}
                        return 0*/
                    }, (t, r) => {
                        //r = e[r],
                        h(t, (() => {
                            /*r.style.position = "absolute",
                            r.style.display = "inline-block",
                            r.style.width = "auto",
                            r.style.height = "auto",
                            r.style.overflow = "hidden",
                            r.style.transformOrigin = "top left",
                            r.style.transform = "";
                            let e = r.getBoundingClientRect();
                            return [e.width, e.height]*/
                            [0, 0]
                        })())
                    },
                    t => {
                        //(t = e[t]).focus()
                    }, () => /*"ontouchstart"in document.body && /android|mobi/i.test(navigator.userAgent)*/ false, (t, r) => {
                        u(t, r = e[r])
                    },
                    t => (t = e[t]).shift(), t => "number" == typeof(t = e[t]), (t, r) => {
                        //t = e[t],
                        //r >>>= 0,
                        //t.clear(r)
                    }, () =>
                    /*!document.createElement("canvas").getContext("webgl", {
                                    failIfMajorPerformanceCaveat: !0
                                })*/
                    false, (t, r, n, o, s) => {
                        //t = e[t],
                        //r = l.decode(a().subarray(r, r + n)),
                        //t.fillText(r, o, s)
                    }, (r, a, n) => {
                        //a = e[a],
                        //n >>>= 0,
                        t(r, /*a.getParameter(n)*/ [])
                    }, (t, r) => {
                        //t = e[t],
                        //r >>>= 0,
                        //t.disable(r)
                    }, (t, r) => {
                        //(t = e[t]).font = `${r}px Ubuntu`
                    },
                    t => {
                        let r = (t = e[t])[0];
                        return t[0] = !1,
                            r
                    }, (t, r, n) => {
                        t = e[t];
                        r = a().subarray(r, r + n);
                        if (1 === t.readyState) {
                            if (!first_server_packet_sent) {
                                first_server_packet_sent = true;
                                t.send(INITIAL_SERVER_PACKET);
                            } else {
                                t.send(r);
                            }
                        }
                    }, (t, r) => (t = e[t])[r].clients, (t, r, a, n, o) => {
                        //(t = e[t]).strokeRect(r, a, n, o)
                    }, (t, r) => {
                        //t = e[t],
                        //r = e[r],
                        //t.compileShader(r)
                    }, () => performance.now() + 1000000, t => {
                        //(t = e[t]).remove()
                    }, (t, r, n, o) => {
                        //t = e[t],
                        //r = e[r],
                        //n = l.decode(a().subarray(n, n + o)),
                        //t.shaderSource(r, n)
                    }, () => /*Date.now()*/ 0, t => t = e[t], () => {
                        /*try {
                            document.body.requestFullscreen()
                        } catch (e) {}*/
                    }, (t, r, n) => {
                        t = l.decode(a().subarray(t, t + r)),
                        t = t.replace(".uvwx.xyz:2222", "-c.uvwx.xyz:8443/2222"),
                        n = e[n];
                        if (!t.includes("signature")) {
                            safe_fetch(t).then(e => e.json()).then(e => {
                                n.push(e),
                                g()
                            });
                        } else {
                            n.push({}),
                            g()
                        }
                    }, (t, r) => {
                        //(t = e[t]).globalAlpha = r
                    },
                    t => /*(t = e[t]).complete*/ true, t => (t = e[t]).shift(), () => /*navigator.hardwareConcurrency || -1*/ 16, (e, t) => {
                        let value = l.decode(a().subarray(e, e + t));
                        if (teamlink_mode && !teamlink_sent) {
                            emit_debug("hash_set", value);
                            let code = normalize_party_code(value, server_code);
                            if (code) set_teamlink_code(code, "hash");
                        }
                    }, () => /*crypto.getRandomValues(new Uint32Array(1))[0]*/ 0, (t, r) => {
                        u(t, (r = e[r]).shift() ?? "")
                    }, (e, t) => {
                        let value = l.decode(a().subarray(e, e + t));
                        if (teamlink_mode && !teamlink_sent) {
                            emit_debug("hash_set_full", value);
                            let code = normalize_party_code(value, server_code);
                            if (code) set_teamlink_code(code, "hash");
                        }
                    }, (t, r, a) => {
                        //(t = e[t]).width = r,
                        //t.height = a
                    }, () => true, () => {
                        /*try {
                            location.reload()
                        } catch (e) {}*/
                    }, (t, r) => {
                        //t = e[t],
                        //r = e[r],
                        //t.linkProgram(r)
                    }, (t, r, a, n) => {
                        //t = e[t],
                        //r >>>= 0,
                        //t.drawArrays(r, a, n)
                    }, (t, r) => {
                        u(t, /*(r = e[r]).shift().signature*/ "")
                    },
                    t => (t = e[t]).shift().clients, (r, a) => {
                        key_press("Enter", 13);
                        t(r, Object.values((a = e[a]).shift().status))
                    }, (r, n, o, s) => {
                        //n = e[n],
                        //o = l.decode(a().subarray(o, o + s)),
                        t(r,
                            /*( () => {
                                                try {
                                                    return n[o]
                                                } catch (e) {
                                                    return n
                                                }
                                            }
                                            )()*/
                            0)
                    },
                    e => {
                        u(e,
                            /* ( () => {
                                                let e = document.createElement("canvas").getContext("webgl");
                                                if (!e)
                                                    return "";
                                                let t = [e.RENDERER, e.VENDOR]
                                                    , r = e.getExtension("WEBGL_debug_renderer_info");
                                                return null != r && t.push(r.UNMASKED_RENDERER_WEBGL, r.UNMASKED_VENDOR_WEBGL),
                                                t.map(t => e.getParameter(t)).join("\n")
                                            }
                                            )()*/
                            [])
                    },
                    e => {
                        u(e, "")
                    }, () => true, (e, t) => {
                        /*
                        e = a().subarray(e, e + t);
                        try {
                            return new WebAssembly.Instance(new WebAssembly.Module(e)).exports.b(BigInt(0)) === BigInt(0)
                        } catch (e) {}
                        return !1 */
                    },
                    e => {
                        t(e,
                            /*e => (e.preventDefault(),
                                            e.returnValue = "",
                                            "")*/
                            function() {})
                    }, () => true, (t, r, n) => {
                        //t = e[t],
                        //r = l.decode(a().subarray(r, r + n)),
                        //console.log(r, t),
                        //t.value = r
                    },
                    e => {
                        t(e, /*document.createElement("canvas")*/ {})
                    },
                    e => {
                        t(e,
                            (() => {
                                let e = [!1, !1],
                                    t = () => {
                                        e[0] = true;
                                        g();
                                        setTimeout(t, 0);
                                    };
                                setTimeout(t, 0);
                                return e;
                            })())
                    },
                    e => {
                        u(e, "arras.io")
                    },
                    t => (t = e[t]).shift() || 0, t => {
                        //(t = e[t]).addEventListener("focus", () => t.select())
                    },
                    t => {
                        //(t = e[t]).stroke()
                    }, (t, r, a, n, o, s, i, d, l) => {
                        //r >>>= 0,
                        //a = e[a],
                        //d >>>= 0,
                        //l >>>= 0,
                        y(t,
                            /*( () => {
                                                let e = new Uint8Array(r);
                                                return a.readPixels(n, o, s, i, d, l, e),
                                                e
                                            }
                                            )()*/
                            [])
                    },
                    t => {
                        //(t = e[t]).lineJoin = "round",
                        //t.lineCap = "round",
                        //t.textAlign = "left",
                        //t.textBaseline = "middle"
                    }, () => {
                        /*let e = !1;
                        addEventListener("error", t => {
                            if (e)
                                return;
                            e = !0;
                            let {message: r, filename: a, lineno: n, colno: o, error: s} = t;
                            s && (s = s.toString()),
                            (null != s || 0 != n || 0 != o) && prompt("The game may have crashed, refresh the page to recover from error.\n\nError information:", JSON.stringify({
                                message: r,
                                filename: a,
                                lineno: n,
                                colno: o,
                                error: s
                            }))
                        }
                        )*/
                    }, (t, r, a) => {
                        //t = e[t],
                        //r >>>= 0,
                        //a >>>= 0,
                        //t.blendFunc(r, a)
                    },
                    t => {
                        //(t = e[t]).lineCap = "round"
                    },
                    t => (t = e[t]).pop(), (t, r) => {
                        //(t = e[t]).font = `bold ${r}px Ubuntu`
                    },
                    t => {
                        //(t = e[t]).fill()
                    }, (t, r, a, n) => {
                        /*t = e[t],
                        r = e[r],
                        t.drawImage(r, a, n)*/
                    }, (t, r, a, n, o) => {
                        //t = e[t],
                        //r >>>= 0,
                        //n >>>= 0,
                        //t.drawElements(r, a, n, o)
                    }, (t, r, a) => {
                        //t = e[t],
                        //r >>>= 0,
                        //t.strokeStyle = `rgba(${r >> 16},${r >> 8 & 255},${255 & r},${a})`
                    },
                    t => {
                        /*((t = e[t]).videoRecorder || (t.videoRecorder = new MediaRecorder(t.captureStream(30),{
                                            mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp8") ? "video/webm;codecs=vp8" : "video/webm",
                                            videoBitsPerSecond: 2097152,
                                            audioBitsPerSecond: 0
                                        })),
                                        "inactive" === t.videoRecorder.state) ? (t.videoRecorder.start(),
                                        !1) : (t.videoRecorder.stop(),
                                        !0)*/
                    }, (t, r, a) => {
                        //t = e[t],
                        //r >>>= 0,
                        //t.pixelStorei(r, a)
                    }, (t, r) => {
                        //t = e[t],
                        //r >>>= 0,
                        //t.depthFunc(r)
                    }, (t, r) => {
                        //t = e[t],
                        //r >>>= 0,
                        //t.enableVertexAttribArray(r)
                    },
                    t => {
                        //(t = e[t]).style.clipPath = "none"
                    }, (t, r, a) => {
                        //(t = e[t]).translate(r, a)
                    }, (t, r) => {
                        u(t, "127.0.0.1")
                    }, () => true, t => {
                        //t = e[t],
                        //addEventListener("beforeunload", t)
                    }, (r, a) => {
                        a = e[a],
                            t(r,
                                /*( () => {
                                                    let e = atob(a.toDataURL().split(",")[1])
                                                        , t = new Uint8Array(e.length);
                                                    for (let r = 0; r < e.length; r++)
                                                        t[r] = e.charCodeAt(r);
                                                    return t
                                                }
                                                )()*/
                                [])
                    }, (t, r) => {
                        //t = e[t],
                        //r >>>= 0,
                        //t.activeTexture(r)
                    }, (r, n, o, s, i) => {
                        //n = e[n],
                        //o = e[o],
                        //s = l.decode(a().subarray(s, s + i)),
                        t(r, {})
                    },
                    t => {
                        // (t = e[t]).lineCap = "butt"
                    },
                    t => "string" == typeof(t = e[t]), (e, t) => {
                        // open(e = l.decode(a().subarray(e, e + t)), "_blank", "noopener")
                    }, (e, t) => (e = a().subarray(e, e + t),
                        WebAssembly.validate(e)), (t, r) => {
                        //t = e[t],
                        //r = e[r],
                        //t.replaceWith(r)
                    }, (t, r, a, n, o, s) => {
                        //(t = e[t]).style.left = `${r}px`,
                        //t.style.top = `${a}px`,
                        //t.style.width = `${n}px`,
                        //t.style.height = `${o}px`,
                        //t.style.transform = `scale(${s}, ${s})`
                    }, () => {
                        /*let e = ramp = ramp || {};
                        e.que = e.que || [],
                        e.passiveMode = !0,
                        _pwGA4PageviewId = Date.now().toString();
                        let t = dataLayer = dataLayer || []
                        , r = gtag = gtag || function() {
                            t.push(arguments)
                        }
                        ;
                        r("js", new Date),
                        r("config", "UA-120544149-1"),
                        r("event", "ramp_js", {
                            send_to: "UA-120544149-1",
                            pageview_id: _pwGA4PageviewId
                        })*/
                    },
                    t => {
                        e[t >>>= 0] = null
                    }, (t, r) => false, e => {
                        t(e, null)
                    },
                    t =>
                    /*(t = e[t],
                                document.activeElement === t)*/
                    {
                        false
                    }, (r, a) => {
                        t(r, (() => {
                            let e = [];
                            return e
                            /*addEventListener("mousedown", t => {
                                                        (e.push(1, t.clientX, t.clientY, t.button),
                                                        g())
                                                    }
                                                    ),
                                                    addEventListener("mousemove", t => {
                                                        (e.push(2, t.clientX, t.clientY),
                                                        g())
                                                    }
                                                    ),
                                                    addEventListener("mouseup", t => {
                                                        (e.push(3, t.clientX, t.clientY, t.button),
                                                        g())
                                                    }
                                                    ),
                                                    addEventListener("wheel", t => {
                                                        (t.preventDefault(),
                                                        e.push(4, t.clientX, t.clientY, t.deltaY * (1 === t.deltaMode ? 40 : 2 === t.deltaMode ? 320 : 1)),
                                                        g())
                                                    }
                                                    ),*/
                        })())
                    }, (t, r) => {
                        //(t = e[t]).font = `${r}px Trebuchet MS`
                    }, (t, r) => (t = e[t])[r].uptime, () => /*new Date(new Date().getFullYear(),0,1).getTimezoneOffset()*/ 0, e => {
                        t(e, [])
                    }, (t, r, a, n, o, s, i) => {
                        //t = e[t],
                        //r >>>= 0,
                        //n >>>= 0,
                        //o = o > 0,
                        //t.vertexAttribPointer(r, a, n, o, s, i)
                    }, (t, r) => {
                        u(t, (r = e[r]).protocol)
                    }, (t, r, a, n, o) => {
                        //(t = e[t]).scissor(r, a, n, o)
                    }, () => /*innerWidth*/ 1000, t => (t = e[t]).length || 0, () => /*devicePixelRatio*/ 1, (t, r) => {
                        //t = e[t],
                        //r = e[r],
                        //t.appendChild(r)
                    }, (t, r, a) => {
                        u(t, (r = e[r])[a].host)
                    }, (r, a, n) => {
                        //a = e[a],
                        //n = n > 0,
                        t(r,
                            /*a.getContext("2d", {
                                                alpha: n
                                            })*/
                            {})
                    },
                    t => !(t = e[t]), (r, a) => {
                        t(r, /*(a = e[a]).createTexture()*/ {})
                    }, (t, r, a, n, o) => {
                        //t = e[t],
                        //r >>>= 0,
                        //a >>>= 0,
                        //n >>>= 0,
                        //o >>>= 0,
                        //t.blendFuncSeparate(r, a, n, o)
                    }, (t, r, n, o, s) => {
                        //t = e[t],
                        //r = l.decode(a().subarray(r, r + n)),
                        //t.strokeText(r, o, s)
                    }, (t, r, a, n) => {
                        //t = e[t],
                        //r = e[r],
                        //t.uniform2f(r, a, n)
                    }, (r, a) => {
                        // a = e[a],
                        t(r, /*new Promise(e => a.toBlob(e))*/ {})
                    }, (t, r, n, o) => {
                        //t = e[t],
                        //r = e[r],
                        //n = l.decode(a().subarray(n, n + o)),
                        //t.then(e => r(e, n))
                    }, () => {
                        /*let e = () => arrasAdDone = true
                        , t = document.createElement("script");
                        t.async = !0,
                        t.src = "https://cdn.intergient.com/1024850/73985/ramp.js",
                        t.onload = () => {
                            ramp.que.push(e),
                            setTimeout(e, 2e4)
                        }
                        ,
                        t.onerror = e,
                        document.body.appendChild(t)*/
                    }, (r, a) => {
                        t(r, (a = e[a])[1])
                    }, (t, r, n, o) => {
                        /*(t = e[t])(new Blob([r = e[r]],{
                            type: n = l.decode(a().subarray(n, n + o))
                        }))*/
                    },
                    e => {
                        /*t(e, (e, t) => {
                            let r = URL.createObjectURL(e)
                            , a = document.createElement("a");
                            a.style.display = "none",
                            a.setAttribute("download", t),
                            a.setAttribute("href", r),
                            document.body.appendChild(a),
                            a.click(),
                            a.remove(),
                            URL.revokeObjectURL(r)
                        }
                        )*/
                    },
                    t => /*(t = e[t])[0].timestamp*/ 0, (r, a, n) => {
                        //a = e[a],
                        //n >>>= 0,
                        t(r, /*a.createShader(n)*/ {})
                    },
                    e => {
                        u(e, 'Error\n    at <anonymous>:4:33\n    at <anonymous>:8:22')
                    }, () => {
                        //let e = document.activeElement;
                        //null != e && e.blur()
                    }, (t, r) => {
                        u(t, (r = e[r]).shift())
                    },
                    e => {
                        t(e,
                            /*( () => {
                                                let e = [];
                                                return fetch("./CHANGELOG.md").then(e => e.text()).catch( () => "").then(t => e.push(t)),
                                                e
                                            }
                                            )()*/
                            [])
                    },
                    e => {
                        t(e, (() => {
                            // Promise font thing
                            let e = [];
                            return e.push(!0),
                                e
                        })())
                    }, (t, r) => {
                        y(t, r = e[r])
                    }, (t, r, a) => {
                        //t = e[t],
                        //r >>>= 0,
                        //a = e[a],
                        //t.bindBuffer(r, a)
                    }, (t, r) => {
                        u(t, /*(r = e[r]).lastValue*/ 0)
                    }, (t, r, a, n, o, s) => {
                        //(t = e[t]).arc(r, a, n, o, s)
                    }, (r, a, n) => {
                        //a = e[a],
                        //n = n > 0,
                        t(r,
                            /*a.getContext("webgl", {
                                                antialias: n,
                                                premultipliedAlpha: !0,
                                                failIfMajorPerformanceCaveat: !0
                                            })*/
                            {})
                    }, (t, r, n) => {
                        //t = e[t],
                        //r = l.decode(a().subarray(r, r + n)),
                        //t.lastValue = r
                    }, (t, r, a) => {
                        //t = e[t],
                        //r >>>= 0,
                        //t.fillStyle = `rgba(${r >> 16},${r >> 8 & 255},${255 & r},${a})`
                    },
                    t => {
                        //(t = e[t]).style.textAlign = "center"
                    },
                    t => {
                        //(t = e[t]).save()
                    }, (t, r) => {
                        // r = e[r],
                        u(t,
                            /*( () => {
                                                try {
                                                    return `${r}`
                                                } catch (e) {
                                                    return ""
                                                }
                                            }
                                            )()*/
                            "")
                    },
                    t => {
                        //(t = e[t]).closePath()
                    },
                    t => /*(t = e[t]).isContextLost()*/ false, (t, r, a, n, o, s, i, d, l, c, u) => {
                        /*t = e[t],
                        i >>>= 0,
                        c = c > 0,
                        u = u > 0,
                        t.style.position = "absolute",
                        t.style.left = `${r}px`,
                        t.style.top = `${a}px`,
                        t.style.width = `${n}px`,
                        t.style.height = `${o}px`,
                        t.style.font = `bold ${s}px/${o}px Ubuntu`,
                        t.style.border = "none",
                        t.style.outline = "none",
                        t.style.padding = "0",
                        t.style.margin = "0",
                        t.style.backgroundColor = "transparent",
                        t.style.setProperty("color", `rgba(${i >> 16},${i >> 8 & 255},${255 & i},${d})`, "important"),
                        t.maxLength = l,
                        t.type = c ? "password" : "text",
                        t.readOnly = u*/
                    }, (t, r) => {
                        //t = e[t],
                        //r >>>= 0,
                        //t.enable(r)
                    }, (t, r, a, n, o, s, i, d, l, c) => {
                        /*t = e[t],
                        r = e[r],
                        t.drawImage(r, a, n, o, s, i, d, l, c)*/
                    },
                    t => {
                        //(t = e[t]).restore()
                    },
                    t => {
                        //(t = e[t]).beginPath()
                    }, (t, r, n) => {
                        //t = e[t],
                        //r = l.decode(a().subarray(r, r + n)),
                        //t.style.cursor = r
                    }, (t, r) => {
                        r = e[r],
                            h(t,
                                /* ( () => {
                                                    let e = r.getBoundingClientRect();
                                                    return [e.top, e.right, e.bottom, e.left]
                                                }
                                                )()*/
                                [0, 0, 0, 0])
                    },
                    e => {
                        t(e, /*document.createElement("div")*/ {})
                    }, (e, t, r) => {
                        t = l.decode(a().subarray(t, t + r)),
                            u(e,
                                /*( () => {
                                                    let e = ""
                                                        , r = document.createElement("span");
                                                    for (let a of (r.style.visibility = "hidden",
                                                    r.style.font = "initial",
                                                    r.style.fontSize = "1920px",
                                                    document.body.appendChild(r),
                                                    ["initial", "sans-serif", "serif", "monospace", "cursive", "fantasy"]))
                                                        for (let n of (r.style.fontFamily = a,
                                                        t))
                                                            r.textContent = n,
                                                            e += `${r.offsetWidth} ${r.offsetHeight}`;
                                                            r.remove();
                                                            console.log(e.slice(0, -1));
                                                        return e.slice(0, -1);
                                                }
                                                )()*/
                                "960 21261068 21261461 2126585 21260 21261015 21260 21261154 21261493 21261141 21262324 21261348 21261920 21261141 21261037 21261173 21260 21261370 2126960 21261173 2126960 2126960 2126960 21260 21261656 21262358 21261532 21261275 21261734 21261049 2126853 21261780 21261920 21261920 21261187 2126465 21261493 21261493 21261225 21261493 21261865 21261493 21261344 2126960 21451281 21451395 2145677 21450 21451015 21450 21451154 21451440 21451141 21452324 21451348 21451920 21451141 21451037 21451173 21450 21451349 21451000 21451173 21451068 21451068 21451068 21450 21451656 21452358 21451532 21451275 21451734 21451049 2145940 21451780 21451920 21451920 21451410 2145465 21451440 21451440 21451225 21451440 21451865 21451440 21451344 2145960 21261068 21261461 2126585 21260 21261015 21260 21261154 21261493 21261141 21262324 21261348 21261920 21261141 21261037 21261173 21260 21261370 2126960 21261173 2126960 2126960 2126960 21260 21261656 21262358 21261532 21261275 21261734 21261049 2126853 21261780 21261920 21261920 21261187 2126465 21261493 21261493 21261225 21261493 21261865 21261493 21261344 2126960 22481056 22481056 2248585 22480 22481015 22480 22481154 22481056 22481141 22482324 22481348 22481920 22481141 22481037 22481173 22480 22481056 22481056 22481056 22481056 22481056 22481056 22480 22481656 22482358 22481532 22481275 22481734 22481049 22481056 22481780 22481920 22481920 22481187 2248465 22481056 22481056 22481225 22481056 22481865 22481056 22481344 2248960 26761331 26761461 2676585 26760 26761015 26760 26761154 2676960 26761141 26762324 26761348 26761920 26761141 26761037 26761173 26760 26761370 2676960 26761172 26761172 26761172 26761194 26760 26761656 26762358 26761532 26761275 26761734 26761049 2676853 26761780 26761920 26761920 26761187 2676465 2676960 2676960 26761225 2676960 26761865 2676960 26761344 2676960 2342993 23421461 2342585 23420 23421015 23420 23421154 23421440 23421141 23422324 23421348 23421920 23421141 23421037 23421173 23420 23421370 2342960 23421173 2342960 2342960 2342960 23420 23421656 23422358 23421532 23421275 23421734 23421049 2342853 23421780 23421920 23421920 23421187 2342465 2342323 23421440 23421225 23421440 23421865 23421440 23421344 234")
                    }, (e, t) => {
                        /*e = l.decode(a().subarray(e, e + t));
                        try {
                            localStorage.setItem("arras.io", e)
                        } catch (e) {}*/
                    },
                    e => {
                        // Figure out how to get rid of
                        t(e,
                            /*( () => {
                                                let e = document.createElement("input");
                                                e.spellcheck = !1,
                                                e.autocomplete = "off",
                                                e.tabIndex = -1,
                                                e.lastValue = e.value;
                                                return e;
                                            }
                                            )()*/
                            [])
                    }, (t, r) => (t = e[t])[r].mspt, (t, r) => {
                        //t = e[t],
                        //r >>>= 0,
                        //t.fillStyle = `rgb(${r >> 16},${r >> 8 & 255},${255 & r})`
                    }, (r, a, n, o) => {
                        //a = e[a],
                        //n = e[n],
                        //o >>>= 0,
                        t(r, /*a.getProgramParameter(n, o)*/ 0)
                    }, (t, r, a, n, o) => {
                        // (t = e[t]).rect(r, a, n, o)
                    }, (r, a) => {
                        /*a = e[a],
                        t(r, new Promise(e => {
                            let t = r => {
                                e(r.data),
                                a.videoRecorder.removeEventListener("dataavailable", t)
                            }
                            ;
                            a.videoRecorder.addEventListener("dataavailable", t)
                        }
                        ))*/
                    }, (t, r, n) => {
                        /*(t = e[t],
                                        r = l.decode(a().subarray(r, r + n)),
                                        t.measureText(r).width)*/
                    }, (t, r, n, o, s, i, d) => {
                        /*t = e[t],
                        r = a().subarray(r, r + n),
                        o = l.decode(a().subarray(o, o + s)),
                        i = l.decode(a().subarray(i, i + d)),
                        t(new Blob([r],{
                            type: o
                        }), i)*/
                    }, (t, r, a, n, o) => {
                        // (t = e[t]).style.clipPath = `xywh(${r}px ${a}px ${n}px ${o}px)`
                    }, (t, r, a, n, o, s, i) => {
                        /*t = e[t],
                        r >>>= 0,
                        n >>>= 0,
                        o >>>= 0,
                        s >>>= 0,
                        i = e[i],
                        t.texImage2D(r, a, n, o, s, i)*/
                    }, (t, r) => {
                        /*t = e[t],
                        r = e[r],
                        t.useProgram(r)*/
                    }, (t, r) => {
                        /*t = e[t],
                        r = e[r],
                        t.then(e => r(e))*/
                    },
                    t => (t = e[t]).shift() || 0, (r, a) => {
                        a = e[a],
                            t(r, (() => {
                                let e = [];
                                return a.addEventListener("open", () => {
                                        client_opened = true;
                                        mockup_data = new mockup_parser();
                                        broadcast_data = new broadcast_parser();
                                        update_data = new update_parser();
                                        player_tab_data = new player_tab_parser();
                                        room_data = new room_parser();
                                        maze_map_manager_data = new maze_map_manager();
                                        console.log(`Socket OPENED in ${url}`);
                                        if (normal_bot_mode && pending_return_pathfinding) {
                                            activate_return_pathfinding();
                                            pending_return_pathfinding = false;
                                        }
                                        e.push(1);
                                        g();
                                    }),
                                    a.addEventListener("message", t => {
                                        let packet = new Uint8Array(t.data);
                                        new_packet_message = true;
                                        e.push(2, packet),
                                            g()
                                    }),
                                    a.addEventListener("close", t => {
                                        console.log(`Socket CLOSED in ${url}`);
                                        clear_runtime_intervals();
                                        if (stop_requested) {
                                            e.push(3, t.wasClean, t.code, t.reason),
                                                g();
                                            return;
                                        }
                                        if (client_opened) {
                                            if (!stop_requested && rejoin && connection_count < 3) {
                                                if (normal_bot_mode && server_has_maze && (has_spawned_once || return_pathfinding_active)) {
                                                    pending_return_pathfinding = true;
                                                }
                                                create_bot(url, proxy, connection_count + 1);
                                            } else {
                                                emit_worker_error(`There was an error connecting to #${url}.`);
                                            }
                                        } else {
                                            console.log(`Socket FAILED to connect to ${url}`);
                                            if (!stop_requested && connection_count < 3) {
                                                create_bot(url, proxy, connection_count + 1);
                                            } else {
                                                emit_worker_error(`There was an error connecting to #${url}.`);
                                            }
                                        }
                                        e.push(3, t.wasClean, t.code, t.reason),
                                            g();
                                    }),
                                    a.addEventListener("error", () => {
                                        e.push(4),
                                            g()
                                    }),
                                    e
                            })())
                    }, (e, t) => {
                        /*fetch("https://analytics-server.arras.cx:2002/data", {
                            method: "POST",
                            mode: "cors",
                            cache: "no-cache",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            body: e = l.decode(a().subarray(e, e + t))
                        }).then(e => e.json()).catch( () => {}
                        )*/
                    }, (t, r) => {
                        u(t, /*(r = e[r]).value*/ bot_name);
                    }, () => false, () => /* innerHeight */ 1000, (t, r, a, n, o) => {
                        // t = e[t];
                        // t.fillRect(r, a, n, o);
                    },
                    t => t = e[t], t => {
                        // (t = e[t]).lineJoin = "round"
                    },
                    t => (t = e[t])[0], t => {
                        // (t = e[t]).lineJoin = "miter"
                    }, (e, t) => {
                        let value = l.decode(a().subarray(e, e + t));
                        if (teamlink_mode && !teamlink_sent) {
                            emit_debug("clipboard", value);
                            let code = normalize_party_code(value, server_code);
                            if (code) set_teamlink_code(code, "clipboard");
                        }
                    },
                    e => {
                        u(e, "")
                    },
                    t => {
                        (t = e[t])[1] = !0
                    },
                    t => {
                        t = e[t]
                    },
                    e => {
                        /*t(e, ( () => {
                            let e = [!1, !1]
                            , t = new MessageChannel;
                            return t.port1.addEventListener("message", () => {
                                e[0] = !0,
                                g(),
                                e[1] || (document.hidden ? requestAnimationFrame( () => t.port2.postMessage(null)) : t.port2.postMessage(null))
                            }
                            ),
                            t.port1.start(),
                            t.port2.postMessage(null),
                            e
                        }
                        )())*/
                    }, (t, r) => (t = e[t])[r].online, () => {
                        /*document.addEventListener("contextmenu", e => {
                            "A" !== e.target.tagName && "INPUT" !== e.target.tagName && e.preventDefault()
                        }
                        )*/
                    },
                    e => {
                        t(e, (() => {
                            let e = [],
                                t = () => true;
                            let active_keys = {
                                87: false,
                                83: false,
                                68: false,
                                65: false
                            };
                            key_press = function(key, keyCode) {
                                if (active_keys[keyCode] === true) return;
                                e.push(2, key, keyCode);
                                if (active_keys[keyCode] !== undefined) active_keys[keyCode] = true;
                                g();
                            };
                            key_up = function (key, keyCode) {
                                if (active_keys[keyCode] === false) return;
                                e.push(1, key, keyCode);
                                if (active_keys[keyCode] !== undefined) active_keys[keyCode] = false;
                                g();
                            };
                            if (movement_interval) clearInterval(movement_interval);
                            movement_interval = setInterval(() => {
                                if (update_data) {
                                    let player = update_data.player;
                                    if (upgrade_mapper_mode) {
                                        handle_upgrade_mapper_tick(player);
                                        return;
                                    }
                                    if (!bot_upgrade_started) {
                                        if (player.fov == 1386.32177734375 || player.fov == 1399.37451171875) {
                                            for (let tank in upgrade_data.tanks) {
                                                packet_queue.push(upgrade_data.tanks[tank]);
                                            };
                                            for (let stat in upgrade_data.stats) {
                                                packet_queue.push(upgrade_data.stats[stat]);
                                            };
                                            if (upgrade_data.autofire && (upgrade_data.autofire_forced === true || bot_autofire_enabled)) {
                                                packet_queue.push(upgrade_data.autofire);
                                                bot_autofire_active = true;
                                            }
                                            if (upgrade_data.autospin) packet_queue.push(upgrade_data.autospin);
                                            bot_upgrade_started = true;
                                            if (upgrade_checker_interval) clearInterval(upgrade_checker_interval);
                                            upgrade_checker_interval = setInterval(() => {
                                                if (packet_queue.length == 0) {
                                                    bot_upgraded = true;
                                                    clearInterval(upgrade_checker_interval);
                                                    upgrade_checker_interval = undefined;
                                                };
                                            }, upgrade_queue_check_interval_ms);
                                        }
                                } else if (normal_bot_mode && bot_upgraded) {
                                    if (player.stat_points !== 0) {
                                        if (queue_missing_stat_target_packets(player)) {
                                            stat_points_utilized = false;
                                        } else if (stat_points_utilized) {
                                            let points = player.stat_points;
                                            while (true) {
                                                let order = upgrade_data.growth_extended_upgrades_order_to_max;
                                                let stat = player.stats[order[order.length - 1]];
                                                if (stat) {
                                                    if (stat.max - stat.value < points) {
                                                        packet_queue.unshift(packet_constructors.construct_stat_upgrade_packet(order[order.length - 1], stat.max - stat.value));
                                                        upgrade_data.growth_extended_upgrades_order_to_max.pop();
                                                        points -= stat.max - stat.value;
                                                    } else {
                                                        packet_queue.unshift(packet_constructors.construct_stat_upgrade_packet(order[order.length - 1], points));
                                                        break;
                                                    }
                                                }
                                            }
                                            stat_points_utilized = false;
                                        }
                                    } else if (!stat_points_utilized) {
                                        stat_points_utilized = true;
                                    };
                                    let vals = [];
                                    let dist = Math.hypot(player.x - target.x, player.y - target.y);
                                    maybe_stop_return_pathfinding(dist);
                                    if (!target.target_path.length) {
                                        if (dist > followbot_config.dist) {
                                            let comp_x = 0;
                                            let comp_y = 0;
                                            if (player.x > target.x - followbot_config.range && player.x < target.x + followbot_config.range && player.y > target.y) {
                                                vals.push("w")
                                                comp_y++;
                                                ranges.x = true;
                                            }
                                            if (player.x > target.x - followbot_config.range && player.x < target.x + followbot_config.range && player.y < target.y) {
                                                vals.push("s")
                                                comp_y--;
                                                ranges.x = true;
                                            }
                                            if (player.y > target.y - followbot_config.range && player.y < target.y + followbot_config.range && player.x < target.x) {
                                                vals.push("d")
                                                comp_x++;
                                                ranges.y = true;
                                            }
                                            if (player.y > target.y - followbot_config.range && player.y < target.y + followbot_config.range && player.x > target.x) {
                                                vals.push("a")
                                                comp_x--;
                                                ranges.y = true;
                                            }
                                            if (!ranges.x && !ranges.y) {
                                                if (player.x < target.x) {
                                                    vals.push("d")
                                                    comp_x++;
                                                }
                                                if (player.x > target.x) {
                                                    vals.push("a")
                                                    comp_x--;
                                                }
                                                if (player.y > target.y) {
                                                    vals.push("w")
                                                    comp_y++;
                                                }
                                                if (player.y < target.y) {
                                                    vals.push("s")
                                                    comp_y--;
                                                }
                                            }
                                            if (dist > followbot_config.face_fastest_movement_distance) {
                                                target.pathfinding_facing = yield_control_comps_from_angle(Math.atan2(comp_y, -comp_x) + 0.00001 + upgrade_data.pathfinding_facing_angle_offset);
                                            } else {
                                                target.pathfinding_facing = false;
                                            }
                                        } else {
                                            // Keep entity moving
                                            let pick = Math.floor(Math.random() * 4);
                                            switch (pick) {
                                                case 0:
                                                    vals.push("d");
                                                break;
                                                case 1:
                                                    vals.push("a");
                                                break;
                                                case 2:
                                                    vals.push("w");
                                                break;
                                                case 3:
                                                    vals.push("s");
                                                break;
                                            }
                                        }
                                    } else {
                                        let move_to = target.target_path[0];
                                        let angle_offset = upgrade_data.pathfinding_facing_angle_offset;
                                        if (dist > followbot_config.face_fastest_movement_distance) {
                                            target.pathfinding_facing = true;
                                        } else {
                                            target.pathfinding_facing = false;
                                        };
                                        if (move_to[0] > bot_node_data[0]) {
                                            vals.push("d")
                                            if (target.pathfinding_facing) target.pathfinding_facing = yield_control_comps_from_angle(Math.PI + 0.00001 + angle_offset);
                                        } else if (move_to[0] < bot_node_data[0]) {
                                            vals.push("a")
                                            if (target.pathfinding_facing) target.pathfinding_facing = yield_control_comps_from_angle(0.00001 + angle_offset);
                                        } else if (move_to[1] > bot_node_data[1]) {
                                            vals.push("s")
                                            if (target.pathfinding_facing) target.pathfinding_facing = yield_control_comps_from_angle(-Math.PI / 2 + 0.00001 + angle_offset);
                                        } else {
                                            vals.push("w")
                                            if (target.pathfinding_facing) target.pathfinding_facing = yield_control_comps_from_angle(Math.PI / 2 + 0.00001 + angle_offset);
                                        }
                                    }
                                    for (let count in keys) {
                                        if (vals.indexOf(count) !== -1) {
                                            key_press(...keys[count]);
                                        } else {
                                            key_up(...keys[count]);
                                        };
                                    };
                                    ranges.x = ranges.y = false;
                                };
                            };
                            }, movement_interval_ms);
                            return e;
                            /*addEventListener("keydown", r => {
                                                        r.ctrlKey || r.altKey || r.metaKey || t() || /^F([56]|\d{2,})$/.test(r.key) || r.preventDefault();
                                                        let a = r.ctrlKey | r.altKey << 1 | r.shiftKey << 2 | r.metaKey << 3;
                                                        e.push(2 | r.repeat | a << 2, r.key, r.code),
                                                        g()
                                                    }
                                                    ),
                                                    addEventListener("keyup", r => {
                                                        r.ctrlKey || r.altKey || r.metaKey || t() || /^F([56]|\d{2,})$/.test(r.key) || r.preventDefault();
                                                        let a = r.ctrlKey | r.altKey << 1 | r.shiftKey << 2 | r.metaKey << 3;
                                                        e.push(1 | a << 2, r.key, r.code),
                                                        g()
                                                    }
                                                    ),*/
                        })())
                    }, () => true, (e, t) => {
                        // console.log(e = l.decode(a().subarray(e, e + t)))
                    },
                    t => {
                        (t = e[t]).close()
                    }, (t, r, a) => {
                        u(t, (r = e[r])[a].code)
                    }, (t, r) => {
                        r = e[r],
                            h(t, (() => {
                                let e = new Int32Array(r);
                                return r.length = 0,
                                    e
                            })())
                    }, (t, r) => {
                        p(t, (r = e[r]).pop())
                    }, (t, r) => (t = e[t])[r].featured, (e, r, n, o, s) => {
                            r = l.decode(a().subarray(r, r + n));
                            o = l.decode(a().subarray(o, o + s));
                            r = normalizeServerSocketUrl(r);
                            t(e, (() => {
                                let websocket_options = {
                                    headers: {
                                        'User-Agent': user_agent,
                                        'Origin': 'https://arras.io',
                                        'Pragma': 'no-cache',
                                        'Cache-Control': 'no-cache',
                                        'Accept-Encoding': 'gzip, deflate, br, zstd',
                                        'Accept-Language': 'en-US,en;q=0.9',
                                    },
                                    perMessageDeflate: true,
                                };
                                if (proxy !== "") {
                                    websocket_options.createConnection = (_, callback) => {
                                        connectViaSocks5(r, proxy).then(
                                            socket => callback(null, socket),
                                            error => callback(error)
                                        );
                                    };
                                }
                                let e = new WebSocket(r, ['arras.io#v1.4+sls+et0', 'arras.io'], websocket_options);
                                active_socket = e;
                                return e.binaryType = "arraybuffer",
                                    e
                            })())
                    }, (r, n, o, s, i, d) => {
                        n = l.decode(a().subarray(n, n + o)),
                            s = l.decode(a().subarray(s, s + i)),
                            d = e[d],
                            t(r, (() => {
                                try {
                                    return [!1, Function(n, s)(d)]
                                } catch (e) {
                                    return [!0, e]
                                }
                            })())
                    }, (t, r, a) => {
                        // (t = e[t]).lineTo(r, a)
                    }, (r, a) => {
                        t(r, /*(a = e[a]).createProgram()*/ {})
                    }, (r, a) => {
                        t(r, /*(a = e[a]).createBuffer()*/ [])
                    }, (t, r, a, n, o) => {
                        // (t = e[t]).clearRect(r, a, n, o)
                    }, (t, r, a, n, o) => {
                        // (t = e[t]).blendColor(r, a, n, o)
                    }, (value, xor, type) => {
                        if (!type) {
                            if (new_packet_message) {
                                switch (message_packet[0]) {
                                    case 117:
                                        encoded_packet = new Uint8Array(message_packet);
                                        decoded_packet = decode_packet(encoded_packet, "u");
                                        update_data.parse(decoded_packet[0], decoded_packet[1], encoded_packet);
                                        if (teamlink_mode && update_data.player && update_data.player.id != null && !spawned_at) {
                                            spawned_at = Date.now();
                                        }
                                        if (teamlink_mode && update_data.player && update_data.player.id != null && !sent_spawned) {
                                            sent_spawned = true;
                                            parentPort.postMessage({ type: "status", status: "spawned" });
                                        }
                                        if (teamlink_mode && Number.isFinite(update_data.player.color)) {
                                            team_color = update_data.player.color;
                                            maybe_emit_teamlink();
                                        }
                                        if (normal_bot_mode && update_data.player && update_data.player.id != null) {
                                            has_spawned_once = true;
                                        }
                                        if (observer_mode) sync_visible_entities_from_update(decoded_packet[0], decoded_packet[1], encoded_packet);
                                        if (update_data.entities[update_data.player.id]) {
                                            update_data.entities[update_data.player.id].color = 36;
                                            update_data.entities[update_data.player.id].bot = writer;
                                        }
                                        //let entity_packet = encode_entities(update_data.entities, update_data.deleted_entities, update_data.static_mockups, writer);
                                        //parentPort.postMessage([1, entity_packet]);
                                        if (is_bot_pathfinding_active() && target.node_data && maze_map_manager_data.map && room_data.room_dimensions.length) {
                                            bot_node_data = maze_map_manager_data.parse_position_coordinate(update_data.player.x, update_data.player.y, room_data.room_dimensions);
                                            target.target_path = maze_map_manager_data.find_path(bot_node_data, target.node_data, update_data.player.color);
                                        };
                                        emit_observer_snapshot();
                                    break;
                                    case 98:
                                        encoded_packet = new Uint8Array(message_packet);
                                        decoded_packet = decode_packet(encoded_packet, "b");
                                        broadcast_data.parse(decoded_packet[0], decoded_packet[1], encoded_packet);
                                        if (teamlink_mode) {
                                            team_minimap_seen = true;
                                            team_player_count = Object.keys(broadcast_data.team_minimap).length;
                                            if (team_player_count > 0) team_minimap_ready = true;
                                            if (!team_minimap_ready && spawned_at && Date.now() - spawned_at >= team_minimap_grace_ms) {
                                                team_minimap_ready = true;
                                            }
                                            maybe_emit_teamlink();
                                        }
                                        if (!maze_map_manager_data.map && maze_map_manager_data.check_if_map_is_maze(broadcast_data.global_minimap)) {
                                            server_has_maze = true;
                                            maze_map_manager_data.parse_maze_map(room_data, broadcast_data.global_minimap);
                                        };
                                        emit_observer_snapshot(true);
                                    break;
                                    case 74:
                                        decoded_packet = decode_packet(new Uint8Array(message_packet), "J")[0];
                                        if (upgrade_mapper_mode) remember_mapper_mockup_packet(decoded_packet);
                                        mockup_data.parse(decoded_packet);
                                        let framed_mockup_packet = new Uint8Array(decoded_packet.length + 1);
                                        framed_mockup_packet[0] = 74;
                                        framed_mockup_packet.set(decoded_packet, 1);
                                        parentPort.postMessage([1, framed_mockup_packet.buffer]);
                                        update_data.static_mockups[mockup_data.mockups_name_id_map["Wall"]] = true;
                                        update_data.static_mockups[mockup_data.mockups_name_id_map["Rock"]] = true;
                                    break;
                                    case 82:
                                        let game_data_length = message_packet[2] + message_packet[3] * 256;
                                        let game_data_end = 4 + game_data_length;
                                        let game_data = new TextDecoder().decode(new Uint8Array(message_packet.slice(4, game_data_end)));
                                        let remaining_packet = decode_packet(new Uint8Array(message_packet.slice(game_data_end, message_packet.length)))[0];
                                        if (teamlink_mode && !teamlink_sent) {
                                            emit_debug("room_data", game_data);
                                            let code = extract_party_code_from_game_data(game_data, server_code);
                                            if (code) set_teamlink_code(code, "room");
                                        }
                                        if (teamlink_mode && !sent_room_info) {
                                            sent_room_info = true;
                                            parentPort.postMessage({
                                                type: "room_info",
                                                game_data: game_data,
                                                fields: parse_game_data_fields(game_data)
                                            });
                                        }
                                        if (!room_data.mode) room_data.parse(remaining_packet, game_data);
                                    break;
                                    case 80:
                                        encoded_packet = new Uint8Array(message_packet);
                                        decoded_packet = decode_packet(encoded_packet, "P");
                                        player_tab_data.parse(decoded_packet[0], decoded_packet[1], encoded_packet);
                                        emit_observer_snapshot(true);
                                    break;
                                    case 70: 
                                        if (normal_bot_mode && has_spawned_once && server_has_maze) activate_return_pathfinding();
                                        packet_queue.push(packet_constructors.construct_spawn_packet(bot_name, observer_mode ? url : ""));
                                        bot_autofire_active = false;
                                        setTimeout(() => { 
                                            bot_upgrade_started = false;
                                            bot_upgraded = false; 
                                        }, 2000);
                                    break;
                                    case 109:
                                        let m = new TextDecoder().decode(new Uint8Array(message_packet));
                                        if (teamlink_mode && !teamlink_sent) {
                                            let code = extract_party_code_from_text(m, server_code);
                                            if (code) set_teamlink_code(code, "message");
                                        }
                                        if (m.includes("you tried to join is full")) {
                                            emit_worker_error("A bot tried to join a full clan.");
                                        }
                                        break;
                                    case 75:
                                        let message = new TextDecoder().decode(new Uint8Array(message_packet));
                                        if (teamlink_mode && !teamlink_sent) {
                                            let code = extract_party_code_from_text(message, server_code);
                                            if (code) set_teamlink_code(code, "message");
                                        }
                                        if (message.includes("blacklisted")) {
                                            console.log(`Socket BLACKLISTED`);
                                            rejoin = false;
                                        } else if (message.includes("temporarily")) {
                                            console.log(`Socket BANNED in ${url}`);
                                            rejoin = false;
                                        } else if (message.includes("cooldown")) {
                                            console.log(`Socket RATE LIMITED in ${url}`);
                                        } else if (message.includes("private")) {
                                            console.log(`Socket tried to join a PRIVATE SERVER in ${url}`);
                                            rejoin = false;
                                        } else if (message.includes("review"))  {
                                            console.log(`Socket is UNDER REVIEW in ${url}`);
                                            rejoin = false;
                                        } else if (message.includes("closed")) {
                                            console.log(`Socket tried to join a CLOSED SERVER in ${url}`);
                                        } else if (message.includes("destroyed")) {
                                            console.log(`Socket tried to join a SIEGE SERVER WITH SANCTUARIES DESTROYED in ${url}`);
                                        } else if (message.includes("timed")) {
                                            console.log(`Socket TIMED OUT in ${url}`);
                                            connection_count += 1;
                                        } else {
                                            console.log(`Socket KICKED in ${url}`);
                                        }
                                    break;
                                }
                                message_packet = [];
                                new_packet_message = false;
                            }
                            let decoded_value = (value ^ xor) & 255;
                            message_packet.push(decoded_value);
                        }
                    },  
                    (index, slice) => {
                        if (u8[index] == 84) {
                            let new_message = "This blocks analytics packet data.";
                            if (new_message.length > slice - 4) {
                                new_message = new_message.slice(0, slice - 4);
                            } else {
                                while (new_message.length < slice - 4) new_message += "/";
                            }
                            new_message = new TextEncoder().encode(new_message);
                            u8.set(new_message, index + 4);
                            return 0;
                        };
                        if (u8[index] == 67) {
                            u8[index] = 112;
                            current_move = u8[index + slice - 1];
                            let facing = target.pathfinding_facing ? target.pathfinding_facing : target.facing;
                            u8.set(new Uint8Array([67, facing[0], facing[1], get_effective_move_flags()]), 0);
                            return 4;
                        };
                        let new_packet = packet_queue.pop();
                        if (new_packet) {
                            u8.set(new_packet, 0);
                            return new_packet.byteLength; 
                        } else if (normal_bot_mode && bot_upgraded && !upgrade_data.autospin) {
                            let facing = target.pathfinding_facing ? target.pathfinding_facing : target.facing;
                            u8.set(new Uint8Array([67, facing[0], facing[1], get_effective_move_flags()]), 0);
                            return 4;
                        };
                    }, 
                    // Created this import to allow for memory modification of the incoming packets
                    // Just deleted since it is unnecessary for headless lb bots
                    () => {}
                ]
            ]
            let g;
            let f;
            let u8;
            let key_press;
            let key_up;
            let rejoin = true;
            let client_opened = false;
            let mockup_data;
            let broadcast_data;
            let update_data;
            let player_tab_data;
            let room_data;
            let maze_map_manager_data;
            let active_socket = null;
            let mapper_mockup_names = {};
            let message_packet = [];
            let encoded_packet;
            let decoded_packet;
            let new_packet_message = false;
            let packet_queue = [];
            let observer_packet_encoder = new TextEncoder();
            let observer_known_players = {};
            let last_observer_snapshot_at = 0;
            let first_server_packet_sent = false;
            let current_move;
            let keys = {
                "w": ['KeyW', 87],
                "s": ['KeyS', 83],
                "d": ['KeyD', 68],
                "a": ['KeyA', 65]
            };
            let stat_points_utilized = false;
            let ranges = {
                x: false,
                y: false
            };
            let bot_upgraded = false;
            let bot_upgrade_started = false;
            let bot_autofire_active = false;
            let has_spawned_once = false;
            let return_pathfinding_active = false;
            let stat_target_waiting = false;
            let stat_target_last_signature = "";
            let stat_target_last_queue_at = 0;
            let bot_node_data = false;
            let movement_interval;
            let upgrade_checker_interval;
            let target = {
                x: 0,
                y: 0,
                facing: 0,
                shooting: false,
                pathfinding_facing: false,
                node_data: false,
                target_path: []
            };
            let mapper_step_index = 0;
            let mapper_last_signature = "";
            let mapper_last_changed_at = 0;
            let mapper_last_action_at = 0;
            let mapper_wait_start_at = 0;
            let mapper_waiting_for_update = false;
            let mapper_pre_action_signature = "";
            let mapper_sent_result = false;
            let mapper_started_at = 0;
            let mapper_complete_since = 0;

            function normalize_mapper_tank_name(name) {
                return String(name || "").trim();
            }

            function is_mapper_mockup_name_char(value) {
                return Number.isInteger(value) && value >= 32 && value <= 126;
            }

            function remember_mapper_mockup_name(mockup_id, raw_name) {
                if (!Number.isInteger(mockup_id)) return;
                let cleaned_name = normalize_mapper_tank_name(String(raw_name || "").split("/")[0]);
                if (cleaned_name.length < 2) return;
                mapper_mockup_names[mockup_id] = cleaned_name;
            }

            function remember_mapper_mockup_packet(packet) {
                let values = Array.from(packet || []);
                if (!values.length) return;
                let current = "";
                let flush = end_index => {
                    if (current.length > 2) {
                        let mockup_id = values[end_index - current.length - 2];
                        remember_mapper_mockup_name(mockup_id, current);
                    }
                    current = "";
                };
                for (let index = 0; index < values.length; index++) {
                    let value = values[index];
                    if (is_mapper_mockup_name_char(value) && value !== 0) {
                        current += String.fromCharCode(value);
                    } else {
                        flush(index);
                    }
                }
                flush(values.length);
            }

            function resolve_mapper_mockup_name(mockup_id) {
                if (mockup_id === undefined || mockup_id === null) return "";
                return normalize_mapper_tank_name(mockup_data?.mockups?.[mockup_id]?.name || mapper_mockup_names[mockup_id] || "");
            }

            function get_mapper_current_tank_snapshot() {
                let player = update_data?.player || {};
                let mockup_id = player.mockup_id ?? null;
                let mockup = mockup_id === null ? null : mockup_data?.mockups?.[mockup_id] || null;
                return {
                    id: mockup_id,
                    name: resolve_mapper_mockup_name(mockup_id),
                    shape: mockup?.shape ?? null,
                    color: mockup?.color ?? player.color ?? null,
                    real_id: mockup?.real_id ?? null
                };
            }

            function get_mapper_upgrade_slots() {
                let upgrades = Array.from(update_data?.player?.upgrades || []);
                return upgrades.map((token, slot) => {
                    let mockup = mockup_data?.mockups?.[token] || null;
                    return {
                        slot,
                        token,
                        name: resolve_mapper_mockup_name(token),
                        send_packet: [85, slot]
                    };
                });
            }

            function get_mapper_signature() {
                let tank = get_mapper_current_tank_snapshot();
                let slots = get_mapper_upgrade_slots();
                return `${tank.id ?? ""}|${tank.name}|${slots.map(slot => `${slot.slot}:${slot.token}:${slot.name}`).join(",")}`;
            }

            function emit_upgrade_mapper_result(reason = "complete") {
                if (mapper_sent_result) return;
                mapper_sent_result = true;
                let slots = get_mapper_upgrade_slots();
                parentPort.postMessage({
                    type: "upgrade_mapper_result",
                    path: mapper_path,
                    current_tank: get_mapper_current_tank_snapshot(),
                    slots,
                    terminal: slots.length === 0,
                    reason,
                    elapsed_ms: mapper_started_at ? Date.now() - mapper_started_at : 0
                });
                stop_requested = true;
                setTimeout(() => {
                    try {
                        if (active_socket && active_socket.readyState === WebSocket.OPEN) active_socket.close();
                    } catch (_) {}
                }, 50);
            }

            function maybe_emit_upgrade_mapper_result(reason = "complete", now = Date.now()) {
                if (reason === "complete" && mapper_path.length) {
                    let tank = get_mapper_current_tank_snapshot();
                    if (tank.id != null && !tank.name) {
                        if (!mapper_complete_since) mapper_complete_since = now;
                        if (now - mapper_complete_since < mapper_name_timeout_ms) return false;
                        reason = "complete_missing_name";
                    }
                }
                emit_upgrade_mapper_result(reason);
                return true;
            }

            function handle_upgrade_mapper_tick(player) {
                if (!upgrade_mapper_mode || mapper_sent_result || !player || player.id == null) return;
                let now = Date.now();
                if (!mapper_started_at) {
                    mapper_started_at = now;
                    mapper_wait_start_at = now;
                    mapper_last_changed_at = now;
                    mapper_last_signature = get_mapper_signature();
                }
                let signature = get_mapper_signature();
                if (signature !== mapper_last_signature) {
                    mapper_last_signature = signature;
                    mapper_last_changed_at = now;
                }
                if (now - mapper_started_at > mapper_total_timeout_ms) {
                    emit_upgrade_mapper_result("timeout");
                    return;
                }
                if (mapper_waiting_for_update) {
                    if (signature !== mapper_pre_action_signature && now - mapper_last_changed_at >= mapper_stable_ms) {
                        mapper_waiting_for_update = false;
                        mapper_wait_start_at = now;
                    } else if (now - mapper_last_action_at > mapper_step_timeout_ms) {
                        emit_upgrade_mapper_result("step_timeout");
                    }
                    return;
                }
                if (mapper_step_index < mapper_path.length) {
                    if (now - mapper_last_changed_at < mapper_stable_ms) return;
                    let slots = get_mapper_upgrade_slots();
                    let desired_slot = mapper_path[mapper_step_index];
                    if (!Number.isFinite(desired_slot) || desired_slot < 0 || desired_slot >= slots.length) {
                        if (now - mapper_wait_start_at < mapper_step_timeout_ms) return;
                        emit_upgrade_mapper_result("invalid_path");
                        return;
                    }
                    mapper_pre_action_signature = signature;
                    mapper_last_action_at = now;
                    mapper_waiting_for_update = true;
                    mapper_step_index += 1;
                    packet_queue.push(packet_constructors.construct_tank_upgrade_packet(desired_slot));
                    return;
                }
                if (mapper_path.length === 0 && !get_mapper_upgrade_slots().length && now - mapper_started_at < mapper_step_timeout_ms) return;
                if (packet_queue.length === 0 && now - mapper_last_changed_at >= mapper_stable_ms) {
                    maybe_emit_upgrade_mapper_result("complete", now);
                }
            }

            function clear_runtime_intervals() {
                if (movement_interval) {
                    clearInterval(movement_interval);
                    movement_interval = undefined;
                }
                if (upgrade_checker_interval) {
                    clearInterval(upgrade_checker_interval);
                    upgrade_checker_interval = undefined;
                }
            }

            function clear_pathfinding_state() {
                bot_node_data = false;
                target.node_data = false;
                target.target_path = [];
                target.pathfinding_facing = false;
            }

            function is_bot_pathfinding_active() {
                return bot_pathfind || return_pathfinding_active;
            }

            function activate_return_pathfinding() {
                if (!normal_bot_mode || bot_pathfind || !server_has_maze) return;
                return_pathfinding_active = true;
            }

            function maybe_stop_return_pathfinding(dist) {
                if (!return_pathfinding_active || bot_pathfind) return;
                let close_enough = Number.isFinite(dist) && dist <= (followbot_config.dist || 60);
                let same_node = bot_node_data && target.node_data
                    && bot_node_data[0] === target.node_data[0]
                    && bot_node_data[1] === target.node_data[1];
                if (!close_enough && !same_node) return;
                return_pathfinding_active = false;
                clear_pathfinding_state();
            }

            function set_bot_pathfinding_enabled(enabled) {
                bot_pathfind = !!enabled;
                if (!is_bot_pathfinding_active()) clear_pathfinding_state();
            }

            function queue_missing_stat_target_packets(player) {
                if (!normal_bot_mode || !Array.isArray(upgrade_data.stat_targets) || !upgrade_data.stat_targets.length) return false;
                if (!player?.stats || !Number.isFinite(player.stat_points) || player.stat_points <= 0) return false;
                let signature = `${player.stat_points}:${upgrade_data.stat_targets.map(target => {
                    let stat_index = Array.isArray(target) ? Number.parseInt(target[0], 10) : -1;
                    let stat = player.stats[stat_index];
                    return `${stat_index}:${stat?.value ?? ""}:${stat?.max ?? ""}`;
                }).join("|")}`;
                if (stat_target_waiting) {
                    if (signature === stat_target_last_signature && Date.now() - stat_target_last_queue_at < 750) return true;
                    stat_target_waiting = false;
                }
                if (packet_queue.length) return true;
                let points = player.stat_points;
                let queued = false;
                for (let target of upgrade_data.stat_targets) {
                    if (!Array.isArray(target) || target.length < 2 || points <= 0) continue;
                    let stat_index = Number.parseInt(target[0], 10);
                    let target_value = Number.parseInt(target[1], 10);
                    let stat = player.stats[stat_index];
                    if (!Number.isFinite(stat_index) || !Number.isFinite(target_value) || !stat) continue;
                    let current_value = Number.isFinite(stat.value) ? stat.value : 0;
                    let max_value = Number.isFinite(stat.max) ? stat.max : target_value;
                    let needed = Math.min(target_value, max_value) - current_value;
                    if (needed <= 0) continue;
                    let amount = Math.min(needed, points);
                    packet_queue.unshift(packet_constructors.construct_stat_upgrade_packet(stat_index, amount));
                    points -= amount;
                    queued = true;
                }
                if (queued) {
                    stat_target_waiting = true;
                    stat_target_last_signature = signature;
                    stat_target_last_queue_at = Date.now();
                }
                return queued;
            }

            function sync_bot_autofire_toggle() {
                if (!normal_bot_mode || !upgrade_data.autofire) return;
                if (!bot_upgraded && !bot_upgrade_started) return;
                let desired_autofire = upgrade_data.autofire_forced === true || bot_autofire_enabled;
                if (bot_autofire_active === desired_autofire) return;
                packet_queue.push(upgrade_data.autofire);
                bot_autofire_active = desired_autofire;
            }

            function get_effective_move_flags() {
                let flags = Number.isFinite(current_move) ? current_move : 0;
                if (bot_copy_shooting && !bot_autofire_active) {
                    if (target.shooting) flags |= SHOOTING_MOVE_FLAG;
                    else flags &= ~SHOOTING_MOVE_FLAG;
                }
                return flags;
            }

            function apply_live_settings(settings = {}) {
                if (settings.pathfinding != null) set_bot_pathfinding_enabled(settings.pathfinding);
                if (settings.copyShooting != null) bot_copy_shooting = !!settings.copyShooting;
                if (settings.autofire != null) {
                    bot_autofire_enabled = !!settings.autofire;
                    sync_bot_autofire_toggle();
                }
            }

            function sync_visible_entities_from_update(packet, offsets, encoded_packet) {
                if (!update_data || !packet || packet.length <= 5) return;
                let offset = packet.indexOf(-1, 4);
                if (offset === -1) return;
                offset += 1;
                while (packet[offset] !== -1) offset++;
                offset += 1;
                while (offset < packet.length - 1) {
                    let id = packet[offset++];
                    let result = update_data.parse_entity(packet, offset, id, offsets, encoded_packet);
                    if (id == update_data.player.id) {
                        result[0].x = update_data.player.x;
                        result[0].y = update_data.player.y;
                        update_data.player.entity_data = result[0];
                    }
                    update_data.entities[id] = result[0];
                    offset = result[1];
                }
            }

            function emit_observer_snapshot(force = false) {
                if (!observer_mode || !broadcast_data) return;
                let now = Date.now();
                if (!force && now - last_observer_snapshot_at < observer_snapshot_interval) return;
                let team_minimap = [];
                for (let id in broadcast_data.team_minimap) {
                    let entry = broadcast_data.team_minimap[id];
                    team_minimap.push({
                        id: String(id),
                        x: entry.x,
                        y: entry.y,
                        color: entry.color
                    });
                }
                let visible_team_players = [];
                for (let id in update_data?.entities || {}) {
                    if (String(id) === String(update_data?.player?.id ?? "")) continue;
                    if (!broadcast_data.team_minimap[id]) continue;
                    let entity = update_data.entities[id];
                    if (!entity) continue;
                    observer_known_players[id] = {
                        id: String(id),
                        name: entity.name ?? observer_known_players[id]?.name ?? "",
                        score: entity.score ?? observer_known_players[id]?.score ?? null,
                        mockup_id: entity.mockup_id ?? observer_known_players[id]?.mockup_id,
                        color: entity.color ?? observer_known_players[id]?.color,
                        last_seen_at: now
                    };
                    visible_team_players.push({
                        id: String(id),
                        x: entity.x,
                        y: entity.y,
                        size: entity.size,
                        color: entity.color,
                        score: entity.score,
                        name: entity.name ?? "",
                        mockup_id: entity.mockup_id
                    });
                }
                let player_tab = [];
                for (let id in player_tab_data?.players || {}) {
                    let entry = player_tab_data.players[id];
                    observer_known_players[id] = {
                        id: String(id),
                        name: entry.name ?? observer_known_players[id]?.name ?? "",
                        score: observer_known_players[id]?.score ?? null,
                        mockup_id: entry.mockup_index ?? observer_known_players[id]?.mockup_id,
                        color: observer_known_players[id]?.color,
                        last_seen_at: observer_known_players[id]?.last_seen_at ?? now
                    };
                    player_tab.push({
                        id: String(id),
                        name: entry.name ?? "",
                        tier: entry.tier,
                        mockup_index: entry.mockup_index
                    });
                }
                for (let id in observer_known_players) {
                    if (now - (observer_known_players[id].last_seen_at || 0) > 30000) {
                        delete observer_known_players[id];
                    }
                }
                let known_players = [];
                for (let id in observer_known_players) {
                    known_players.push(observer_known_players[id]);
                }
                let payload = observer_packet_encoder.encode(JSON.stringify({
                    observer_id: String(writer),
                    team_code: url,
                    team_minimap,
                    visible_team_players,
                    player_tab,
                    known_players
                }));
                let packet = new Uint8Array(payload.length + 1);
                packet[0] = 6;
                packet.set(payload, 1);
                last_observer_snapshot_at = now;
                parentPort.postMessage([1, packet.buffer], [packet.buffer]);
            }

            parentPort.onmessage = function(e) {
                if (e.data && typeof e.data === "object") {
                    if (e.data.type === "settings") apply_live_settings(e.data);
                    return;
                }
                let coords_text = e.data;
                let coords = coords_text.split(",");
                target.x = parseFloat(coords[0]);
                target.y = parseFloat(coords[1]);
                target.focus_fire = !!parseInt(coords[4]);
                let node_offset = 5;
                if (coords.length === 6 || coords.length === 8) {
                    target.shooting = !!parseInt(coords[5]);
                    node_offset = 6;
                } else {
                    target.shooting = false;
                }
                if (!target.focus_fire) {
                    target.facing = [parseInt(coords[2]), parseInt(coords[3])];
                } else {
                    if (update_data) target.facing = yield_control_comps_from_angle(Math.atan2(target.y - update_data.player.y, target.x - update_data.player.x) + 0.00001 + Math.PI);
                }
                if (coords.length >= node_offset + 2) {
                    target.node_data = [parseInt(coords[node_offset]), parseInt(coords[node_offset + 1])];
                } else if (is_bot_pathfinding_active()) {
                    target.node_data = false;
                    target.target_path = [];
                };
            };
            async function create_wasm_instance() {
                f = (await WebAssembly.instantiate(compiled_module, m)).exports;
                g = f.c;
                f.b();
            };
            create_wasm_instance();
    })();
};

let compiled_module;
(async () => {
    compiled_module = await WebAssembly.compile(await fs.readFile(path.resolve(__dirname, './bot.wasm')));
    create_bot(server_code, proxy, 0);
})();
