const path = require('path');
const { Worker } = require('worker_threads');
const fs = require('fs').promises;
const WebSocket = require('ws');

(async () => {
    let cliServerCode = (process.argv[2] || '').trim().replace(/^#/, '');
    // Input proxies
    const proxy = "1fiRasl1-ttl-0:ADL35LOraUbh6fA@datacenter-ww.lightningproxies.net:1338";
    let proxies = [proxy];
    // Input rate at which intervals for recieving and sending data are updated (in ms)
    let update_rate = 100;
    // Input bot names (not recommended for staying anonymous but here if wanted)
    let bot_names = [""];
    let bot_names_text = "";
    // Input if the random name generator function should be utilized
    let randomize_names = false;
    // Input UA
    let user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
    // Input bot count
    let bot_count = 30;
    // Input if bot can pathfind on maze maps
    let bot_pathfind = false;
    let bot_autofire = true;
    let bot_copy_shooting = false;
    // Input if your own IP is allowed for bot usage
    let use_self_IP_as_bot = false;
    // Input upgrade and stat paths for bots
    let bot_upgrades = [	
/*	    {
        tanks: [0, 0, 2],
        stats: [[0, 1], [1, 1], [2, 3], [3, 7], [4, 6], [5, 8], [6, 8], [7, 8]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: 0
    },
    {
        tanks: [0, 0, 3],
        stats: [[0, 1], [1, 1], [2, 3], [3, 7], [4, 6], [5, 8], [6, 8], [7, 8]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: 0
    },
    {
        tanks: [1, 2, 1],
        stats: [[0, 1], [1, 1], [2, 4], [3, 7], [4, 6], [5, 8], [6, 7], [7, 8]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: Math.PI
    },
	    {
        tanks: [0, 0, 0],
        stats: [[0, 1], [1, 1], [2, 3], [3, 7], [4, 6], [5, 8], [6, 8], [7, 8]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: 0
    },
		    {
        tanks: [7, 0, 1],
        stats: [[0, 1], [1, 1], [2, 3], [3, 7], [4, 6], [5, 8], [6, 8], [7, 8]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: 0
    },*/
	
  /*  {
        tanks: [0, 0, 2],
        stats: [[0, 1], [1, 2], [2, 3], [3, 8], [4, 7], [5, 8], [6, 9], [7, 4]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: 0
    },
    {
        tanks: [0, 0, 3],
        stats: [[0, 1], [1, 2], [2, 3], [3, 8], [4, 7], [5, 8], [6, 9], [7, 4]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: 0
    },
    {
        tanks: [1, 2, 1],
        stats: [[0, 1], [1, 2], [2, 5], [3, 8], [4, 6], [5, 8], [6, 7], [7, 5]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: Math.PI
    },
	    {
        tanks: [0, 0, 0],
        stats: [[0, 1], [1, 2], [2, 3], [3, 8], [4, 7], [5, 8], [6, 9], [7, 4]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: 0
    },
		    {
        tanks: [7, 0, 1],
        stats: [[0, 1], [1, 2], [2, 3], [3, 8], [4, 7], [5, 8], [6, 9], [7, 4]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: 0
    },*/
/*{
        tanks: [3, 1, 4, 1],
        stats: [[0, 1], [1, 1], [2, 2], [3, 8], [4, 6], [5, 8], [6, 9], [7, 7]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: 0
    },
    {
        tanks: [3, 1, 5, 0],
        stats: [[0, 1], [1, 1], [2, 2], [3, 8], [4, 6], [5, 8], [6, 9], [7, 7]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: 0
    },
    {
        tanks: [3, 1, 10, 8],
        stats: [[0, 1], [1, 1], [2, 8], [3, 6], [4, 8], [5, 9], [6, 9]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: 0
    },
    {
        tanks: [3, 1, 0, 5],
        stats: [[0, 1], [1, 1], [2, 2], [3, 8], [4, 6], [5, 8], [6, 9], [7, 7]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: 0
    },
    {
        tanks: [3, 1, 3, 5],
        stats: [[0, 1], [1, 1], [2, 2], [3, 8], [4, 6], [5, 8], [6, 9], [7, 7]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: 0
    },
    {
        tanks: [3, 1, 0, 4],
        stats: [[0, 1], [1, 1], [2, 2], [3, 8], [4, 6], [5, 8], [6, 9], [7, 7]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: 0
    },*/
/*	{
        tanks: [7, 3, 0],
        stats: [[0, 9], [1, 9], [2, 5], [3, 9], [4, 5], [5, 5]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: 0
    },
	{        tanks: [7, 3, 0],
        stats: [[0, 9], [1, 9], [2, 6], [3, 9], [4, 4], [5, 5]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: 0
    },
	{
	        tanks: [7, 3, 0],
        stats: [[0, 9], [1, 9], [2, 7], [3, 9], [4, 4], [5, 4]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: 0
    },*/
	

/*   {
        tanks: [5, 3, 5, 3],
        stats: [[2, 3], [3, 9], [4, 9], [5, 9], [6, 9],[7,3]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: Math.PI
    },
    {
        tanks: [0, 1, 5, 1],
        stats: [[2, 3], [3, 9], [4, 9], [5, 9], [6, 9],[7,3]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: Math.PI
    },
    {
        tanks: [3, 0, 0, 2],
         stats: [[2, 3], [3, 9], [4, 9], [5, 9], [6, 9],[7,3]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        autospin: true,
        pathfinding_facing_angle_offset: 0
    },
    {
        tanks: [5, 3, 5, 0],
        stats: [[2, 3], [3, 9], [4, 9], [5, 9], [6, 9],[7,3]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: Math.PI
    },
    {
        tanks: [0, 2, 1, 5],
        stats: [[2, 3], [3, 9], [4, 9], [5, 9], [6, 9],[7,3]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: Math.PI
    },
    {
        tanks: [3, 0, 5, 4],
        stats: [[2, 3], [3, 9], [4, 9], [5, 9], [6, 9],[7,3]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        autospin: true,
        pathfinding_facing_angle_offset: 0
    }, */

/*{
        tanks: [3, 1, 4, 1],
        stats: [[0, 2], [1, 2], [2, 2], [3, 8], [4, 6], [5, 8], [6, 9], [7, 5]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: 0
    },
    {
        tanks: [3, 1, 5, 0],
        stats: [[0, 2], [1, 2], [2, 2], [3, 8], [4, 6], [5, 8], [6, 9], [7, 5]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: 0
    },
    {
        tanks: [3, 1, 0, 5],
        stats: [[0, 2], [1, 2], [2, 2], [3, 8], [4, 6], [5, 8], [6, 9], [7, 5]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: 0
    },
    {
        tanks: [3, 1, 3, 5],
        stats: [[0, 2], [1, 2], [2, 2], [3, 8], [4, 6], [5, 8], [6, 9], [7, 5]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: 0
    },
    {
        tanks: [3, 1, 0, 4],
        stats: [[0, 2], [1, 2], [2, 2], [3, 8], [4, 6], [5, 8], [6, 9], [7, 5]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: 0
    }, 
*/
/*		    {
        tanks: [0],
        stats: [[7, 9]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: 0
    },
			    {
        tanks: [1],
        stats: [[7, 9]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: 0
    },
			    {
        tanks: [2],
        stats: [[7, 9]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: 0
    },
			    {
        tanks: [3],
        stats: [[7, 9]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: 0
    },
			    {
        tanks: [4],
        stats: [[7, 9]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: 0
    },
			    {
        tanks: [5],
        stats: [[7, 9]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: 0
    },*/
	
/*	    {
        tanks: [3, 1, 0, 0],
        stats: [[0, 2], [1, 2], [2, 2], [3, 8], [4, 6], [5, 8], [6, 9], [7, 5]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: 0
    },
    {
        tanks: [3, 1, 3, 8],
        stats: [[0, 2], [1, 2], [2, 2], [3, 8], [4, 6], [5, 8], [6, 9], [7, 5]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: 0
    },
    {
        tanks: [3, 1, 5, 4],
        stats: [[0, 2], [1, 2], [2, 2], [3, 8], [4, 6], [5, 8], [6, 9], [7, 5]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: 0
    },
    {
        tanks: [3, 1, 4, 0],
        stats: [[0, 2], [1, 2], [2, 2], [3, 8], [4, 6], [5, 8], [6, 9], [7, 5]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        pathfinding_facing_angle_offset: 0
    },*/
	

/*{
    tanks: [4, 2, 3, 0],
    stats: [[0, 8], [1, 8], [2, 9], [6, 9], [7, 9]],
    growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
    pathfinding_facing_angle_offset: 0
},
{
    tanks: [4, 2, 3, 3],
    stats: [[0, 8], [1, 8], [2, 9], [6, 9], [7, 9]],
    growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
    pathfinding_facing_angle_offset: 0
},
{
    tanks: [4, 2, 0, 0],
    stats: [[0, 8], [1, 8], [2, 9], [6, 9], [7, 9]],
    growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
    pathfinding_facing_angle_offset: 0
},
{
    tanks: [4, 2, 0, 4],
    stats: [[0, 8], [1, 8], [2, 9], [6, 9], [7, 9]],
    growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
    pathfinding_facing_angle_offset: 0
},
{
    tanks: [4, 2, 0, 2],
    stats: [[0, 8], [1, 8], [2, 9], [6, 9], [7, 9]],
    growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
    pathfinding_facing_angle_offset: 0
},
{
    tanks: [4, 2, 2, 1],
    stats: [[0, 8], [1, 8], [2, 9], [6, 9], [7, 9]],
    growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
    pathfinding_facing_angle_offset: 0
},
{
    tanks: [4, 2, 2, 5],
    stats: [[0, 8], [1, 8], [2, 9], [6, 9], [7, 9]],
    growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
    pathfinding_facing_angle_offset: 0
},
{
    tanks: [4, 2, 2, 4],
    stats: [[0, 8], [1, 8], [2, 9], [6, 9], [7, 9]],
    growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
    pathfinding_facing_angle_offset: 0
},
{
    tanks: [4, 2, 4, 1],
    stats: [[0, 8], [1, 8], [2, 9], [6, 9], [7, 9]],
    growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
    pathfinding_facing_angle_offset: 0
},
{
    tanks: [4, 2, 5, 3],
    stats: [[0, 8], [1, 8], [2, 9], [6, 9], [7, 9]],
    growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
    pathfinding_facing_angle_offset: 0
},*/

/*{
    tanks: [3, 1, 1],
    stats: [[6, 9], [7, 9]],
    growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
    pathfinding_facing_angle_offset: 0
},
{
    tanks: [3, 1, 0],
    stats: [[6, 9], [7, 9]],
    growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
    pathfinding_facing_angle_offset: 0
},
{
    tanks: [3, 1,4 ],
    stats: [[6, 9], [7, 9]],
    growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
    pathfinding_facing_angle_offset: 0
},
{
    tanks: [3, 1, 5],
    stats: [[6, 9], [7, 9]],
    growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
    pathfinding_facing_angle_offset: 0
},*/

 /*   {
        tanks: [0, 3, 0, 2],
        stats: [[0,2],[1, 2], [2, 0], [3, 8], [4, 6], [5, 8], [6, 9],[7,7]],
        growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
        autospin: true,
        pathfinding_facing_angle_offset: 0
    },*/

/*{
    tanks: [3, 1, 0],
    stats: [[0, 2], [1, 2], [2, 2], [3, 8], [4, 6], [5, 8], [6, 9], [7, 5]],
	growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
    pathfinding_facing_angle_offset: 0
}, */

    ];

    if (!bot_upgrades.length) {
        bot_upgrades = [{
            tanks: [],
            stats: [[2, 6], [3, 9], [4, 9], [5, 9], [6, 9]],
            growth_extended_upgrades_order_to_max: [2, 7, 1, 0, 8, 9],
            pathfinding_facing_angle_offset: 0
        }];
    }
    
    let [decode_packet, update_parser, broadcast_parser, mockup_parser, player_tab_parser, room_parser, maze_map_manager, yield_control_comps_from_angle, packet_constructors] = eval(await fs.readFile(path.resolve(__dirname, './wasm/protocol_utils.js'), "utf8"));
    let followbot_config = eval(await fs.readFile(path.resolve(__dirname, './wasm/followbot_config.js'), "utf8"));

    let autospin_packet = packet_constructors.construct_command_packet(1);
    let autofire_packet = packet_constructors.construct_command_packet(0);

    const PRESET_DIR = path.resolve(__dirname, "presets");
    const UPGRADE_PATH_FILES = {
        normal: path.resolve(__dirname, "normal_upgrades.txt"),
        ar: path.resolve(__dirname, "ar_upgrades.txt")
    };
    const CUSTOM_BOT_STATS = [[0, 1], [1, 1], [2, 2], [3, 8], [4, 6], [5, 8], [6, 9], [7, 7]];
    const DEFAULT_GROWTH_UPGRADE_ORDER = [2, 7, 1, 0, 8, 9];
    let raw_default_bot_upgrades = bot_upgrades;
    let bot_presets = [];
    let selected_bot_preset = "";
    let custom_bot_tank_path_text = "";
    let custom_bot_config = {
        enabled: false,
        mode: "normal",
        tanks: "",
        builds: ""
    };
    let custom_bot_tank_resolution = null;
    let upgrade_path_map_cache = new Map();

    function normalize_upgrade_mode(value) {
        let mode = String(value || "normal").trim().toLowerCase().replace(/[\s_-]+/g, "");
        if (!mode || mode === "normal") return "normal";
        if (mode === "ar" || mode === "armsrace") return "ar";
        throw new Error(`Unknown preset mode "${value}". Use normal or ar.`);
    }

    function parse_preset_stats(value) {
        if (typeof value === "string") {
            return value.split("/")
                .map((part, stat) => {
                    let amount = Number.parseInt(part.trim(), 10);
                    return Number.isFinite(amount) && amount > 0 ? [stat, amount] : null;
                })
                .filter(Boolean);
        }
        if (!Array.isArray(value)) return [];
        if (value.every(item => !Array.isArray(item))) {
            return value.map((amount, stat) => {
                amount = Number.parseInt(amount, 10);
                return Number.isFinite(amount) && amount > 0 ? [stat, amount] : null;
            }).filter(Boolean);
        }
        return value.map(pair => {
            if (!Array.isArray(pair) || pair.length < 2) return null;
            let stat = Number.parseInt(pair[0], 10);
            let amount = Number.parseInt(pair[1], 10);
            return Number.isFinite(stat) && Number.isFinite(amount) && amount > 0 ? [stat, amount] : null;
        }).filter(Boolean);
    }

    function quote_preset_shorthand_values(text) {
        return String(text || "").replace(/(^|[,{]\s*)(mode|tank|stats)\s*:\s*([^,\n\r}]+)/g, (match, prefix, key, value) => {
            let trimmed = String(value || "").trim();
            if (!trimmed || /^["'`\[{]/.test(trimmed)) return match;
            return `${prefix}${key}: ${JSON.stringify(trimmed)}`;
        });
    }

    async function normalize_upgrade_entry(entry) {
        entry = entry && typeof entry === "object" ? entry : {};
        let mode = normalize_upgrade_mode(entry.mode);
        let tanks = Array.isArray(entry.tanks) ? entry.tanks.map(value => Number.parseInt(value, 10)).filter(Number.isFinite) : [];
        let tank_name = String(entry.tank || "").trim();
        if (tank_name) {
            let resolved = await resolve_tank_name_upgrade_path(tank_name, mode);
            if (!resolved) throw new Error(`No ${mode} upgrade path found for tank "${tank_name}".`);
            tanks = resolved.path;
        }
        let stats = parse_preset_stats(entry.stats);
        let growth_order = Array.isArray(entry.growth_extended_upgrades_order_to_max)
            ? entry.growth_extended_upgrades_order_to_max.map(value => Number.parseInt(value, 10)).filter(Number.isFinite)
            : DEFAULT_GROWTH_UPGRADE_ORDER;
        let pathfinding_angle = Number(entry.pathfinding_facing_angle_offset);
        return {
            mode,
            tank: tank_name,
            tanks,
            stats,
            growth_extended_upgrades_order_to_max: growth_order,
            autospin: entry.autospin === true,
            autofire: entry.autofire === true,
            pathfinding_facing_angle_offset: Number.isFinite(pathfinding_angle) ? pathfinding_angle : 0
        };
    }

    function normalize_compiled_upgrade_entry(entry) {
        entry = entry && typeof entry === "object" ? entry : {};
        let tanks = Array.isArray(entry.tanks) ? entry.tanks.map(value => Number.parseInt(value, 10)).filter(Number.isFinite) : [];
        let growth_order = Array.isArray(entry.growth_extended_upgrades_order_to_max)
            ? entry.growth_extended_upgrades_order_to_max.map(value => Number.parseInt(value, 10)).filter(Number.isFinite)
            : DEFAULT_GROWTH_UPGRADE_ORDER;
        let pathfinding_angle = Number(entry.pathfinding_facing_angle_offset);
        return {
            tanks,
            stats: parse_preset_stats(entry.stats),
            stat_targets: Array.isArray(entry.stat_targets) ? parse_preset_stats(entry.stat_targets) : [],
            reliable_stats: entry.reliable_stats === true,
            growth_extended_upgrades_order_to_max: growth_order,
            autospin: entry.autospin === true,
            autofire: entry.autofire === true,
            pathfinding_facing_angle_offset: Number.isFinite(pathfinding_angle) ? pathfinding_angle : 0
        };
    }

    function compile_bot_upgrades(raw_upgrades) {
        let normalized = (Array.isArray(raw_upgrades) ? raw_upgrades : [raw_upgrades]).map(normalize_compiled_upgrade_entry);
        if (!normalized.length) normalized = [normalize_compiled_upgrade_entry({})];
        return normalized.map(entry => {
            let stat_targets = entry.reliable_stats ? (entry.stat_targets.length ? entry.stat_targets : entry.stats) : [];
            let upgrades = {
                tanks: entry.tanks.slice().reverse().map(upgrade => packet_constructors.construct_tank_upgrade_packet(upgrade)),
                stats: entry.reliable_stats ? [] : entry.stats.map(stat => packet_constructors.construct_stat_upgrade_packet(stat[0], stat[1])),
                stat_targets,
                growth_extended_upgrades_order_to_max: entry.growth_extended_upgrades_order_to_max.slice().reverse(),
                pathfinding_facing_angle_offset: entry.pathfinding_facing_angle_offset,
                autofire: autofire_packet,
                autofire_forced: entry.autofire === true
            };
            if (entry.autospin) upgrades.autospin = autospin_packet;
            return upgrades;
        });
    }

    async function parse_bot_preset_content(content, filename) {
        let text = String(content || "").trim();
        if (!text) throw new Error(`${filename} is empty.`);
        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch (_) {
            let shorthand_text = quote_preset_shorthand_values(text);
            let expression = shorthand_text.startsWith("[") ? shorthand_text : `[${shorthand_text}]`;
            parsed = Function(`"use strict"; return (${expression});`)();
        }
        let entries = Array.isArray(parsed) ? parsed : [parsed];
        if (!entries.length) throw new Error(`${filename} has no upgrade entries.`);
        return Promise.all(entries.map(entry => normalize_upgrade_entry(entry)));
    }

    function format_preset_label(filename) {
        return path.basename(filename, path.extname(filename)).replace(/[_-]+/g, " ");
    }

    async function load_bot_presets() {
        let next_presets = [];
        try {
            let files = await fs.readdir(PRESET_DIR);
            files = files.filter(file => /\.(txt|json|js)$/i.test(file)).sort((a, b) => a.localeCompare(b));
            for (let file of files) {
                let full_path = path.join(PRESET_DIR, file);
                try {
                    let content = await fs.readFile(full_path, "utf8");
                    next_presets.push({
                        id: file,
                        label: format_preset_label(file),
                        file,
                        upgrades: await parse_bot_preset_content(content, file),
                        valid: true
                    });
                } catch (error) {
                    next_presets.push({
                        id: file,
                        label: `${format_preset_label(file)} (invalid)`,
                        file,
                        upgrades: [],
                        valid: false,
                        error: error.message
                    });
                }
            }
        } catch (error) {
            if (error.code !== "ENOENT") console.error(`Failed to read presets: ${error.message}`);
        }
        bot_presets = next_presets;
        if (!bot_presets.some(preset => preset.id === selected_bot_preset && preset.valid)) {
            selected_bot_preset = bot_presets.find(preset => preset.valid)?.id || "";
        }
    }

    function get_selected_bot_preset() {
        return bot_presets.find(preset => preset.id === selected_bot_preset && preset.valid);
    }

    function serialize_bot_presets() {
        return bot_presets.map(preset => ({
            id: preset.id,
            label: preset.label,
            file: preset.file,
            valid: preset.valid,
            error: preset.error || ""
        }));
    }

    async function set_selected_bot_preset(preset_id) {
        await load_bot_presets();
        let next_preset = bot_presets.find(preset => preset.id === preset_id && preset.valid);
        let next_preset_id = next_preset?.id || "";
        let changed = selected_bot_preset !== next_preset_id;
        selected_bot_preset = next_preset_id;
        bot_upgrades = compile_bot_upgrades(next_preset ? next_preset.upgrades : raw_default_bot_upgrades);
        return changed;
    }

    function parse_custom_tank_path(value) {
        return String(value || "")
            .split(/[,\s]+/)
            .map(part => part.trim())
            .filter(part => /^\d+$/.test(part))
            .map(part => Number.parseInt(part, 10))
            .filter(value => Number.isFinite(value) && value >= 0 && value <= 255);
    }

    function get_upgrade_path_file_for_mode(mode) {
        let normalized_mode = normalize_upgrade_mode(mode);
        return UPGRADE_PATH_FILES[normalized_mode] || null;
    }

    function parse_upgrade_path_map_text(text, file_path) {
        if (/\.json$/i.test(file_path)) return JSON.parse(text);
        let tanks = [];
        for (let line of String(text || "").split(/\r?\n/)) {
            line = line.trim();
            if (!line || line.startsWith("#")) continue;
            let match = line.match(/^([0-9,\s]+)\s+(.+)$/);
            if (!match) continue;
            let path_value = parse_custom_tank_path(match[1]);
            let name = match[2].trim();
            if (!path_value.length || !name) continue;
            tanks.push({
                path: path_value,
                path_text: path_value.join(","),
                tank: { name }
            });
        }
        return { tanks };
    }

    async function load_upgrade_path_map_file(mode = "") {
        try {
            let file_path;
            if (mode) {
                file_path = get_upgrade_path_file_for_mode(mode);
            } else {
                file_path = UPGRADE_MAPPER_OUTPUT_FILE;
            }
            let stat = file_path ? await fs.stat(file_path).catch(() => null) : null;
            if (!stat && !mode) {
                file_path = path.resolve(__dirname, "upgrade_paths.json");
                stat = await fs.stat(file_path).catch(() => null);
            }
            if (!stat) return null;
            let cached = upgrade_path_map_cache.get(file_path);
            if (cached && cached.mtime_ms === stat.mtimeMs) {
                return cached.data;
            }
            let text = await fs.readFile(file_path, "utf8");
            let parsed = parse_upgrade_path_map_text(text, file_path);
            upgrade_path_map_cache.set(file_path, {
                mtime_ms: stat.mtimeMs,
                data: parsed
            });
            return parsed;
        } catch (_) {
            upgrade_path_map_cache.clear();
            return null;
        }
    }

    function find_tank_name_upgrade_path_in_map(name, map) {
        let query = normalize_tank_lookup_name(name);
        if (!query || !map) return null;
        let candidates = [];
        if (map.shortest_by_name?.[query]) candidates.push(map.shortest_by_name[query]);
        if (Array.isArray(map.by_name?.[query])) candidates.push(...map.by_name[query]);
        if (!candidates.length && Array.isArray(map.tanks)) {
            for (let entry of map.tanks) {
                if (normalize_tank_lookup_name(entry?.tank?.name) === query) {
                    candidates.push({
                        name: entry.tank.name,
                        path: entry.path,
                        path_text: entry.path_text,
                        id: entry.tank.id
                    });
                }
            }
        }
        candidates = candidates
            .map(candidate => ({
                ...candidate,
                path: parse_custom_tank_path(Array.isArray(candidate.path) ? candidate.path.join(",") : candidate.path_text)
            }))
            .filter(candidate => candidate.path.length);
        if (!candidates.length) return null;
        candidates.sort((a, b) => compare_upgrade_mapper_paths(a.path, b.path));
        return candidates[0];
    }

    async function resolve_tank_name_upgrade_path(name, mode = "") {
        let query = normalize_tank_lookup_name(name);
        if (!query) return null;
        let modes = mode ? [normalize_upgrade_mode(mode)] : ["normal", "ar", ""];
        for (let candidate_mode of modes) {
            let map = await load_upgrade_path_map_file(candidate_mode);
            let resolved = find_tank_name_upgrade_path_in_map(name, map);
            if (resolved) return resolved;
        }
        return null;
    }

    function split_custom_bot_list(value) {
        return String(value || "")
            .split(",")
            .map(part => part.trim())
            .filter(Boolean);
    }

    function normalize_custom_bot_config(raw = {}) {
        if (typeof raw === "string") {
            let tanks = raw.trim();
            return {
                enabled: tanks.length > 0,
                mode: "normal",
                tanks,
                builds: ""
            };
        }
        let mode = "normal";
        try {
            mode = normalize_upgrade_mode(raw.mode || (raw.ar === true || raw.arMode === true ? "ar" : "normal"));
        } catch (_) {}
        return {
            enabled: raw.enabled === true,
            mode,
            tanks: typeof raw.tanks === "string" ? raw.tanks.trim() : "",
            builds: typeof raw.builds === "string" ? raw.builds.trim() : ""
        };
    }

    function get_custom_bot_config_key(config = custom_bot_config) {
        return JSON.stringify(normalize_custom_bot_config(config));
    }

    async function build_custom_bot_entries(config) {
        let normalized = normalize_custom_bot_config(config);
        let tank_inputs = split_custom_bot_list(normalized.tanks);
        let build_inputs = split_custom_bot_list(normalized.builds);
        let entries = [];
        let resolved_entries = [];
        let errors = [];
        for (let index = 0; index < tank_inputs.length; index++) {
            let input = tank_inputs[index];
            let parsed_path = parse_custom_tank_path(input);
            let resolved = parsed_path.length ? null : await resolve_tank_name_upgrade_path(input, normalized.mode);
            let tanks = resolved?.path || parsed_path;
            if (!tanks.length) {
                errors.push(`No ${normalized.mode} upgrade path found for "${input}".`);
                continue;
            }
            let build_text = build_inputs[index] || build_inputs[0] || "";
            let stats = build_text ? parse_preset_stats(build_text) : CUSTOM_BOT_STATS;
            let name = resolved?.name || input;
            entries.push({
                mode: normalized.mode,
                tank: name,
                tanks,
                stats,
                stat_targets: stats,
                reliable_stats: true,
                growth_extended_upgrades_order_to_max: DEFAULT_GROWTH_UPGRADE_ORDER,
                autospin: false,
                autofire: false,
                pathfinding_facing_angle_offset: 0
            });
            resolved_entries.push({
                input,
                name,
                mode: normalized.mode,
                path: tanks,
                path_text: tanks.join(","),
                build: build_text || "default"
            });
        }
        return {
            entries,
            resolution: {
                enabled: normalized.enabled,
                mode: normalized.mode,
                entries: resolved_entries,
                errors
            }
        };
    }

    async function set_bot_upgrade_source(preset_id, custom_settings = {}) {
        await load_bot_presets();
        let next_preset = bot_presets.find(preset => preset.id === preset_id && preset.valid);
        let next_preset_id = next_preset?.id || "";
        let legacy_custom_string = typeof custom_settings === "string";
        let next_custom_config = normalize_custom_bot_config(custom_settings);
        let next_custom_text = legacy_custom_string || next_custom_config.enabled ? next_custom_config.tanks : "";
        let custom_path = parse_custom_tank_path(next_custom_text);
        let previous_resolution_key = JSON.stringify(custom_bot_tank_resolution || {});
        let previous_config_key = get_custom_bot_config_key(custom_bot_config);
        custom_bot_tank_resolution = null;
        let custom_entries = [];
        if (next_custom_config.enabled) {
            let built = await build_custom_bot_entries(next_custom_config);
            custom_entries = built.entries;
            custom_bot_tank_resolution = built.resolution;
        } else if (legacy_custom_string && !custom_path.length && next_custom_text) {
            let resolved = await resolve_tank_name_upgrade_path(next_custom_text);
            if (resolved) {
                custom_path = resolved.path;
                custom_bot_tank_resolution = {
                    input: next_custom_text,
                    name: resolved.name || next_custom_text,
                    path: custom_path,
                    path_text: custom_path.join(",")
                };
            } else {
                custom_bot_tank_resolution = {
                    input: next_custom_text,
                    error: `No upgrade path found for "${next_custom_text}".`
                };
            }
        } else if (legacy_custom_string && custom_path.length) {
            custom_bot_tank_resolution = {
                input: next_custom_text,
                path: custom_path,
                path_text: custom_path.join(",")
            };
        }
        let next_resolution_key = JSON.stringify(custom_bot_tank_resolution || {});
        let next_config_key = get_custom_bot_config_key(next_custom_config);
        let changed = selected_bot_preset !== next_preset_id || custom_bot_tank_path_text !== next_custom_text || previous_config_key !== next_config_key || previous_resolution_key !== next_resolution_key;
        selected_bot_preset = next_preset_id;
        custom_bot_tank_path_text = next_custom_config.tanks;
        custom_bot_config = next_custom_config;
        bot_upgrades = compile_bot_upgrades(next_custom_config.enabled ? (custom_entries.length ? custom_entries : [{
            tanks: [],
            stats: [],
            growth_extended_upgrades_order_to_max: DEFAULT_GROWTH_UPGRADE_ORDER,
            pathfinding_facing_angle_offset: 0
        }]) : custom_path.length ? [{
            tanks: custom_path,
            stats: CUSTOM_BOT_STATS,
            growth_extended_upgrades_order_to_max: DEFAULT_GROWTH_UPGRADE_ORDER,
            pathfinding_facing_angle_offset: 0
        }] : (next_preset ? next_preset.upgrades : raw_default_bot_upgrades));
        return changed;
    }

    await load_bot_presets();
    bot_upgrades = compile_bot_upgrades(get_selected_bot_preset()?.upgrades || raw_default_bot_upgrades);

    if (use_self_IP_as_bot) proxies.push("");

    let target = {
        server: cliServerCode || undefined,
        x: 0, 
        y: 0,
        facing: [0, 0],
        focus_fire: 0,
        shooting: 0,
        node_data: false
    };
    
    let workers = [];
    let worker_intervals = [];
    let bots_enabled = false;
    let observer_workers = [];
    let observer_codes = [];
    let teamlink_workers = new Map();
    let teamlink_timers = [];
    let teamlink_running = false;
    let teamlink_server = "";
    let teamlink_expected_teams = null;
    let teamlink_mode_label = null;
    let teamlink_spawned = 0;
    let teamlink_teams = new Map();
    let teamlink_messages = [];
    let teamlink_generation = 0;
    let upgrade_mapper_workers = new Map();
    let upgrade_mapper_queue = [];
    let upgrade_mapper_lanes = new Map();
    let upgrade_mapper_seen_paths = new Set();
    let upgrade_mapper_records = new Map();
    let upgrade_mapper_tank_records = new Map();
    let upgrade_mapper_queued_tanks = new Set();
    let upgrade_mapper_mockup_names = new Map();
    let upgrade_mapper_messages = [];
    let upgrade_mapper_running = false;
    let upgrade_mapper_generation = 0;
    let upgrade_mapper_worker_serial = 0;
    let upgrade_mapper_started_at = 0;
    let upgrade_mapper_finished_at = 0;
    let upgrade_mapper_server = "";
    let upgrade_mapper_active_writes = Promise.resolve();
    let middle_ws;
    const control_encoder = new TextEncoder();
    const control_decoder = new TextDecoder();
    const OBSERVER_TANK_PATH = [1, 0, 0, 0];
    const UPGRADE_MAPPER_OUTPUT_FILE = path.resolve(__dirname, "upgrade_paths.txt");
    const UPGRADE_MAPPER_EXPECTED_STARTERS = 9;
    const UPGRADE_MAPPER_EXCLUDED_STARTERS = new Set();
    const UPGRADE_MAPPER_MAX_CONCURRENCY = UPGRADE_MAPPER_EXPECTED_STARTERS;
    const UPGRADE_MAPPER_MAX_DEPTH = 8;
    const UPGRADE_MAPPER_STABLE_MS = 500;
    const UPGRADE_MAPPER_STEP_TIMEOUT_MS = 8000;
    const UPGRADE_MAPPER_TOTAL_TIMEOUT_MS = 60000;
    const team_color_names = {
        0: "blue",
        1: "green",
        10: "blue",
        11: "green",
        12: "red",
        14: "purple",
        15: "purple"
    };
    const teamlink_spawn_delay_ms = 1000;
    const teamlink_team_minimap_grace_ms = 2000;

    function get_proxy_for_bot(index) {
        if (!proxies.length) return "";
        return proxies[index % proxies.length] || "";
    }

    function clamp_bot_count(value) {
        let parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed)) parsed = bot_count || 1;
        return Math.max(1, parsed);
    }

    function normalize_server_code(value) {
        let input = String(value || "").trim();
        if (!input) return "";
        if (input.includes(" ")) input = input.split(/\s+/).pop();
        try {
            if (/^https?:\/\//i.test(input)) {
                let parsed = new URL(input);
                if (parsed.hash) input = parsed.hash;
            }
        } catch (_) {}
        let hash_index = input.lastIndexOf("#");
        if (hash_index !== -1) input = input.slice(hash_index + 1);
        return input.replace(/^#+/, "").trim();
    }

    function extract_teamlink_server_code(value) {
        let code = normalize_server_code(value).toLowerCase();
        let match = code.match(/^([a-z0-9]+?)(\d{4,6})$/i);
        if (match) return match[1];
        if (/^[a-z0-9]{32,}$/i.test(code)) {
            if (/^[aceow][pq][a-z0-9]/i.test(code)) return code.slice(0, 3);
            if (/^[aceow][a-z0-9]/i.test(code)) return code.slice(0, 2);
        }
        return code;
    }

    function parse_team_codes(value) {
        let list = Array.isArray(value) ? value : String(value || "").split(/[\n,]+/);
        return Array.from(new Set(list.map(normalize_server_code).filter(Boolean)));
    }

    function resolve_team_color_name(color_id) {
        if (!Number.isFinite(color_id)) return "unknown";
        return team_color_names[color_id] || "unknown";
    }

    async function load_teamlink_game_modes() {
        try {
            let content = await fs.readFile(path.resolve(__dirname, "teamlink/script.js"), "utf8");
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

    const teamlink_game_modes = await load_teamlink_game_modes();
    const teamlink_sorted_modes = [...teamlink_game_modes].sort((a, b) => b.key.length - a.key.length);
    const teamlink_mode_team_map = new Map();

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

    for (let mode of teamlink_game_modes) {
        let count = infer_team_count_from_label(mode.label);
        if (Number.isFinite(count)) {
            teamlink_mode_team_map.set(mode.key.toLowerCase(), count);
        }
    }

    function match_team_count_from_keys(text) {
        if (!text) return null;
        let lower = String(text).toLowerCase();
        for (let mode of teamlink_sorted_modes) {
            let key = mode.key.toLowerCase();
            if (!teamlink_mode_team_map.has(key)) continue;
            if (lower === key) return teamlink_mode_team_map.get(key);
            let tokens = lower.split(/[^a-z0-9]+/i);
            if (tokens.includes(key)) return teamlink_mode_team_map.get(key);
            let regex = new RegExp(`(?:^|[^a-z0-9])${key}(?:[^a-z0-9]|$)`);
            if (regex.test(lower)) return teamlink_mode_team_map.get(key);
        }
        return null;
    }

    function extract_game_mode_from_code(code = "") {
        if (!code || typeof code !== "string") return "Unknown";
        const lower = code.toLowerCase();
        for (const mode of teamlink_sorted_modes) {
            if (lower === mode.key.toLowerCase()) return mode.label;
        }
        const tokens = lower.split(/[^a-z0-9]+/i);
        for (const token of tokens) {
            for (const mode of teamlink_sorted_modes) {
                if (token === mode.key.toLowerCase()) return mode.label;
            }
        }
        for (const mode of teamlink_sorted_modes) {
            const regex = new RegExp(`(?:^|[^a-z0-9])${mode.key.toLowerCase()}(?:[^a-z0-9]|$)`);
            if (regex.test(lower)) return mode.label;
        }
        const modifierMap = { g: "Growth", a: "Arms Race", p: "Portal", o: "Open", m: "Maze" };
        const teamMap = { f: "FFA", d: "Duos", s: "Squads", c: "Clan Wars", 1: "1TDM", 2: "2TDM", 3: "3TDM", 4: "4TDM" };
        const winMap = { d: "Domination", m: "Mothership", a: "Assault", s: "Siege", t: "Tag", p: "Pandemic", b: "Soccer", g: "Grudge Ball", e: "Elimination", c: "Capture the Flag", z: "Sandbox" };
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
        const fallbackMatch = teamlink_sorted_modes.find((mode) => lower.includes(mode.key.toLowerCase()));
        if (fallbackMatch) return fallbackMatch.label;
        return dynamicLabel || "Unknown";
    }

    function determine_team_count(fields = {}, server_code = "", game_data = "") {
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
        let label_guess = extract_game_mode_from_code(mode_raw);
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

    function derive_mode_label(fields = {}, game_data = "", server_code = "") {
        let candidates = [fields.mode, fields.gamemode, fields.type, fields.code, fields.name];
        let label = candidates.find((value) => value && value.trim());
        if (label) return label;
        if (game_data && game_data.trim()) return game_data.trim();
        return server_code || "unknown";
    }

    function resolve_mode_label(fields = {}, game_data = "", server_code = "") {
        if (teamlink_sorted_modes.length === 0) {
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
        let label = extract_game_mode_from_code(mode_raw);
        if (label && label !== "Unknown") return label;
        return derive_mode_label(fields, game_data, server_code);
    }

    function send_json_packet(type, payload) {
        if (!middle_ws || middle_ws.readyState !== WebSocket.OPEN) return;
        let body = control_encoder.encode(JSON.stringify(payload));
        let packet = new Uint8Array(body.length + 1);
        packet[0] = type;
        packet.set(body, 1);
        middle_ws.send(packet.buffer);
    }

    function normalize_upgrade_mapper_path(path_value) {
        return (Array.isArray(path_value) ? path_value : [])
            .map(value => Number.parseInt(value, 10))
            .filter(value => Number.isFinite(value) && value >= 0 && value <= 255);
    }

    function get_upgrade_mapper_path_key(path_value) {
        let normalized = normalize_upgrade_mapper_path(path_value);
        return normalized.length ? normalized.join(",") : "root";
    }

    function get_upgrade_mapper_lane_key(path_value) {
        let normalized = normalize_upgrade_mapper_path(path_value);
        return normalized.length ? String(normalized[0]) : "root";
    }

    function is_upgrade_mapper_path_excluded(path_value) {
        let normalized = normalize_upgrade_mapper_path(path_value);
        return normalized.length > 0 && UPGRADE_MAPPER_EXCLUDED_STARTERS.has(normalized[0]);
    }

    function get_upgrade_mapper_lane(path_value) {
        let normalized = normalize_upgrade_mapper_path(path_value);
        if (!normalized.length || is_upgrade_mapper_path_excluded(normalized)) return null;
        let key = get_upgrade_mapper_lane_key(normalized);
        if (!upgrade_mapper_lanes.has(key)) {
            upgrade_mapper_lanes.set(key, {
                key,
                starter: normalized[0],
                active: 0,
                activeFront: false,
                activeBack: false,
                helpers: 0,
                nextHelperSide: "front",
                queue: [],
                mapped: 0
            });
        }
        return upgrade_mapper_lanes.get(key);
    }

    function get_upgrade_mapper_queued_count() {
        let count = upgrade_mapper_queue.length;
        for (let lane of upgrade_mapper_lanes.values()) count += lane.queue.length;
        return count;
    }

    function get_sorted_upgrade_mapper_lanes() {
        return Array.from(upgrade_mapper_lanes.values())
            .sort((a, b) => a.starter - b.starter);
    }

    function take_upgrade_mapper_lane_path(lane, side = "front") {
        if (!lane || !lane.queue.length) return null;
        return side === "back" ? lane.queue.pop() : lane.queue.shift();
    }

    function get_upgrade_mapper_busiest_lane() {
        let lanes = get_sorted_upgrade_mapper_lanes().filter(lane => lane.queue.length > 0);
        lanes.sort((a, b) => {
            let queue_diff = b.queue.length - a.queue.length;
            if (queue_diff) return queue_diff;
            return a.active - b.active || a.starter - b.starter;
        });
        return lanes[0] || null;
    }

    function mark_upgrade_mapper_lane_worker_started(lane, role) {
        if (!lane) return;
        lane.active += 1;
        if (role === "front") lane.activeFront = true;
        else if (role === "back") lane.activeBack = true;
        else lane.helpers += 1;
    }

    function mark_upgrade_mapper_lane_worker_finished(lane, role) {
        if (!lane) return;
        lane.active = Math.max(0, lane.active - 1);
        if (role === "front") lane.activeFront = false;
        else if (role === "back") lane.activeBack = false;
        else lane.helpers = Math.max(0, lane.helpers - 1);
    }

    function compare_upgrade_mapper_paths(a, b) {
        let left = normalize_upgrade_mapper_path(a);
        let right = normalize_upgrade_mapper_path(b);
        if (left.length !== right.length) return left.length - right.length;
        for (let index = 0; index < Math.min(left.length, right.length); index++) {
            if (left[index] !== right[index]) return left[index] - right[index];
        }
        return 0;
    }

    function normalize_tank_lookup_name(name) {
        return String(name || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
    }

    function get_upgrade_mapper_tank_key(tank = {}) {
        if (Number.isFinite(tank.id)) return `id:${tank.id}`;
        let name_key = normalize_tank_lookup_name(tank.name);
        if (name_key) return `name:${name_key}`;
        return "";
    }

    function get_upgrade_mapper_slot_tank_key(slot = {}) {
        if (Number.isFinite(slot.token)) return `id:${slot.token}`;
        let name_key = normalize_tank_lookup_name(slot.name);
        if (name_key) return `name:${name_key}`;
        return "";
    }

    function remember_upgrade_mapper_mockup_names(slots = []) {
        for (let slot of slots) {
            if (!Number.isFinite(slot?.token)) continue;
            let name = String(slot.name || "").trim();
            if (name) upgrade_mapper_mockup_names.set(slot.token, name);
        }
    }

    function fill_upgrade_mapper_tank_name(tank = {}) {
        if (!tank || tank.name || !Number.isFinite(tank.id)) return tank;
        let name = upgrade_mapper_mockup_names.get(tank.id);
        if (name) tank.name = name;
        return tank;
    }

    function refresh_upgrade_mapper_record_names() {
        for (let record of upgrade_mapper_records.values()) fill_upgrade_mapper_tank_name(record.current_tank);
        for (let record of upgrade_mapper_tank_records.values()) fill_upgrade_mapper_tank_name(record.current_tank);
    }

    function remember_upgrade_mapper_message(message) {
        if (!message) return;
        upgrade_mapper_messages.push(String(message));
        if (upgrade_mapper_messages.length > 12) upgrade_mapper_messages.shift();
    }

    function enqueue_upgrade_mapper_path(path_value) {
        let next_path = normalize_upgrade_mapper_path(path_value);
        if (is_upgrade_mapper_path_excluded(next_path)) return false;
        if (next_path.length > UPGRADE_MAPPER_MAX_DEPTH) return false;
        let key = get_upgrade_mapper_path_key(next_path);
        if (upgrade_mapper_seen_paths.has(key)) return false;
        upgrade_mapper_seen_paths.add(key);
        if (!next_path.length) {
            upgrade_mapper_queue.push(next_path);
            upgrade_mapper_queue.sort(compare_upgrade_mapper_paths);
        } else {
            let lane = get_upgrade_mapper_lane(next_path);
            lane.queue.push(next_path);
            lane.queue.sort(compare_upgrade_mapper_paths);
        }
        return true;
    }

    function serialize_upgrade_mapper_record(record) {
        let path_value = normalize_upgrade_mapper_path(record.path);
        return {
            path: path_value,
            path_text: path_value.join(","),
            depth: path_value.length,
            tank: record.current_tank || {},
            slots: Array.isArray(record.slots) ? record.slots : [],
            terminal: record.terminal === true,
            reason: record.reason || "",
            elapsed_ms: record.elapsed_ms || 0,
            time: record.time || new Date().toISOString()
        };
    }

    function get_upgrade_mapper_unique_entries() {
        return Array.from(upgrade_mapper_tank_records.values())
            .map(serialize_upgrade_mapper_record)
            .filter(entry => entry.path.length && entry.tank?.name)
            .sort((a, b) => compare_upgrade_mapper_paths(a.path, b.path));
    }

    function format_upgrade_mapper_line(entry) {
        return `${entry.path_text} ${String(entry.tank.name || "").trim()}`.trim();
    }

    function build_upgrade_mapper_output(status = upgrade_mapper_running ? "running" : "complete") {
        let entries = get_upgrade_mapper_unique_entries();
        let by_name = {};
        let shortest_by_name = {};
        for (let entry of entries) {
            let name = entry.tank?.name || "";
            let key = normalize_tank_lookup_name(name);
            if (!key || !entry.path.length) continue;
            if (!by_name[key]) by_name[key] = [];
            by_name[key].push({
                name,
                path: entry.path,
                path_text: entry.path_text,
                id: entry.tank?.id ?? null
            });
        }
        for (let key of Object.keys(by_name)) {
            by_name[key].sort((a, b) => compare_upgrade_mapper_paths(a.path, b.path));
            shortest_by_name[key] = by_name[key][0];
        }
        return {
            version: 1,
            status,
            server: upgrade_mapper_server || target.server || "",
            started_at: upgrade_mapper_started_at ? new Date(upgrade_mapper_started_at).toISOString() : null,
            finished_at: upgrade_mapper_finished_at ? new Date(upgrade_mapper_finished_at).toISOString() : null,
            output_file: UPGRADE_MAPPER_OUTPUT_FILE,
            max_depth: UPGRADE_MAPPER_MAX_DEPTH,
            mapped_count: entries.length,
            terminal_count: entries.filter(entry => entry.terminal).length,
            lanes: get_sorted_upgrade_mapper_lanes().map(lane => ({
                starter: lane.starter,
                active: lane.active,
                front: lane.activeFront,
                back: lane.activeBack,
                helpers: lane.helpers,
                queued: lane.queue.length,
                mapped: lane.mapped
            })),
            tanks: entries,
            by_name,
            shortest_by_name,
            messages: upgrade_mapper_messages.slice()
        };
    }

    function write_upgrade_mapper_output(status) {
        let entries = get_upgrade_mapper_unique_entries();
        let output = entries.map(format_upgrade_mapper_line).join("\n");
        if (output) output += "\n";
        upgrade_mapper_active_writes = upgrade_mapper_active_writes
            .catch(() => {})
            .then(() => fs.writeFile(UPGRADE_MAPPER_OUTPUT_FILE, output));
        return upgrade_mapper_active_writes;
    }

    function serialize_upgrade_mapper_state() {
        let terminal_count = 0;
        for (let record of upgrade_mapper_records.values()) {
            if (record.terminal === true) terminal_count += 1;
        }
        return {
            running: upgrade_mapper_running,
            server: upgrade_mapper_server || target.server || "",
            active: upgrade_mapper_workers.size,
            queued: get_upgrade_mapper_queued_count(),
            seen: upgrade_mapper_seen_paths.size,
            mapped: upgrade_mapper_tank_records.size,
            attempts: upgrade_mapper_records.size,
            terminals: terminal_count,
            lanes: get_sorted_upgrade_mapper_lanes().map(lane => ({
                starter: lane.starter,
                active: lane.active,
                front: lane.activeFront,
                back: lane.activeBack,
                helpers: lane.helpers,
                queued: lane.queue.length,
                mapped: lane.mapped
            })),
            outputFile: UPGRADE_MAPPER_OUTPUT_FILE,
            messages: upgrade_mapper_messages.slice(-6)
        };
    }

    function serialize_teamlink_state() {
        let teams = Array.from(teamlink_teams.values()).sort((a, b) => a.color_id - b.color_id);
        return {
            running: teamlink_running,
            server: teamlink_server,
            mode: teamlink_mode_label,
            expectedTeams: teamlink_expected_teams,
            spawned: teamlink_spawned,
            active: teamlink_workers.size,
            teams,
            messages: teamlink_messages.slice(-6)
        };
    }

    function send_status(extra = {}) {
        send_json_packet(11, {
            type: "status",
            bots: {
                running: bots_enabled,
                active: workers.length,
                count: bot_count,
                names: bot_names_text,
                pathfinding: bot_pathfind,
                autofire: bot_autofire,
                copyShooting: bot_copy_shooting,
                preset: selected_bot_preset,
                customTankPath: custom_bot_tank_path_text,
                customBots: custom_bot_config,
                customTankResolution: custom_bot_tank_resolution,
                presets: serialize_bot_presets(),
                server: target.server || ""
            },
            fov: {
                observersRunning: observer_workers.length > 0,
                observerCount: observer_workers.length,
                teamLinks: observer_codes
            },
            teamlink: serialize_teamlink_state(),
            mapper: serialize_upgrade_mapper_state(),
            ...extra
        });
    }

    function clear_workers() {
        for (let interval of worker_intervals) clearInterval(interval);
        worker_intervals = [];
        for (let worker of workers) worker.terminate();
        workers = [];
        send_status();
    }

    function send_live_worker_settings() {
        for (let worker of workers) {
            worker.postMessage({
                type: "settings",
                pathfinding: bot_pathfind,
                autofire: bot_autofire,
                copyShooting: bot_copy_shooting
            });
        }
    }

    function spawn_workers() {
        if (!bots_enabled || !target.server || workers.length) return;
        let launch_count = clamp_bot_count(bot_count);
        bot_count = launch_count;
        console.log(`Launching ${launch_count} bots for #${target.server}`);
        for (let bot = 0; bot < launch_count; bot++) {
            let worker = new Worker(path.resolve(__dirname, './bot_worker.js'), {
                workerData: [
                    user_agent,
                    get_proxy_for_bot(bot),
                    target.server,
                    bot_upgrades[bot % bot_upgrades.length],
                    randomize_names ? undefined : bot_names[bot % bot_names.length],
                    bot_pathfind,
                    followbot_config,
                    bot,
                    {
                        autofire_enabled: bot_autofire,
                        copy_shooting: bot_copy_shooting,
                        movement_interval_ms: update_rate
                    }
                ]
            });
            worker.on('message', (data) => {
                if (data[0] == 0) {
                    console.log(`Bot #${bot} failed.`);
                    worker.terminate();
                } else if (middle_ws && middle_ws.readyState === WebSocket.OPEN) {
                    middle_ws.send(data[1]);
                }
            });
            let worker_interval = setInterval(() => {
                worker.postMessage(`${target.x},${target.y},${target.facing[0]},${target.facing[1]},${target.focus_fire},${target.shooting}` + (target.node_data ? `,${target.node_data[0]},${target.node_data[1]}` : ""));
            }, update_rate);
            worker.on('exit', () => {
                clearInterval(worker_interval);
                workers = workers.filter(entry => entry !== worker);
                send_status();
            });
            worker_intervals.push(worker_interval);
            workers.push(worker);
        }
        send_status();
    }

    function restart_workers_if_running() {
        if (!bots_enabled) return;
        clear_workers();
        spawn_workers();
    }

    function build_observer_tank_upgrade_packets() {
        return OBSERVER_TANK_PATH.slice().reverse().map(upgrade => new Uint8Array([85, upgrade]));
    }

    function stop_observers() {
        for (let worker of observer_workers) worker.terminate();
        observer_workers = [];
        observer_codes = [];
        send_status();
    }

    function start_observers(raw_codes) {
        let codes = parse_team_codes(raw_codes);
        stop_observers();
        if (!codes.length) {
            send_status({ notice: "No valid observer team links were provided." });
            return;
        }
        observer_codes = codes;
        observer_codes.forEach((team_code, index) => {
            let worker = new Worker(path.resolve(__dirname, "./bot_worker.js"), {
                workerData: {
                    user_agent,
                    proxy: get_proxy_for_bot(index),
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
                    worker.terminate();
                    return;
                }
                if (middle_ws && middle_ws.readyState === WebSocket.OPEN) middle_ws.send(data[1]);
            });
            worker.on("exit", () => {
                observer_workers = observer_workers.filter(entry => entry !== worker);
                send_status();
            });
            observer_workers.push(worker);
        });
        send_status({ notice: `Started ${observer_workers.length} FOV observer bot(s).` });
    }

    function stop_teamlink_finder() {
        teamlink_generation += 1;
        for (let timer of teamlink_timers) clearTimeout(timer);
        for (let timer of teamlink_timers) clearInterval(timer);
        teamlink_timers = [];
        for (let worker of teamlink_workers.values()) worker.terminate();
        teamlink_workers.clear();
        teamlink_running = false;
        send_status();
    }

    function finish_teamlink_finder(message) {
        for (let timer of teamlink_timers) clearTimeout(timer);
        for (let timer of teamlink_timers) clearInterval(timer);
        teamlink_timers = [];
        for (let worker of teamlink_workers.values()) worker.terminate();
        teamlink_workers.clear();
        teamlink_running = false;
        if (message) remember_teamlink_message(message);
        send_status();
    }

    function remember_teamlink_message(message) {
        if (!message) return;
        teamlink_messages.push(String(message));
        if (teamlink_messages.length > 10) teamlink_messages.shift();
    }

    function maybe_finish_teamlink_finder() {
        if (!teamlink_running) return;
        if (Number.isFinite(teamlink_expected_teams) && teamlink_expected_teams <= 1) {
            finish_teamlink_finder("no_team_links");
            return;
        }
        if (Number.isFinite(teamlink_expected_teams) && teamlink_expected_teams > 1 && teamlink_teams.size >= teamlink_expected_teams) {
            finish_teamlink_finder("all_team_links_found");
        }
    }

    function spawn_teamlink_worker(generation) {
        if (!teamlink_running || generation !== teamlink_generation) return;
        let worker_id = teamlink_spawned;
        let worker = new Worker(path.resolve(__dirname, "./bot_worker.js"), {
            workerData: {
                user_agent,
                proxy: get_proxy_for_bot(worker_id),
                server_code: teamlink_server,
                bot_name: "",
                bot_pathfind: false,
                followbot_config: null,
                writer: worker_id,
                options: { mode: "teamlink", team_minimap_grace_ms: teamlink_team_minimap_grace_ms }
            }
        });
        teamlink_workers.set(worker_id, worker);
        teamlink_spawned += 1;

        let remove_worker = () => {
            teamlink_workers.delete(worker_id);
            send_status();
        };

        worker.on("message", message => {
            if (!message || typeof message !== "object") return;
            if (message.type === "room_info") {
                let fields = message.fields || {};
                let resolved_mode = resolve_mode_label(fields, message.game_data, teamlink_server);
                let resolved_expected = determine_team_count(fields, teamlink_server, message.game_data);
                if (resolved_mode && resolved_mode !== "Unknown") teamlink_mode_label = resolved_mode;
                else if (!teamlink_mode_label) teamlink_mode_label = resolved_mode;
                if (Number.isFinite(resolved_expected)) {
                    if (!Number.isFinite(teamlink_expected_teams)) teamlink_expected_teams = resolved_expected;
                    else if (teamlink_expected_teams <= 1 && resolved_expected > 1) teamlink_expected_teams = resolved_expected;
                    else if (resolved_expected > teamlink_expected_teams) teamlink_expected_teams = resolved_expected;
                }
                maybe_finish_teamlink_finder();
            } else if (message.type === "teamlink") {
                let color_id = message.color;
                if (!teamlink_teams.has(color_id)) {
                    let color_name = resolve_team_color_name(color_id);
                    teamlink_teams.set(color_id, {
                        color_id,
                        color_name,
                        link: message.link,
                        players: message.players
                    });
                    remember_teamlink_message(`team: ${color_name} | players: ${message.players} | link: ${message.link}`);
                }
                maybe_finish_teamlink_finder();
            } else if (message.type === "error") {
                remember_teamlink_message(message.message);
                worker.terminate();
                remove_worker();
            }
            send_status();
        });

        worker.on("error", error => {
            remember_teamlink_message(error.message || String(error));
            remove_worker();
        });
        worker.on("exit", remove_worker);
        send_status();
    }

    function start_teamlink_finder(raw_server) {
        let server = extract_teamlink_server_code(raw_server || target.server);
        stop_teamlink_finder();
        teamlink_generation += 1;
        teamlink_server = server;
        teamlink_expected_teams = null;
        teamlink_mode_label = null;
        teamlink_spawned = 0;
        teamlink_teams.clear();
        teamlink_messages = [];
        if (!teamlink_server) {
            send_status({ notice: "No valid teamlink server was provided." });
            return;
        }
        teamlink_running = true;
        spawn_teamlink_worker(teamlink_generation);
        let spawn_interval = setInterval(() => {
            spawn_teamlink_worker(teamlink_generation);
        }, teamlink_spawn_delay_ms);
        teamlink_timers.push(spawn_interval);
        send_status({ notice: `Started continuous teamlink finder for #${teamlink_server}.` });
    }

    function stop_upgrade_mapper(message = "stopped") {
        upgrade_mapper_generation += 1;
        for (let worker of upgrade_mapper_workers.values()) worker.terminate();
        upgrade_mapper_workers.clear();
        upgrade_mapper_queue = [];
        upgrade_mapper_lanes.clear();
        upgrade_mapper_queued_tanks.clear();
        upgrade_mapper_mockup_names.clear();
        if (upgrade_mapper_running) {
            upgrade_mapper_running = false;
            upgrade_mapper_finished_at = Date.now();
            remember_upgrade_mapper_message(message);
            write_upgrade_mapper_output("stopped").catch(error => {
                remember_upgrade_mapper_message(`write failed: ${error.message}`);
            });
        }
        send_status();
    }

    function finish_upgrade_mapper() {
        if (!upgrade_mapper_running || upgrade_mapper_workers.size || get_upgrade_mapper_queued_count()) return;
        upgrade_mapper_running = false;
        upgrade_mapper_finished_at = Date.now();
        remember_upgrade_mapper_message(`complete: ${upgrade_mapper_tank_records.size} tanks mapped`);
        write_upgrade_mapper_output("complete").then(() => {
            send_status({ notice: `Upgrade map saved to ${UPGRADE_MAPPER_OUTPUT_FILE}` });
        }).catch(error => {
            remember_upgrade_mapper_message(`write failed: ${error.message}`);
            send_status({ notice: `Upgrade mapper finished, but writing failed: ${error.message}` });
        });
        send_status();
    }

    function handle_upgrade_mapper_result(result) {
        let path_value = normalize_upgrade_mapper_path(result.path);
        let key = get_upgrade_mapper_path_key(path_value);
        remember_upgrade_mapper_mockup_names(result.slots);
        refresh_upgrade_mapper_record_names();
        let record = {
            path: path_value,
            current_tank: fill_upgrade_mapper_tank_name(result.current_tank || {}),
            slots: Array.isArray(result.slots) ? result.slots : [],
            terminal: result.terminal === true,
            reason: result.reason || "",
            elapsed_ms: result.elapsed_ms || 0,
            time: new Date().toISOString()
        };
        upgrade_mapper_records.set(key, record);
        let lane = get_upgrade_mapper_lane(path_value);
        if (lane) lane.mapped += 1;
        let tank_key = get_upgrade_mapper_tank_key(record.current_tank);
        let complete_result = record.reason === "complete" || record.reason === "complete_missing_name";
        let is_duplicate_tank = tank_key && upgrade_mapper_tank_records.has(tank_key);
        if (complete_result && tank_key && !is_duplicate_tank && path_value.length) {
            upgrade_mapper_tank_records.set(tank_key, record);
        } else if (complete_result && tank_key && is_duplicate_tank && record.current_tank?.name) {
            let existing = upgrade_mapper_tank_records.get(tank_key);
            if (existing && !existing.current_tank?.name) existing.current_tank.name = record.current_tank.name;
        }
        let tank_name = record.current_tank?.name || `#${record.current_tank?.id ?? "unknown"}`;
        if (record.reason && record.reason !== "complete") {
            remember_upgrade_mapper_message(`${path_value.join(",") || "root"}: ${record.reason} at ${tank_name}`);
        }
        if (complete_result && !is_duplicate_tank && path_value.length < UPGRADE_MAPPER_MAX_DEPTH) {
            for (let slot of record.slots) {
                if (!Number.isFinite(slot?.slot)) continue;
                let next_path = [...path_value, slot.slot];
                if (is_upgrade_mapper_path_excluded(next_path)) continue;
                let slot_tank_key = get_upgrade_mapper_slot_tank_key(slot);
                if (slot_tank_key && (upgrade_mapper_tank_records.has(slot_tank_key) || upgrade_mapper_queued_tanks.has(slot_tank_key))) continue;
                if (enqueue_upgrade_mapper_path(next_path) && slot_tank_key) upgrade_mapper_queued_tanks.add(slot_tank_key);
            }
        }
        write_upgrade_mapper_output("running").catch(error => {
            remember_upgrade_mapper_message(`write failed: ${error.message}`);
        });
    }

    function pump_upgrade_mapper_queue() {
        if (!upgrade_mapper_running) return;
        while (upgrade_mapper_workers.size < UPGRADE_MAPPER_MAX_CONCURRENCY && upgrade_mapper_queue.length) {
            let path_value = upgrade_mapper_queue.shift();
            spawn_upgrade_mapper_worker(path_value, upgrade_mapper_generation, null, "root");
        }
        for (let lane of get_sorted_upgrade_mapper_lanes()) {
            if (upgrade_mapper_workers.size >= UPGRADE_MAPPER_MAX_CONCURRENCY) break;
            if (lane.activeFront || !lane.queue.length) continue;
            let path_value = take_upgrade_mapper_lane_path(lane, "front");
            if (path_value) spawn_upgrade_mapper_worker(path_value, upgrade_mapper_generation, lane, "front");
        }
        finish_upgrade_mapper();
        send_status();
    }

    function spawn_upgrade_mapper_worker(path_value, generation, lane = null, role = "root") {
        if (!upgrade_mapper_running || generation !== upgrade_mapper_generation) return;
        let serial = ++upgrade_mapper_worker_serial;
        let lane_key = lane?.key || get_upgrade_mapper_lane_key(path_value);
        let worker_id = `${generation}:${serial}:${lane_key}:${get_upgrade_mapper_path_key(path_value)}`;
        let worker_index = serial;
        if (lane && role === "front") {
            worker_index = lane.starter;
        }
        mark_upgrade_mapper_lane_worker_started(lane, role);
        let worker = new Worker(path.resolve(__dirname, "./bot_worker.js"), {
            workerData: {
                user_agent,
                proxy: get_proxy_for_bot(worker_index),
                server_code: upgrade_mapper_server,
                upgrade_data: {
                    tanks: [],
                    stats: [],
                    growth_extended_upgrades_order_to_max: [],
                    pathfinding_facing_angle_offset: 0
                },
                bot_name: "",
                bot_pathfind: false,
                followbot_config: null,
                writer: worker_index,
                mode: "upgrade_mapper",
                options: {
                    mode: "upgrade_mapper",
                    mapper_path: path_value,
                    mapper_stable_ms: UPGRADE_MAPPER_STABLE_MS,
                    mapper_step_timeout_ms: UPGRADE_MAPPER_STEP_TIMEOUT_MS,
                    mapper_total_timeout_ms: UPGRADE_MAPPER_TOTAL_TIMEOUT_MS,
                    mapper_name_timeout_ms: 4000
                }
            }
        });
        upgrade_mapper_workers.set(worker_id, worker);
        let worker_timeout = setTimeout(() => {
            remember_upgrade_mapper_message(`${get_upgrade_mapper_path_key(path_value)}: worker timeout`);
            worker.terminate();
            remove_worker();
        }, UPGRADE_MAPPER_TOTAL_TIMEOUT_MS + 15000);

        let remove_worker = () => {
            if (upgrade_mapper_workers.get(worker_id) === worker) {
                clearTimeout(worker_timeout);
                upgrade_mapper_workers.delete(worker_id);
                mark_upgrade_mapper_lane_worker_finished(lane, role);
                pump_upgrade_mapper_queue();
            }
        };

        worker.on("message", message => {
            if (!message || typeof message !== "object") return;
            if (message.type === "upgrade_mapper_result") {
                handle_upgrade_mapper_result(message);
                worker.terminate();
                remove_worker();
            } else if (message.type === "upgrade_mapper_error" || message.type === "error") {
                remember_upgrade_mapper_message(`${get_upgrade_mapper_path_key(path_value)}: ${message.message}`);
                worker.terminate();
                remove_worker();
            }
            send_status();
        });
        worker.on("error", error => {
            remember_upgrade_mapper_message(`${get_upgrade_mapper_path_key(path_value)}: ${error.message || String(error)}`);
            remove_worker();
        });
        worker.on("exit", remove_worker);
    }

    function start_upgrade_mapper(raw_server) {
        let server = normalize_server_code(raw_server || target.server);
        stop_upgrade_mapper("restarted");
        upgrade_mapper_generation += 1;
        upgrade_mapper_queue = [];
        upgrade_mapper_lanes.clear();
        upgrade_mapper_seen_paths.clear();
        upgrade_mapper_records.clear();
        upgrade_mapper_tank_records.clear();
        upgrade_mapper_queued_tanks.clear();
        upgrade_mapper_mockup_names.clear();
        upgrade_mapper_messages = [];
        upgrade_mapper_worker_serial = 0;
        upgrade_mapper_running = false;
        upgrade_mapper_started_at = Date.now();
        upgrade_mapper_finished_at = 0;
        upgrade_mapper_server = server;
        if (!upgrade_mapper_server) {
            remember_upgrade_mapper_message("missing server");
            send_status({ notice: "No server is available for the upgrade mapper." });
            return;
        }
        target.server = upgrade_mapper_server;
        upgrade_mapper_running = true;
        enqueue_upgrade_mapper_path([]);
        remember_upgrade_mapper_message(`root probe for #${upgrade_mapper_server}`);
        pump_upgrade_mapper_queue();
        send_status({ notice: `Started upgrade path mapper for #${upgrade_mapper_server}.` });
    }

    async function apply_bot_settings(settings = {}) {
        let next_count = clamp_bot_count(settings.count ?? bot_count);
        let next_pathfind = settings.pathfinding != null ? !!settings.pathfinding : bot_pathfind;
        let next_autofire = settings.autofire != null ? !!settings.autofire : bot_autofire;
        let next_copy_shooting = settings.copyShooting != null ? !!settings.copyShooting : bot_copy_shooting;
        let next_names_text = settings.names != null ? String(settings.names) : bot_names_text;
        let next_names = next_names_text.split(",").map(name => name.trim()).filter(Boolean);
        if (!next_names.length) next_names = [""];
        let preset_changed = await set_bot_upgrade_source(
            settings.preset != null ? settings.preset : selected_bot_preset,
            settings.customBots != null ? settings.customBots : settings.customTankPath
        );
        let restart_needed = preset_changed || next_count !== bot_count || next_names_text !== bot_names_text;
        let live_settings_changed = next_pathfind !== bot_pathfind || next_autofire !== bot_autofire || next_copy_shooting !== bot_copy_shooting;
        bot_count = next_count;
        bot_pathfind = next_pathfind;
        bot_autofire = next_autofire;
        bot_copy_shooting = next_copy_shooting;
        bot_names_text = next_names_text;
        bot_names = next_names;
        randomize_names = false;
        if (restart_needed) restart_workers_if_running();
        else if (live_settings_changed) send_live_worker_settings();
        send_status();
    }

    async function handle_control_packet(packet_buffer) {
        let packet = new Uint8Array(packet_buffer);
        let payload;
        try {
            payload = JSON.parse(control_decoder.decode(packet.slice(1)));
        } catch (error) {
            return;
        }
        if (payload.server) target.server = normalize_server_code(payload.server);
        if (payload.type === "requestStatus") {
            await load_bot_presets();
            send_status();
            return;
        }
        if (payload.feature === "bots") {
            await apply_bot_settings(payload.settings || payload);
            if (payload.action === "start") {
                bots_enabled = true;
                spawn_workers();
            } else if (payload.action === "stop") {
                bots_enabled = false;
                clear_workers();
            }
        } else if (payload.feature === "fov") {
            if (payload.action === "startObservers") start_observers(payload.teamLinks || payload.links || "");
            else if (payload.action === "stopObservers") stop_observers();
        } else if (payload.feature === "teamlink") {
            if (payload.action === "start") start_teamlink_finder(payload.server || target.server);
            else if (payload.action === "stop") stop_teamlink_finder();
        } else if (payload.feature === "upgradeMapper") {
            if (payload.action === "start") start_upgrade_mapper(payload.server || target.server);
            else if (payload.action === "stop") stop_upgrade_mapper();
        }
        send_status();
    }

    if (cliServerCode) {
        console.log(`Terminal mode enabled for #${target.server}`);
        bots_enabled = true;
        spawn_workers();
        return;
    }

    middle_ws = new WebSocket('ws://localhost:8080');
    middle_ws.binaryType = 'arraybuffer';

    middle_ws.onopen = function() {
        setInterval(() => {
            middle_ws.send(new Uint8Array([1]).buffer);
            if (!target.server) middle_ws.send(new Uint8Array([3]).buffer);
        }, update_rate);
        send_status();
    };

    middle_ws.onmessage = function(e) {
        handle_packet(e.data);
    };

    middle_ws.onclose = function() {
        throw Error("the middle ws was closed unexpectedly.");
    };

    function handle_packet(packet_buffer) {
        let bytes = new Uint8Array(packet_buffer);
        let packet = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        switch (packet.getUint8(0)) {
            case 0:
                target.x = packet.getFloat32(1, true);
                target.y = packet.getFloat32(5, true);
                target.facing = yield_control_comps_from_angle(packet.getFloat32(9, true));
                target.focus_fire = packet.getUint8(13);
                if (packet_buffer.byteLength === 15 || packet_buffer.byteLength === 17) {
                    target.shooting = packet.getUint8(14);
                    target.node_data = packet_buffer.byteLength === 17 ? [packet.getUint8(15), packet.getUint8(16)] : false;
                } else {
                    target.shooting = 0;
                    target.node_data = packet_buffer.byteLength == 16 ? [packet.getUint8(14), packet.getUint8(15)] : false;
                }
            break;
            case 2:
                target.server = normalize_server_code(new TextDecoder().decode(bytes.slice(1)));
                spawn_workers();
                send_status();
            break;
            case 10:
                handle_control_packet(packet_buffer).catch(error => {
                    console.error(`Control packet failed: ${error.message}`);
                    send_status({ notice: error.message });
                });
            break;
            case 255:
                bots_enabled = false;
                clear_workers();
                target.server = undefined;
                send_status();
            break;
        }
    };
})();
