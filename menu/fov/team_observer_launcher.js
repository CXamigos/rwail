const path = require('path');
const fs = require('fs').promises;
const { Worker } = require('worker_threads');
const readline = require('readline/promises');
const { stdin, stdout } = require('process');
const WebSocket = require('ws');

const DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
const DEFAULT_UPDATE_RATE = 100;
const OBSERVER_TANK_PATH = [1, 0, 0, 0];

function build_observer_tank_upgrade_packets() {
    // bot_worker drains packet_queue with pop(), so tank upgrades must be queued in reverse.
    return OBSERVER_TANK_PATH.slice().reverse().map(upgrade => new Uint8Array([85, upgrade]));
}

function parse_team_code(raw_value) {
    let value = String(raw_value || "").trim();
    if (!value.length) return "";
    try {
        if (/^https?:\/\//i.test(value)) {
            let parsed = new URL(value);
            if (parsed.hash.length > 1) return parsed.hash.slice(1).trim();
        }
    } catch (error) {}
    if (value.startsWith("#")) return value.slice(1).trim();
    let hash_index = value.indexOf("#");
    if (hash_index !== -1) return value.slice(hash_index + 1).trim();
    return value;
}

async function load_observer_config() {
    let source = await fs.readFile(path.resolve(__dirname, "./bl.js"), "utf8");
    let proxies_match = source.match(/let proxies = \[([\s\S]*?)\];\s*\/\/ Input rate/);
    if (!proxies_match) throw Error("Could not read the proxy list from bl.js.");
    let proxies = Function(`"use strict"; return [${proxies_match[1]}];`)();
    let user_agent_match = source.match(/let user_agent = "([^"]*)";/);
    let update_rate_match = source.match(/let update_rate = (\d+);/);
    let use_self_ip = /let use_self_IP_as_bot = true;/.test(source);
    if (use_self_ip) proxies.push("");
    return {
        proxies: proxies.filter(proxy => typeof proxy === "string"),
        user_agent: user_agent_match ? user_agent_match[1] : DEFAULT_USER_AGENT,
        update_rate: update_rate_match ? Number(update_rate_match[1]) : DEFAULT_UPDATE_RATE
    };
}

async function prompt_team_links() {
    let rl = readline.createInterface({
        input: stdin,
        output: stdout
    });
    try {
        return await rl.question("Input team links (comma separated): ");
    } finally {
        rl.close();
    }
}

function wait_for_socket_open(socket) {
    return new Promise((resolve, reject) => {
        let finished = false;
        let cleanup = () => {
            socket.off("open", on_open);
            socket.off("error", on_error);
        };
        let on_open = () => {
            if (finished) return;
            finished = true;
            cleanup();
            resolve();
        };
        let on_error = error => {
            if (finished) return;
            finished = true;
            cleanup();
            reject(error);
        };
        socket.on("open", on_open);
        socket.on("error", on_error);
    });
}

async function ensure_node_can_run_bot_workers() {
    try {
        await WebAssembly.compile(await fs.readFile(path.resolve(__dirname, "./bot.wasm")));
    } catch (error) {
        throw Error(`This Node build (${process.version}) cannot run the bot workers in this project. Please use a newer Node release with the required WebAssembly support, preferably Node 22+. Original error: ${error.message}`);
    }
}

(async () => {
    await ensure_node_can_run_bot_workers();
    let raw_input = await prompt_team_links();
    let team_codes = Array.from(new Set(raw_input.split(",").map(parse_team_code).filter(Boolean)));
    if (!team_codes.length) throw Error("No valid team links were provided.");

    let { proxies, user_agent, update_rate } = await load_observer_config();
    if (team_codes.length > proxies.length) {
        throw Error(`Need at least ${team_codes.length} proxies for ${team_codes.length} team links, but only found ${proxies.length}.`);
    }

    let relay_socket = new WebSocket("ws://localhost:8080");
    relay_socket.binaryType = "arraybuffer";
    await wait_for_socket_open(relay_socket);

    let workers = [];
    let shutting_down = false;

    let shutdown = async exit_code => {
        if (shutting_down) return;
        shutting_down = true;
        for (let worker of workers) {
            try {
                await worker.terminate();
            } catch (error) {}
        }
        if (relay_socket.readyState === WebSocket.OPEN || relay_socket.readyState === WebSocket.CONNECTING) {
            relay_socket.close();
        }
        process.exit(exit_code);
    };

    relay_socket.on("close", () => {
        console.error("The local relay ws://localhost:8080 closed unexpectedly.");
        shutdown(1);
    });

    relay_socket.on("error", error => {
        console.error(`The local relay ws://localhost:8080 failed: ${error.message}`);
    });

    process.on("SIGINT", () => shutdown(0));
    process.on("SIGTERM", () => shutdown(0));

    for (let index = 0; index < team_codes.length; index++) {
        let team_code = team_codes[index];
        let worker = new Worker(path.resolve(__dirname, "./bot_worker.js"), {
            workerData: {
                user_agent,
                proxy: proxies[index],
                server_code: team_code,
                upgrade_data: {
                    tanks: build_observer_tank_upgrade_packets(),
                    stats: [],
                    growth_extended_upgrades_order_to_max: [],
                    pathfinding_facing_angle_offset: 0
                },
                bot_name: "",
                bot_pathfind: false,
                followbot_config: {},
                writer: index,
                mode: "observer",
                observer_snapshot_interval: update_rate
            }
        });

        worker.on("message", data => {
            if (data[0] == 0) {
                console.error(`Observer bot #${index} failed for #${team_code}.`);
                worker.terminate().catch(() => {});
                return;
            }
            if (relay_socket.readyState === WebSocket.OPEN) {
                relay_socket.send(data[1]);
            }
        });

        worker.on("error", error => {
            console.error(`Observer bot #${index} crashed for #${team_code}: ${error.message}`);
        });

        worker.on("exit", code => {
            if (!shutting_down && code !== 0) {
                console.error(`Observer bot #${index} exited with code ${code} for #${team_code}.`);
            }
        });

        workers.push(worker);
        console.log(`Started observer bot #${index} for #${team_code}.`);
    }

    console.log(`Watching ${team_codes.length} team link(s). Keep this process running while you use the overlay.`);
})().catch(error => {
    console.error(error.message || error);
    process.exit(1);
});
