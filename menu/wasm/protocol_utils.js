(() => {
let rotator_table = [1, 2, 3, 3, 3, 3, 3, 3, 4, 3];

function i64_as_f32(var2) {
    const result = Number(var2);
    return Math.fround(result);
};

function i64_extend_i32_u(var2) {
    return BigInt(var2 >>> 0);
};

function decode_packet(packet, header = undefined) {
    let packet_read_index = 0;
    let remaining_packet_len = packet.length;
    let decoded_packet = [];
    let offsets = [];

    if (header) {
        packet_read_index = 1;
        remaining_packet_len = packet.length - 1;
        decoded_packet = [header];
        offsets = [0];
    };

    while (remaining_packet_len > 0) {
        let var1, var2, var3, var4, var5, var6, var7, var8;

        var8 = remaining_packet_len;
        var5 = var8 - 1;
        remaining_packet_len = var5;
        offsets.push(packet_read_index);
        var3 = packet_read_index;
        var6 = packet_read_index + 1;
        packet_read_index = var6;

        var2 = packet[var3];
        var7 = (var2 ^ 255);
        var7 = Math.clz32(var7);
        var7 = var7 - 24;
        var7 = var7 & 255;

        switch (rotator_table[var7]) {
            case 1:
                decoded_packet.push(i64_as_f32(BigInt(var2)));
                break;
            case 2:
                var2 |= -64;
                decoded_packet.push(i64_as_f32(BigInt(var2) | -4294967296n));
                break;
            case 3:
                var3 = var7 - 2;
                remaining_packet_len = var5 - var3;
                var8 = var3 + var6;
                packet_read_index = var8;
                var1 = var7 + 25;
                var5 = (var2 << var1) >> var1;
                var2 = var5;
                block7: {
                    if (var3 == 0) break block7;
                    var4 = var3 & 7;
                    if (var4) {
                        var1 = var6;
                        var2 = var5;
                        while (var4) {
                            var2 = (var2 << 8) | packet[var1];
                            var6 = var1 + 1;
                            var1 = var6;
                            var4 = var4 - 1;
                        }
                    }
                }
                if (var5 < 0) {
                    decoded_packet.push(i64_as_f32(i64_extend_i32_u(var2) | -4294967296n));
                } else {
                    decoded_packet.push(i64_as_f32(i64_extend_i32_u(var2)));
                }
                break;
            case 4:
                decoded_packet.push(new Float32Array(packet.slice(packet_read_index, packet_read_index + 4).buffer)[0]);
                packet_read_index += 4;
                remaining_packet_len -= 4;
                break;
        }
    }
    return [decoded_packet, offsets];
};

class update_parser {
    constructor() {
        this.player = {};
        this.entities = {};
        this.deleted_entities = [];
        this.tick = 0;
        this.decoder = new TextDecoder();
        this.static_mockups = [];
    }

    parse(packet, offsets, encoded_packet) {
        this.deleted_entities = [];
        this.player.x = packet[1];
        this.player.y = packet[2];
        if (this.player.entity_data) {
            this.player.entity_data.x = this.player.x;
            this.player.entity_data.y = this.player.y;
        };
        this.player.fov = packet[3];
        if (packet.length > 5) {
            let flags = packet[4];
            let offset = 5;
            if (flags & (1 << 0)) {
                this.player.mspt = packet[offset++];
            }
            if (flags & (1 << 1)) {
                this.player.speed = packet[offset++];
            }
            if (flags & (1 << 2)) {
                this.player.mockup_id = packet[offset++];
                // Mockup value repeats for some reason, so I'm just skipping the extra one.
                offset++;
            }
            if (flags & (1 << 3)) {
                this.player.color = packet[offset++];
                this.player.id = packet[offset++];
            }
            if (flags & (1 << 4)) {
                this.player.score = packet[offset++];
            }
            if (flags & (1 << 5)) {
                this.player.kill_stats = {
                    player: packet[offset++],
                    assist: packet[offset++],
                    boss: packet[offset++],
                    polygon: packet[offset]
                }
            }
            if (flags & (1 << 6)) {
                this.player.stat_points = packet[offset++];
            }
            if (flags & (1 << 7)) {
                this.player.stat_points = packet[offset++];
                if (!this.player.stats) {
                    this.player.stats = [];
                    for (let stat = 0; stat < 10; stat++) this.player.stats[stat] = {
                        max: packet[offset++]
                    };
                } else {
                    for (let stat = 0; stat < 10; stat++) this.player.stats[stat].max = packet[offset++];
                }
            }
            if (flags & (1 << 8)) {
                for (let stat = 0; stat < 10; stat++) this.player.stats[stat].value = packet[offset++];
            }
            if (flags & (1 << 9)) {
                let upgrades_len = packet[offset++];
                this.player.upgrades = [];
                for (let upgrade = 0; upgrade < upgrades_len; upgrade++) this.player.upgrades.push(packet[offset++]);
            }
            offset = packet.indexOf(-1, 4) + 1;
            while (packet[offset] !== -1) {
                let id = packet[offset++];
                if (this.entities[id]) this.delete_entity(id, this.entities[id].mockup_id);
            };
            /*offset++;
            while (offset < packet.length - 1) {
                let id = packet[offset++];
                let result = this.parse_entity(packet, offset, id, offsets, encoded_packet);
                if (id == this.player.id) {
                    result[0].x = this.player.x;
                    result[0].y = this.player.y;
                    this.player.entity_data = result[0];
                };
                this.entities[id] = result[0];
                offset = result[1];
            }*/
        }
        // this.determine_entity_deletions();
        this.tick++;
    }

    delete_entity(id, mockup_id) {
        if (!this.static_mockups[mockup_id]) {
            this.deleted_entities.push(id);
            delete this.entities[id];
        }
    }

    determine_entity_deletions() {
        for (let id in this.entities) {
            let entity = this.entities[id];
            let dx_check = Math.abs(entity.x - this.player.x) > this.player.fov + 60 + entity.size * 2;
            let dy_check = Math.abs(entity.y - this.player.y) > this.player.fov * 0.5 + 60 + entity.size * 2;
            if (this.tick - entity.last_updated > 5 && (
            dx_check ||
            dy_check ||
            entity.health !== 1 ||
            ((entity.flags_data.auto_spin || entity.color == 5 || entity.color > 15) && entity.layer > 7) ||
            entity.flags == 0 || 
            ((entity.flags_data.damage_indicator_first_degree || 
            entity.flags_data.damage_indicator_second_degree) && !entity.flags_data.idk_flag)
            )) {
                //this.delete_entity(id, entity.mockup_id);
            };
        }; 
    }

    parse_entity(packet, offset, id, offsets, encoded_packet) {
        let entity;

        if (!this.entities[id]) {
            entity = {flags_data: {}};
        } else {
            entity = this.entities[id];
        }

        let flags = packet[offset++];

        if (flags & (1 << 0)) {
            let dx = packet[offset++] / 4;
            let dy = packet[offset++] / 4;
            if (entity.x === undefined || entity.y === undefined) {
                entity.x = dx;
                entity.y = dy;
            } else {
                entity.x += dx;
                entity.y += dy;
                entity.dx = dx;
                entity.dy = dy;
            }
        }
        if (flags & (1 << 1)) {
            let dv = packet[offset++] * Math.PI / 512;
            entity.angle = entity.angle ? entity.angle + dv : dv;
        }
        if (flags & (1 << 2)) {
            entity.mockup_id = packet[offset++];
        }
        if (flags & (1 << 3)) {
            entity.guns = entity.guns || {};
            while (packet[offset] !== -1) {
                let gun_index = packet[offset++];
                let gun_flags = packet[offset++];
                let time, power;
                if (gun_flags & (1 << 0)) {
                    time = packet[offset++];
                }
                if (gun_flags & (1 << 1)) {
                    power = packet[offset++];
                }
                entity.guns[gun_index] = {
                    flags: gun_flags,
                    time: time,
                    power: power
                }
            }
            offset++;
        }
        if (flags & (1 << 4)) {
            entity.turrets = entity.turrets || {};
            while (packet[offset] !== -1) {
                let turret_index = packet[offset++];
                let turret = this.parse_entity(packet, offset, undefined, offsets, encoded_packet);
                offset = turret[1];
                entity.turrets[turret_index] = turret[0];
            }
            offset++;
        }
        if (flags & (1 << 5)) {
            entity.flags = packet[offset++];
            if (entity.flags & (1 << 0)) entity.flags_data.auto_spin = true;
            if (entity.flags & (1 << 1)) entity.flags_data.reverse_tank = true;
            // Not certain exactly what this flag is
            if (entity.flags & (1 << 2)) entity.flags_data.idk_flag = true;
            if (entity.flags & (1 << 3)) entity.flags_data.invuln = true;
            // Note that both of these damage indicators can be turned on, which indicates max damage/penetration. Sort of like a "regular" hit and "critical" hit indicator, with second_degree being stronger than first, and both being on the max.
            if (entity.flags & (1 << 4)) entity.flags_data.damage_indicator_first_degree = true;
            if (entity.flags & (1 << 5)) entity.flags_data.damage_indicator_second_degree = true;
        }
        if (flags & (1 << 6)) {
            entity.health = packet[offset++] / 255;
        }
        if (flags & (1 << 7)) {
            entity.shield = packet[offset++] / 255;
        }
        if (flags & (1 << 8)) {
            entity.opacity = packet[offset++] / 255;
        }
        if (flags & (1 << 9)) {
            entity.size = Math.abs(packet[offset++]) * 0.0625;
        }
        if (flags & (1 << 10)) {
            entity.score = packet[offset++];
        }
        if (flags & (1 << 11)) {
            let name_len = encoded_packet[offsets[offset++]] - 192;
            let name_offset = offsets[offset];
            let bytes = 0;
            let name = "";
            while (bytes !== name_len) {
                let byte = encoded_packet[name_offset];
                let length;
                if (byte < 128) {
                    length = 1;
                } else if (byte >= 192 && byte <= 223) {
                    length = 2;
                } else if (byte >= 224 && byte <= 239) {
                    length = 3;
                } else {
                    length = 4;
                };
                name += this.decoder.decode(encoded_packet.slice(name_offset, name_offset + length));
                bytes += length;
                name_offset += length;
                offset += length == 1 ? 1 : 2;
            };
            entity.name = name;
        }
        if (flags & (1 << 12)) {
            entity.color = packet[offset++];
        }
        if (flags & (1 << 13)) {
            entity.layer = packet[offset++];
        }
        entity.last_updated = this.tick;
        return [entity, offset];
    }
}

class broadcast_parser {
    constructor() {
        this.global_minimap = {};
        this.team_minimap = {};
        this.leaderboard = {};
        this.decoder = new TextDecoder();
    }

    parse(packet, offsets, encoded_packet) {
        let offset = 1;
        offset = this.parse_global_minimap_deletions(packet, offset, offsets, encoded_packet);
        offset = this.parse_global_minimap(packet, offset, offsets, encoded_packet);
        offset = this.parse_team_minimap_deletions(packet, offset, offsets, encoded_packet);
        offset = this.parse_team_minimap(packet, offset, offsets, encoded_packet);
        offset = this.parse_leaderboard_deletions(packet, offset, offsets, encoded_packet);
        offset = this.parse_leaderboard(packet, offset, offsets, encoded_packet);
    }

    parse_global_minimap(packet, offset) {
        let len = packet[offset++];
        for (let iter = 0; iter < len; iter++) {
            let id = packet[offset++];
            let type = packet[offset++];
            this.global_minimap[id] = {
                type: type,
                x: packet[offset++],
                y: packet[offset++],
                color: packet[offset++],
                size: packet[offset++],
            }
        }
        return offset;
    }

    parse_global_minimap_deletions(packet, offset) {
        let len = packet[offset++];
        for (let iter = 0; iter < len; iter++) {
            delete this.global_minimap[packet[offset++]];
        }
        return offset;
    }

    parse_team_minimap(packet, offset) {
        let len = packet[offset++];
        for (let iter = 0; iter < len; iter++) {
            this.team_minimap[packet[offset++]] = {
                x: packet[offset++],
                y: packet[offset++],
                color: packet[offset++],
            }
        }
        return offset;
    }

    parse_team_minimap_deletions(packet, offset) {
        let len = packet[offset++];
        for (let iter = 0; iter < len; iter++) {
            delete this.team_minimap[packet[offset++]];
        }
        return offset;
    }

    parse_leaderboard(packet, offset, offsets, encoded_packet) {
        let len = packet[offset++];
        for (let iter = 0; iter < len; iter++) {
            let id = packet[offset++];
            let entry = {
                score: packet[offset++],
                mockup_index: packet[offset++]
            };
            let name_len = encoded_packet[offsets[offset++]] - 192;
            let name_offset = offsets[offset];
            let bytes = 0;
            let name = "";
            while (bytes !== name_len) {
                let byte = encoded_packet[name_offset];
                let length;
                if (byte < 128) {
                    length = 1;
                } else if (byte >= 192 && byte <= 223) {
                    length = 2;
                } else if (byte >= 224 && byte <= 239) {
                    length = 3;
                } else {
                    length = 4;
                };
                name += this.decoder.decode(encoded_packet.slice(name_offset, name_offset + length));
                bytes += length;
                name_offset += length;
                offset += length == 1 ? 1 : 2;
            };
            entry.name = name;
            entry.color = packet[offset++];
            entry.bar_color = packet[offset++];
            this.leaderboard[id] = entry;
        }
        return offset;
    }

    parse_leaderboard_deletions(packet, offset) {
        let len = packet[offset++];
        for (let iter = 0; iter < len; iter++) {
            delete this.leaderboard[packet[offset++]];
        }
        return offset;
    }
}

class mockup_parser {
    constructor() {
        this.mockups = {};
        this.mockups_name_id_map = {};
        this.decoder = new TextDecoder();
    }

    parse(packet) {
        let offset = 0;
        
        while (offset < packet.length - 10) { 
            
            // 1. Detection: Type check (Mockup ID is usually < 200)
            if (Number.isInteger(packet[offset]) && packet[offset] > 0 && packet[offset] < 200) {

                let type = packet[offset];
                
                // 2. Determine Structure: [Type, ID, Len, Name...] vs [Type, Len, Name...]
                let val1 = packet[offset + 1]; // Candidate for ID or Len
                let val2 = packet[offset + 2]; // Candidate for Len or FirstChar

                let has_entity_id = true;
                
                // Heuristic: Names are rarely > 64 chars. ASCII chars are usually > 32.
                if (val1 > 64) {
                    // val1 is too big to be a length, so it must be an Entity ID.
                    has_entity_id = true; 
                } else if (val2 >= 32 && val2 <= 126) {
                    // val2 looks like a valid character. 
                    // This implies val1 was the Length. Structure is [Type, Len, Char...]
                    has_entity_id = false;
                } else {
                    // val2 is small (likely a Length). 
                    // This implies val1 was a small ID. Structure is [Type, ID, Len...]
                    has_entity_id = true;
                }

                // 3. Extract Name Data based on structure
                let name_len = has_entity_id ? packet[offset + 2] : packet[offset + 1];
                
                // Handle compressed length if necessary
                if (name_len < 0) name_len = 32 + name_len; 

                // Determine where the name string starts
                let name_start_index = has_entity_id ? offset + 3 : offset + 2;

                // Safety Check
                if (name_start_index + name_len + 10 > packet.length) {
                    offset++; continue;
                }

                // 4. Parse Name
                let potential_name_bytes = packet.slice(name_start_index, name_start_index + name_len);
                let cleaned_name = "";
                
                if (!potential_name_bytes.some(byte => byte > 255)) {
                    try {
                        let potential_name = this.decoder.decode(new Uint8Array(potential_name_bytes));
                        cleaned_name = potential_name.split("/")[0].trim(); // Remove suffixes like /0
                    } catch (e) { cleaned_name = ""; }
                }

                // Only process if name is valid
                if (cleaned_name.length > 0 && !/[\p{C}\uFFFD]/u.test(cleaned_name)) {
                    
                    // 5. Properties (Color, Shape)
                    // Located immediately after name
                    let end_of_name = name_start_index + name_len;
                    let color = packet[end_of_name + 1]; 
                    let shape = packet[end_of_name + 2]; 

                    if (shape === 2048) shape = 0;
                    else if (shape > 1024) shape -= 1024;
                    
                    // 6. Counts & Physics Skip
                    // Structure: Shape -> [Size, 0, Float, Float, 0] -> GunCount
                    // We skip 5 indices after Shape to get to GunCount
                    let gun_count_index = end_of_name + 2 + 6; 
                    let turret_count_index = end_of_name + 2 + 7;

                    let gun_count = packet[gun_count_index];
                    let turret_count = packet[turret_count_index];
                    
                    let turrets = [];
                    let guns = [];

                    let data_cursor = turret_count_index + 1;
                    const GUN_STRIDE = 6; 
                    const TURRET_STRIDE = 6;

                    // 7. Parse Guns
                    for (let i = 0; i < gun_count; i++) {
                        if (data_cursor + GUN_STRIDE > packet.length) break;
                        let props = packet.slice(data_cursor, data_cursor + GUN_STRIDE);
                        guns.push({
                            length: props[1],
                            width:  props[2],
                            aspect: props[3],
                            x:      props[4],
                            y:      props[5]
                        });
                        data_cursor += GUN_STRIDE;
                    }

                    // 8. Parse Turrets
                    for (let i = 0; i < turret_count; i++) {
                        if (data_cursor + TURRET_STRIDE > packet.length) break;
                        let props = packet.slice(data_cursor, data_cursor + TURRET_STRIDE);
                        turrets.push({
                            linked_id: props[0], 
                            x:         props[1], 
                            y:         props[2],
                            angle:     props[5]
                        });
                        data_cursor += TURRET_STRIDE;
                    }

                    // 9. Save
                    this.mockups[type] = {
                        name: cleaned_name,
                        shape: shape,
                        color: color,
                        turrets: turrets,
                        guns: guns,
                        // If there was an ID, we could store it, but for 'no ID' rows it's irrelevant
                        real_id: has_entity_id ? packet[offset + 1] : 0 
                    };
                    this.mockups_name_id_map[cleaned_name] = type;

                    // Jump cursor
                    offset = data_cursor - 1;
                }
            }
            offset++;
        }
    }
}

class player_tab_parser {
    constructor() {
        this.players = {};
        this.decoder = new TextDecoder();
    }

    parse(packet, offsets, encoded_packet) {
        let deletions_len = packet[1];
        for (let deletion = 0; deletion < deletions_len; deletion += 1) delete this.players[packet[2 + deletion]];
        let offset = 2 + deletions_len;
        let additions_len = packet[offset++];
        for (let addition = 0; addition < additions_len; addition += 1) {
            let id = packet[offset++];
            let tier = packet[offset++];
            let name_len = encoded_packet[offsets[offset++]] - 192;
            let name_offset = offsets[offset];
            let bytes = 0;
            let name = "";
            while (bytes !== name_len) {
                let byte = encoded_packet[name_offset];
                let length;
                if (byte < 128) {
                    length = 1;
                } else if (byte >= 192 && byte <= 223) {
                    length = 2;
                } else if (byte >= 224 && byte <= 239) {
                    length = 3;
                } else {
                    length = 4;
                };
                name += this.decoder.decode(encoded_packet.slice(name_offset, name_offset + length));
                bytes += length;
                name_offset += length;
                offset += length == 1 ? 1 : 2;
            };
            this.players[id] = {
                tier: tier,
                name: name,
                mockup_index: packet[offset++]
            };
        }
    }
}

class room_parser {
    constructor() {
        this.room_dimensions = [];
        this.grid = [];
    }

    parse(packet, game_data) {
        let split_game_data = game_data.split(",");
        for (let entry in split_game_data) {
            let current_data = split_game_data[entry].split("=");
            this[current_data[0]] = current_data[1];
        };
        this.room_dimensions = [packet[0], packet[1], packet[2], packet[3]];
        // Unsure of what either of these values are, usually just 1 and 45
        let idk_1 = packet[4];
        let idk_2 = packet[5];
        let grid_width = packet[6];
        let grid_height = packet[7];
        this.grid = Array.from({
            length: grid_height
        }, () => Array.from({
            length: grid_width
        }, () => 0));
        let grid_data = packet.slice(8, packet.length);
        let iter = 0;
        for (let y = 0; y < grid_height; y++) {
            for (let x = 0; x < grid_width; x++) {
                this.grid[y][x] = grid_data[iter];
                iter++;
            }
        }
    }
}

class maze_map_manager {
    constructor() {
        this.map = undefined;
        this.room_width = 0;
        this.room_height = 0;
        this.node_half_width = 0;
        this.node_half_height = 0;
        this.map_width = 0;
        this.map_height = 0;
        this.encoding_shift = 0;
        this.pathfinding_dirs = [
            [-1, 0],
            [0, -1],
            [1, 0],
            [0, 1]
        ];
    }

    check_if_map_is_maze(global_minimap) {
        for (let id in global_minimap)
            if (global_minimap[id].type == 2) return true;
        return false;
    }

    parse_maze_map(room, global_minimap) {
        let sizes = {};
        for (let id in global_minimap)
            if (global_minimap[id].type == 2)
                if (!sizes[global_minimap[id].size]) sizes[global_minimap[id].size] = true;
        let sizes_values = Object.keys(sizes);
        let first_size = sizes_values[0];
        for (let iter = 1; iter < sizes_values.length; iter++)
            if (sizes_values[iter] < first_size) sizes_values[iter] = first_size;
        this.room_width = room.room_dimensions[2] - room.room_dimensions[0];
        this.room_height = room.room_dimensions[3] - room.room_dimensions[1];
        this.map_width = Math.trunc(this.room_width / first_size * 0.5);
        this.map_height = Math.trunc(this.room_height / first_size * 0.5);
        this.encoding_shift = Math.ceil(Math.log2(this.map_height));
        this.node_half_width = (this.room_width / this.map_width) * 0.5;
        this.node_half_height = (this.room_height / this.map_height) * 0.5;
        this.map = Array.from({
            length: this.map_height
        }, () => Array.from({
            length: this.map_width
        }, () => 0));
        let dx = 255 / this.map_width;
        let dy = 255 / this.map_height;
        for (let id in global_minimap) {
            if (global_minimap[id].type == 2) {
                let size = Math.trunc(global_minimap[id].size / first_size);
                let x_pos = Math.round((global_minimap[id].x - dx * (size / 2)) / dx);
                let y_pos = Math.round((global_minimap[id].y - dy * (size / 2)) / dy);
                for (let y = 0; y < size; y++)
                    for (let x = 0; x < size; x++) this.map[y_pos + y][x_pos + x] = global_minimap[id].color;
            }
        }
        let room_grid_node_size = this.map_height / room.grid.length;
        for (let y = 0; y < room.grid.length; y++) {
            for (let x = 0; x < room.grid[0].length; x++) {
                if (room.grid[y][x] == 10 || room.grid[y][x] == 11 || room.grid[y][x] == 12 || room.grid[y][x] == 15) {
                    for (let height = 0; height < room_grid_node_size; height++) {
                        for (let width = 0; width < room_grid_node_size; width++) {
                            this.map[Math.trunc(y * room_grid_node_size) + height][Math.trunc(x * room_grid_node_size) + width] = room.grid[y][x];
                        }
                    }
                }
            }
        }
    }

    parse_map_coordinate(x, y) {
        let x_ratio = x / 255;
        let y_ratio = y / 255;
        if (x_ratio < 0) {
            x_ratio = 0;
        } else if (x_ratio > 1) x_ratio = 1;
        if (y_ratio < 0) {
            y_ratio = 0;
        } else if (y_ratio > 1) y_ratio = 1;
        return [Math.trunc(x_ratio * this.map_width), Math.trunc(y_ratio * this.map_height)];
    }

    parse_position_coordinate(x, y, room_dimensions) {
        let x_ratio = (x - room_dimensions[0]) / this.room_width;
        let y_ratio = (y - room_dimensions[1]) / this.room_height;
        if (x_ratio < 0) {
            x_ratio = 0;
        } else if (x_ratio > 1) x_ratio = 1;
        if (y_ratio < 0) {
            y_ratio = 0;
        } else if (y_ratio > 1) y_ratio = 1;
        return [Math.trunc(x_ratio * this.map_width), Math.trunc(y_ratio * this.map_height)];
    }

    find_path(i, f, color) {
        let [start_x, start_y] = i;
        let [end_x, end_y] = f;
        if (start_x == end_x && start_y == end_y) return [];
        let start_encoded = (start_y << this.encoding_shift) | start_x;
        let end_encoded = (end_y << this.encoding_shift) | end_x;
        let queue = [start_encoded];
        let visited = new Set([start_encoded]);
        let parent_map = new Map();
        let path_found = false;
        let x_mask = (1 << this.encoding_shift) - 1;
        while (queue.length > 0) {
            let current_encoded = queue.shift();
            if (current_encoded == end_encoded) {
                path_found = true;
                break;
            }
            let curr_x = current_encoded & x_mask;
            let curr_y = current_encoded >> this.encoding_shift;
            for (let [dx, dy] of this.pathfinding_dirs) {
                let next_x = curr_x + dx;
                let next_y = curr_y + dy;
                if (next_x >= 0 && next_x < this.map_width && next_y >= 0 && next_y < this.map_height) {
                    let next_encoded = (next_y << this.encoding_shift) | next_x;
                    if (!visited.has(next_encoded)) {
                        let tile_value = this.map[next_y][next_x];
                        if (tile_value == 0 || tile_value == 17 || tile_value == color || next_encoded == end_encoded) {
                            visited.add(next_encoded);
                            parent_map.set(next_encoded, current_encoded);
                            queue.push(next_encoded);
                        }
                    }
                }
            }
        }
        if (!path_found) return [];
        let final_path = [];
        let current_step = parent_map.get(end_encoded);
        while (current_step != undefined && current_step != start_encoded) {
            final_path.push([current_step & x_mask, current_step >> this.encoding_shift]);
            current_step = parent_map.get(current_step);
        }
        return final_path.reverse();
    }
}

const CONTROL_FLAGS = {
    up: 1,
    down: 2,
    left: 4,
    right: 8,
    shooting: 16,
    secondary: 32
};

// The C packet is 67/"C", encoded x aim offset, encoded y aim offset,
// encoded movement flags. construct_control_packet accepts decoded signed
// offsets; construct_control_packet_from_raw_components keeps the older raw
// one-byte component behavior used by the wasm hooks.

function concat_uint8_arrays(...arrays) {
    let length = arrays.reduce((total, array) => total + array.length, 0);
    let output = new Uint8Array(length);
    let offset = 0;
    for (let array of arrays) {
        output.set(array, offset);
        offset += array.length;
    }
    return output;
}

function encode_packet_value(value) {
    if (!Number.isFinite(value)) throw new TypeError("Packet value must be finite.");

    if (!Number.isInteger(value)) {
        let output = new Uint8Array(5);
        output[0] = 255;
        new DataView(output.buffer).setFloat32(1, value, true);
        return output;
    }

    if (value >= 0 && value <= 127) return new Uint8Array([value]);
    if (value >= -64 && value < 0) return new Uint8Array([value + 192]);

    let encoded_value = BigInt(value);
    for (let descriptor of [
        { prefix_bits: 3, payload_bits: 12, extra_bytes: 1 },
        { prefix_bits: 4, payload_bits: 19, extra_bytes: 2 },
        { prefix_bits: 5, payload_bits: 26, extra_bytes: 3 }
    ]) {
        let min = -(1n << BigInt(descriptor.payload_bits - 1));
        let max = (1n << BigInt(descriptor.payload_bits - 1)) - 1n;
        if (encoded_value < min || encoded_value > max) continue;

        let payload = encoded_value < 0n
            ? (1n << BigInt(descriptor.payload_bits)) + encoded_value
            : encoded_value;
        let first_payload_bits = 7 - descriptor.prefix_bits;
        let first_payload_mask = (1n << BigInt(first_payload_bits)) - 1n;
        let prefix = ((1 << descriptor.prefix_bits) - 1) << (8 - descriptor.prefix_bits);
        let output = new Uint8Array(1 + descriptor.extra_bytes);
        output[0] = prefix | Number((payload >> BigInt(8 * descriptor.extra_bytes)) & first_payload_mask);
        for (let index = 0; index < descriptor.extra_bytes; index += 1) {
            let shift = BigInt(8 * (descriptor.extra_bytes - index - 1));
            output[index + 1] = Number((payload >> shift) & 255n);
        }
        return output;
    }

    throw new RangeError("Packet value is outside the supported integer range.");
}

function parse_control_flags(flags) {
    return {
        raw: flags,
        up: !!(flags & CONTROL_FLAGS.up),
        down: !!(flags & CONTROL_FLAGS.down),
        left: !!(flags & CONTROL_FLAGS.left),
        right: !!(flags & CONTROL_FLAGS.right),
        shooting: !!(flags & CONTROL_FLAGS.shooting),
        secondary: !!(flags & CONTROL_FLAGS.secondary),
        extra: flags & ~Object.values(CONTROL_FLAGS).reduce((mask, bit) => mask | bit, 0)
    };
}

function construct_control_packet(x, y, flags = 0) {
    return concat_uint8_arrays(
        new Uint8Array([67]),
        encode_packet_value(x),
        encode_packet_value(y),
        encode_packet_value(flags)
    );
}

function construct_control_packet_from_raw_components(x_comp, y_comp, flags = 0) {
    return new Uint8Array([67, x_comp, y_comp, flags]);
}

function parse_control_packet(encoded_packet) {
    let decoded_packet = decode_packet(new Uint8Array(encoded_packet), "C")[0];
    let flags = decoded_packet[3] || 0;
    return {
        header: decoded_packet[0],
        x: decoded_packet[1],
        y: decoded_packet[2],
        flags,
        movement: parse_control_flags(flags),
        decoded_packet
    };
}

function yield_control_comps_from_angle(angle) {
    let cartesian_x_comp = -Math.cos(angle);
    let cartesian_y_comp = Math.sin(angle);
    let x_comp = Math.min(63, Math.floor(Math.abs(cartesian_x_comp) * 64));
    let y_comp = Math.min(63, Math.floor(Math.abs(cartesian_y_comp) * 64));
    if (cartesian_x_comp < 0) x_comp = 191 - x_comp;
    if (cartesian_y_comp > 0) y_comp = 191 - y_comp;
    return [x_comp, y_comp];
};

let packet_constructors = {
    construct_message_packet: function construct_message_packet(message) {
        let packet;
        let encoded_message = new TextEncoder().encode(message);
        if (message.length < 32) {
            packet = new Uint8Array(message.length + 2);
            packet[1] = message.length + 192;
            packet.set(encoded_message, 2);
        } else {
            packet = new Uint8Array(message.length + 4);
            packet[1] = 254;
            packet[2] = message.length;
            packet[3] = 0;
            packet.set(encoded_message, 4);
        }
        packet[0] = 77;
        return packet;
    },
    construct_spawn_packet: function construct_spawn_packet(name, party) {
        let encoded_name = new TextEncoder().encode(name);
        let encoded_party = new TextEncoder().encode(party);
        let packet = new Uint8Array(encoded_name.byteLength + encoded_party.byteLength + 4);
        packet[1] = 192 + encoded_name.byteLength;
        packet.set(encoded_name, 2);
        packet[2 + encoded_name.length] = 192 + encoded_party.byteLength;
        packet.set(encoded_party, 3 + encoded_name.length);
        packet[packet.byteLength - 1] = 1;
        packet[0] = 115;
        return packet;
    },
    construct_tank_upgrade_packet: function construct_tank_upgrade_packet(upgrade) {
        return new Uint8Array([85, upgrade]);
    },
    construct_stat_upgrade_packet: function construct_stat_upgrade_packet(stat, len) {
        return new Uint8Array([120, stat, len]);
    },
    construct_command_packet: function construct_command_packet(action) {
        return new Uint8Array([116, action]);
    },
    encode_packet_value,
    construct_control_packet,
    construct_control_packet_from_raw_components,
    construct_control_acket: construct_control_packet_from_raw_components,
    parse_control_packet,
    parse_control_flags,
    CONTROL_FLAGS
};
return [decode_packet, update_parser, broadcast_parser, mockup_parser, player_tab_parser, room_parser, maze_map_manager, yield_control_comps_from_angle, packet_constructors];
})();
