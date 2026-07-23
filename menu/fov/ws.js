const WebSocket = require('ws');
const fs = require('fs').promises;
const path = require('path');

(async () => {
    let wss = new WebSocket.Server({ port: 8080 });

    console.log('Served started for ws://localhost:8080');

    let coords_packet = new Uint8Array([255]).buffer;
    let target_server_packet;
    let entity_reciever_socket;
    let bl_socket;

    let packets_match = (first, second) => {
        if (!first || !second) return false;
        let a = new Uint8Array(first);
        let b = new Uint8Array(second);
        if (a.byteLength !== b.byteLength) return false;
        for (let index = 0; index < a.byteLength; index++) {
            if (a[index] !== b[index]) return false;
        }
        return true;
    };

    let clear_target_server = () => {
        if (bl_socket && bl_socket.readyState === WebSocket.OPEN) {
            bl_socket.send(new Uint8Array([255]).buffer);
        }
        target_server_packet = undefined;
        entity_reciever_socket = undefined;
    };

    wss.on('connection', (ws) => {
        ws.on('message', (packet) => {
            let packet_bytes = new Uint8Array(packet);
            switch (packet_bytes[0]) {
                case 0:
                    coords_packet = packet;
                break;
                case 1:
                    ws.send(coords_packet);
                break;
                case 2:
                    let had_target_server = !!target_server_packet;
                    let same_target_server = packets_match(packet, target_server_packet);
                    target_server_packet = packet;
                    entity_reciever_socket = ws;
                    if (!same_target_server && bl_socket && bl_socket.readyState === WebSocket.OPEN) {
                        if (had_target_server) {
                            bl_socket.send(new Uint8Array([255]).buffer);
                        }
                        bl_socket.send(packet);
                    };
                break;
                case 5:
                    if (ws === entity_reciever_socket) clear_target_server();
                break;
                case 3:
                    if (!bl_socket) bl_socket = ws;
                    if (target_server_packet) ws.send(target_server_packet);
                break;
                case 4:
                case 6:
                case 74:
                    if (entity_reciever_socket) entity_reciever_socket.send(packet);
                break;
                }
            });
        ws.on('close', () => {
            if (ws === entity_reciever_socket) clear_target_server();
            if (ws === bl_socket) bl_socket = undefined;
        });
        });
})();
