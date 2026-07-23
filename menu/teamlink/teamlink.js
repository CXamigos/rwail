const fs = require("fs");
const path = require("path");
const { Worker } = require("worker_threads");

const default_user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
const team_color_names = {
    0: "blue",
    1: "green",
    10: "blue",
    11: "green",
    12: "red",
    14: "purple",
    15: "purple"
};

function resolve_team_color_name(color_id) {
    if (!Number.isFinite(color_id)) return "unknown";
    return team_color_names[color_id] || "unknown";
}

function extract_server_code(input) {
    if (!input) return null;
    let trimmed = String(input).trim();
    if (!trimmed) return null;
    let hash_index = trimmed.lastIndexOf("#");
    let code = hash_index >= 0 ? trimmed.slice(hash_index + 1) : trimmed;
    code = code.trim().replace(/^\/+/, "");
    if (!code) return null;
    let match = code.match(/^([a-z0-9]+?)(\d{4,6})$/i);
    if (match) return match[1].toLowerCase();
    if (/^[a-z0-9]{32,}$/i.test(code)) {
        if (/^[aceow][pq][a-z0-9]/i.test(code)) return code.slice(0, 3).toLowerCase();
        if (/^[aceow][a-z0-9]/i.test(code)) return code.slice(0, 2).toLowerCase();
    }
    return code.toLowerCase();
}

function print_usage() {
    console.error("Usage: node teamlink.js <arras server url or hash>");
    console.error("Example: node teamlink.js https://arras.io/#eb");
}

function load_proxies_from_bljs() {
    try {
        let content = fs.readFileSync(path.resolve(__dirname, "bl.js"), "utf8");
        let match = content.match(/let\s+proxies\s*=\s*\[([\s\S]*?)\];/);
        if (!match) return [];
        let proxies = [];
        let regex = /["']([^"']+)["']/g;
        let entry;
        while ((entry = regex.exec(match[1])) !== null) {
            proxies.push(entry[1]);
        }
        return proxies;
    } catch (err) {
        return [];
    }
}

