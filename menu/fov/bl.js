const path = require('path');
const { Worker } = require('worker_threads');
const fs = require('fs').promises;

(async () => {
    // Input proxies
    let proxies = [
"https://spy3q24zzh:e2K0obch8lN=B5Bnmr@isp.decodo.com:10001",
"https://spy3q24zzh:e2K0obch8lN=B5Bnmr@isp.decodo.com:10002",
"https://spy3q24zzh:e2K0obch8lN=B5Bnmr@isp.decodo.com:10003",
"https://spy3q24zzh:e2K0obch8lN=B5Bnmr@isp.decodo.com:10004",
"https://spy3q24zzh:e2K0obch8lN=B5Bnmr@isp.decodo.com:10005",
"https://spy3q24zzh:e2K0obch8lN=B5Bnmr@isp.decodo.com:10006",
"https://spy3q24zzh:e2K0obch8lN=B5Bnmr@isp.decodo.com:10007",
"https://spy3q24zzh:e2K0obch8lN=B5Bnmr@isp.decodo.com:10008",
"https://spy3q24zzh:e2K0obch8lN=B5Bnmr@isp.decodo.com:10009",
"https://spy3q24zzh:e2K0obch8lN=B5Bnmr@isp.decodo.com:10010",
];
    // Input rate at which intervals for recieving and sending data are updated (in ms)
    let update_rate = 100;
    // Input bot names (not recommended for staying anonymous but here if wanted)
    let bot_names = [""];
    // Input if the random name generator function should be utilized
    let randomize_names = false;
    // Input UA
    let user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
    // Input bot count (should be less than total proxies)
    let bot_count = 30;
    // Input if bot can pathfind on maze maps
    let bot_pathfind = false;
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
    
    let [decode_packet, update_parser, broadcast_parser, mockup_parser, player_tab_parser, room_parser, maze_map_manager, yield_control_comps_from_angle, packet_constructors] = eval(await fs.readFile(path.resolve(__dirname, './wasm/protocol_utils.js'), "utf8"));
    let followbot_config = eval(await fs.readFile(path.resolve(__dirname, './wasm/followbot_config.js'), "utf8"));

    let autospin_packet = packet_constructors.construct_command_packet(1);
    let autofire_packet = packet_constructors.construct_command_packet(0);

    for (let upgrade in bot_upgrades) {
        let upgrades = bot_upgrades[upgrade];
        upgrades.autofire = autofire_packet;
        if (upgrades.autospin) upgrades.autospin = autospin_packet;
        upgrades.tanks.reverse();
        bot_upgrades[upgrade].growth_extended_upgrades_order_to_max.reverse();
        for (let tank_upgrade in upgrades.tanks) {
            upgrades.tanks[tank_upgrade] = packet_constructors.construct_tank_upgrade_packet(upgrades.tanks[tank_upgrade]);
        };
        for (let stat_upgrade in upgrades.stats) {
            upgrades.stats[stat_upgrade] = packet_constructors.construct_stat_upgrade_packet(upgrades.stats[stat_upgrade][0], upgrades.stats[stat_upgrade][1]);
        };
    };

    if (use_self_IP_as_bot) proxies.push("");
    if (bot_count > proxies.length) throw Error("Please make sure the bot count is within the length of the proxies");

    let target = {
        server: undefined,
        x: undefined, 
        y: undefined,
        facing: [undefined, undefined],
        focus_fire: undefined,
        node_data: false
    };
    
    let workers = [];

    let middle_ws = new WebSocket('ws://localhost:8080');
    middle_ws.binaryType = 'arraybuffer';


    middle_ws.onopen = function() {
        setInterval(() => { 
            middle_ws.send(new Uint8Array([1]).buffer); 
            if (!target.server) middle_ws.send(new Uint8Array([3]).buffer); 
        }, update_rate);
    };

    middle_ws.onmessage = function(e) {
        handle_packet(e.data);
    };

    middle_ws.onclose = function() {
        throw Error("the middle ws was closed unexpectedly.");
    };

    function handle_packet(packet_buffer) {
        let packet = new DataView(packet_buffer);
        switch (packet.getUint8(0)) {
            case 0:
                target.x = packet.getFloat32(1, true);
                target.y = packet.getFloat32(5, true);
                target.facing = yield_control_comps_from_angle(packet.getFloat32(9, true));
                target.focus_fire = packet.getUint8(13);
                if (packet_buffer.byteLength == 16) target.node_data = [packet.getUint8(14), packet.getUint8(15)];
            break;
            case 2:
                target.server = new TextDecoder().decode(new Uint8Array(packet_buffer.slice(1, packet_buffer.byteLength)));
                for (let bot = 0; bot < bot_count; bot++) {
                    let worker = new Worker(path.resolve(__dirname, './bot_worker.js'), {
                        workerData: [
                            user_agent,
                            proxies[bot], 
                            target.server,
                            bot_upgrades[bot % bot_upgrades.length],
                            randomize_names ? undefined : bot_names[bot % bot_names.length],
                            bot_pathfind,
                            followbot_config,
                            bot
                        ] 
                    }); 
                    worker.on('message', (data) => {
                        if (data[0] == 0) {
                            console.log(`Bot #${bot} failed.`);
                            worker.terminate();
                        } else {
                            middle_ws.send(data[1]);
                        };
                    });
                    setInterval(() => {
                        worker.postMessage(`${target.x},${target.y},${target.facing[0]},${target.facing[1]},${target.focus_fire}` + (target.node_data ? `,${target.node_data[0]},${target.node_data[1]}` : ""));
                    }, update_rate);
                    workers.push(worker);
                };
            break;
            case 255:
                for (let worker in workers) workers[worker].terminate();
                target.server = undefined;
                workers = [];
            break;
        }
    };
})();