function load_game_modes_from_script() {
    try {
        let content = fs.readFileSync(path.resolve(__dirname, "script.js"), "utf8");
        let regex = /\{\s*key:\s*"([^"]+)"\s*,\s*label:\s*"([^"]+)"\s*\}/g;
        let modes = [];
        let match;
        while ((match = regex.exec(content)) !== null) {
            modes.push({ key: match[1], label: match[2] });
        }
        return modes;
    } catch (err) {
        return [];
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

const game_modes = load_game_modes_from_script();
const sorted_modes = [...game_modes].sort((a, b) => b.key.length - a.key.length);
const mode_team_map = new Map();

function infer_team_count_from_label(label) {
    if (!label) return null;
    let lower = String(label).toLowerCase();
    if (lower.includes("labyrinth")) return 4;
    if (lower.includes("assault")) return 2;
    if (/\bffa\b/.test(lower)) return 0;
    if (/(sandbox|testing|test|nexus|limbo)/.test(lower)) return 0;
    if (/(4\s*tdm|4\s*teams)/.test(lower)) return 4;
    if (/(3\s*tdm|3\s*teams)/.test(lower)) return 3;
    if (/(2\s*tdm|2\s*teams)/.test(lower)) return 2;
    return null;
}

for (let mode of game_modes) {
    let count = infer_team_count_from_label(mode.label);
    if (Number.isFinite(count)) {
        mode_team_map.set(mode.key.toLowerCase(), count);
    }
}

function match_team_count_from_keys(text) {
    if (!text) return null;
    let lower = String(text).toLowerCase();
    for (let mode of sorted_modes) {
        let key = mode.key.toLowerCase();
        if (!mode_team_map.has(key)) continue;
        if (lower === key) return mode_team_map.get(key);
        let tokens = lower.split(/[^a-z0-9]+/i);
        if (tokens.includes(key)) return mode_team_map.get(key);
        let regex = new RegExp(`(?:^|[^a-z0-9])${key}(?:[^a-z0-9]|$)`);
        if (regex.test(lower)) return mode_team_map.get(key);
    }
    return null;
}

function extractGameModeFromCode(code = "") {
    if (!code || typeof code !== "string") return "Unknown";
    const lower = code.toLowerCase();

    for (const mode of sorted_modes) {
        if (lower === mode.key.toLowerCase()) return mode.label;
    }

    const tokens = lower.split(/[^a-z0-9]+/i);
    for (const token of tokens) {
        for (const mode of sorted_modes) {
            if (token === mode.key.toLowerCase()) return mode.label;
        }
    }

    for (const mode of sorted_modes) {
        const regex = new RegExp(`(?:^|[^a-z0-9])${mode.key.toLowerCase()}(?:[^a-z0-9]|$)`);
        if (regex.test(lower)) return mode.label;
    }

    const modifierMap = {
        g: "Growth",
        a: "Arms Race",
        p: "Portal",
        o: "Open",
        m: "Maze",
    };
    const teamMap = {
        f: "FFA",
        d: "Duos",
        s: "Squads",
        c: "Clan Wars",
        1: "1TDM",
        2: "2TDM",
        3: "3TDM",
        4: "4TDM",
    };
    const winMap = {
        d: "Domination",
        m: "Mothership",
        a: "Assault",
        s: "Siege",
        t: "Tag",
        p: "Pandemic",
        b: "Soccer",
        g: "Grudge Ball",
        e: "Elimination",
        c: "Capture the Flag",
        z: "Sandbox",
    };

    const chars = lower.replace(/[^a-z0-9]/gi, "").split("");
    const mods = [];
    let team = null;
    let win = null;

    for (const char of chars) {
        if (!team && teamMap[char]) {
            team = teamMap[char];
        } else if (!win && winMap[char]) {
            win = winMap[char];
        } else if (modifierMap[char] && !mods.includes(modifierMap[char])) {
            mods.push(modifierMap[char]);
        }
    }

    const dynamicLabel = [...mods, team, win].filter(Boolean).join(" ");

    const fallbackMatch = sorted_modes.find((mode) =>
        lower.includes(mode.key.toLowerCase())
    );
    if (fallbackMatch) return fallbackMatch.label;

    return dynamicLabel || "Unknown";
}

function determine_team_count(fields, server_code, game_data) {
    let numeric_keys = ["teams", "team", "teamcount", "team_count", "maxTeams", "max_teams", "maxTeam", "max_team"];
    for (let key of numeric_keys) {
        if (fields[key] != null) {
            let value = parseInt(fields[key], 10);
            if (Number.isFinite(value)) return value;
        }
    }

    let mode_raw = [
        fields.mode,
        fields.gamemode,
        fields.type,
        fields.code,
        fields.name,
        server_code,
        game_data
    ].filter(Boolean).join(" ");
    let lower = mode_raw.toLowerCase();

    let label_guess = extractGameModeFromCode(mode_raw);
    let label_count = infer_team_count_from_label(label_guess);
    if (Number.isFinite(label_count)) return label_count;

    let key_count = match_team_count_from_keys(mode_raw);
    if (Number.isFinite(key_count)) return key_count;

    if (/\b(ffa|sandbox|test|testing|nexus|limbo|training|survival)\b/.test(lower)) return 0;
    if (lower.includes("labyrinth")) return 4;
    if (lower.includes("assault")) return 2;

    if (fields.mode) {
        let mode = String(fields.mode).toLowerCase();
        if (/^[234]$/.test(mode)) return parseInt(mode, 10);
        if (/^[234][a-z]/.test(mode)) return parseInt(mode[0], 10);
    }

    let match = lower.match(/([234])\s*(tdm|team|teams)/);
    if (match) return parseInt(match[1], 10);
    match = lower.match(/([234])tdm/);
    if (match) return parseInt(match[1], 10);

    let tokens = lower.split(/[^a-z0-9]+/).filter(Boolean);
    for (let token of tokens) {
        if (token.includes("ffa")) continue;
        if (token.endsWith("f") && !/[234]/.test(token)) continue;
        let digit_match = token.match(/([234])(?!\d)/);
        if (digit_match) return parseInt(digit_match[1], 10);
    }

    return 0;
}

function derive_mode_label(fields, game_data, server_code) {
    let candidates = [fields.mode, fields.gamemode, fields.type, fields.code, fields.name];
    let label = candidates.find((value) => value && value.trim());
    if (label) return label;
    if (game_data && game_data.trim()) return game_data.trim();
    return server_code || "unknown";
}

function resolve_mode_label(fields, game_data, server_code) {
    if (sorted_modes.length === 0) {
        return derive_mode_label(fields, game_data, server_code);
    }
    let mode_raw = [
        fields.mode,
        fields.gamemode,
        fields.type,
        fields.code,
        fields.name,
        server_code,
        game_data
    ].filter(Boolean).join(" ");
    let label = extractGameModeFromCode(mode_raw);
    if (label && label !== "Unknown") return label;
    return derive_mode_label(fields, game_data, server_code);
}

let args = process.argv.slice(2);
let debug = false;
let progress = false;
let input = null;
for (let arg of args) {
    if (arg === "--debug" || arg === "-v") {
        debug = true;
    } else if (arg === "--progress" || arg === "--stream") {
        progress = true;
    } else if (!input) {
        input = arg;
    }
}

let server_code = extract_server_code(input);
if (!server_code) {
    print_usage();
    process.exit(1);
}

let proxies = load_proxies_from_bljs();
if (proxies.length === 0) proxies = [""];
let proxy_states = proxies.map((proxy, index) => ({
    proxy,
    index,
    failures: 0,
    disabled: false
}));

const spawn_delay_ms = 1000;
const team_minimap_grace_ms = 2000;
const post_spawn_wait_ms = 3000;
const room_info_timeout_ms = 5000;
const round_timeout_ms = 45000;
const max_failures = 3;
const spawn_timeout_ms = 20000;

let round_index = 0;
const persistent_teams = new Map();
let persistent_expected_teams = null;
let persistent_mode_label = null;

function start_round() {
    round_index += 1;
    let active_proxies = proxy_states.filter((entry) => !entry.disabled);
    let target_bots = active_proxies.length;
    if (target_bots === 0) {
        console.error("No usable proxies left.");
        process.exit(1);
    }
    let workers = new Map();
    let teams = persistent_teams;
    let expected_teams = persistent_expected_teams;
    let mode_label = persistent_mode_label;
    let room_info_received = false;
    let spawn_count = 0;
    let done = false;
    let timers = [];
    let spawn_timers = [];
    let post_spawn_timer = null;

    function clear_timers() {
        for (let timer of timers) clearTimeout(timer);
        for (let timer of spawn_timers) clearTimeout(timer);
        timers = [];
        spawn_timers = [];
        if (post_spawn_timer) clearTimeout(post_spawn_timer);
        post_spawn_timer = null;
    }

    function cleanup() {
        clear_timers();
        for (let worker of workers.values()) worker.terminate();
        workers.clear();
    }

    function finish_with_no_teams() {
        console.log(`mode: ${mode_label || "unknown"}`);
        console.log("no_team_links");
        cleanup();
        process.exit(0);
    }

    function finish_success() {
        console.log(`mode: ${mode_label || "unknown"}`);
        if (Number.isFinite(expected_teams)) {
            console.log(`teams_expected: ${expected_teams}`);
        }
        let entries = Array.from(teams.values());
        entries.sort((a, b) => a.color_id - b.color_id);
        for (let entry of entries) {
            console.log(`team: ${entry.color_name} | players: ${entry.players} | link: ${entry.link}`);
        }
        cleanup();
        process.exit(0);
    }

    function restart_round(reason) {
        if (done) return;
        done = true;
        cleanup();
        if (debug && reason) console.error(`[round ${round_index}] restart: ${reason}`);
        setTimeout(start_round, 1000);
    }

    function maybe_finish() {
        if (done) return;
        if (Number.isFinite(expected_teams) && teams.size >= expected_teams) {
            done = true;
            finish_success();
        }
    }

    function maybe_start_post_spawn() {
        if (post_spawn_timer) return;
        if (spawn_count >= target_bots) {
            post_spawn_timer = setTimeout(() => {
                if (done) return;
                if (Number.isFinite(expected_teams)) {
                    if (teams.size >= expected_teams) {
                        done = true;
                        finish_success();
                    } else {
                        restart_round("missing teams after max bots");
                    }
                } else if (teams.size > 0) {
                    done = true;
                    finish_success();
                } else {
                    restart_round("no teams found after max bots");
                }
            }, post_spawn_wait_ms);
        }
    }

    function schedule_remaining_bots(start_index) {
        for (let i = start_index; i < active_proxies.length; i += 1) {
            let delay = (i - start_index + 1) * spawn_delay_ms;
            spawn_timers.push(setTimeout(() => {
                if (done) return;
                spawn_worker(i);
            }, delay));
        }
    }

    function handle_room_info(message) {
        if (room_info_received) return;
        room_info_received = true;
        let fields = message.fields || parse_game_data_fields(message.game_data);
        let resolved_mode = resolve_mode_label(fields, message.game_data, server_code);
        let resolved_expected = determine_team_count(fields, server_code, message.game_data);

        if (resolved_mode && resolved_mode !== "Unknown") {
            persistent_mode_label = resolved_mode;
        } else if (!persistent_mode_label) {
            persistent_mode_label = resolved_mode;
        }

        if (Number.isFinite(resolved_expected)) {
            if (!Number.isFinite(persistent_expected_teams)) {
                persistent_expected_teams = resolved_expected;
            } else if (persistent_expected_teams <= 1 && resolved_expected > 1) {
                persistent_expected_teams = resolved_expected;
            } else if (resolved_expected > persistent_expected_teams) {
                persistent_expected_teams = resolved_expected;
            }
        }

        mode_label = persistent_mode_label;
        expected_teams = persistent_expected_teams;

        if (debug) {
            console.error(`[round ${round_index}] mode: ${mode_label} teams=${expected_teams}`);
        }
        if (progress) {
            console.log(`mode: ${mode_label || "unknown"}`);
            if (Number.isFinite(expected_teams)) {
                console.log(`teams_expected: ${expected_teams}`);
            }
        }

        if (Number.isFinite(expected_teams) && expected_teams <= 1) {
            finish_with_no_teams();
            return;
        }

        schedule_remaining_bots(1);
        maybe_finish();
    }

    function handle_teamlink(message) {
        let color_id = message.color;
        if (teams.has(color_id)) {
            return;
        }
        let color_name = resolve_team_color_name(color_id);
        teams.set(color_id, {
            color_id,
            color_name,
            link: message.link,
            players: message.players
        });
        if (progress) {
            console.log(`team: ${color_name} | players: ${message.players} | link: ${message.link}`);
        }
        maybe_finish();
    }

    function handle_status(message) {
        if (message.status !== "spawned") return;
        spawn_count += 1;
        maybe_start_post_spawn();
        maybe_finish();
    }

    function spawn_worker(index) {
        if (index >= active_proxies.length) return;
        if (workers.has(index)) return;
        let entry = active_proxies[index];
        let proxy = entry.proxy || "";
        let worker_state = {
            spawned: false,
            failed: false,
            spawn_timer: null
        };
        let worker = new Worker(path.resolve(__dirname, "./bot_worker.js"), {
            workerData: {
                user_agent: default_user_agent,
                proxy,
                server_code,
                bot_name: "",
                bot_pathfind: false,
                followbot_config: null,
                writer: entry.index,
                options: { mode: "teamlink", debug, team_minimap_grace_ms }
            }
        });

        workers.set(index, worker);

        function register_failure(reason) {
            if (worker_state.failed) return;
            worker_state.failed = true;
            if (worker_state.spawn_timer) {
                clearTimeout(worker_state.spawn_timer);
                worker_state.spawn_timer = null;
            }
            if (!worker_state.spawned) {
                entry.failures += 1;
                target_bots = Math.max(0, target_bots - 1);
                if (target_bots === 0) {
                    restart_round("no usable proxies after failures");
                    return;
                }
                if (entry.failures >= max_failures && !entry.disabled) {
                    entry.disabled = true;
                }
                maybe_start_post_spawn();
                maybe_finish();
            } else {
                entry.failures += 1;
                if (entry.failures >= max_failures && !entry.disabled) {
                    entry.disabled = true;
                }
            }
            if (debug && reason) {
                console.error(`[bot ${entry.index}] fail: ${reason}`);
            }
        }

        worker_state.spawn_timer = setTimeout(() => {
            if (done) return;
            if (!worker_state.spawned && !worker_state.failed) {
                register_failure("spawn timeout");
                worker.terminate();
            }
        }, spawn_timeout_ms);

        worker.on("message", (message) => {
            if (!message || typeof message !== "object") return;
            if (message.type === "room_info") {
                handle_room_info(message);
            } else if (message.type === "teamlink") {
                handle_teamlink(message);
            } else if (message.type === "status") {
                worker_state.spawned = true;
                if (worker_state.spawn_timer) {
                    clearTimeout(worker_state.spawn_timer);
                    worker_state.spawn_timer = null;
                }
                handle_status(message);
            } else if (message.type === "debug" && debug) {
                console.error(`[bot ${entry.index}] [debug:${message.event}] ${message.value}`);
            } else if (message.type === "error") {
                if (debug) console.error(`[bot ${entry.index}] error: ${message.message || "unknown"}`);
                if (!worker_state.spawned) {
                    register_failure("error before spawn");
                }
            }
        });

        worker.on("error", (err) => {
            if (debug) console.error(`[bot ${entry.index}] ${err.message || String(err)}`);
            if (!worker_state.spawned) {
                register_failure("worker error");
            }
        });

        worker.on("exit", (code) => {
            if (debug) console.error(`[bot ${entry.index}] exited with code ${code}`);
            if (!worker_state.spawned) {
                register_failure("worker exit");
            }
        });
    }

    spawn_worker(0);

    timers.push(setTimeout(() => {
        if (done || room_info_received) return;
        schedule_remaining_bots(1);
    }, room_info_timeout_ms));

    timers.push(setTimeout(() => {
        if (done) return;
        restart_round("round timeout");
    }, round_timeout_ms));
}

start_round();
