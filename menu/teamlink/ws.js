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
                    if (!target_server_packet) {
                        target_server_packet = packet;
                        entity_reciever_socket = ws;
                    } else {
                        bl_socket.send(new Uint8Array([255]).buffer);
                        target_server_packet = undefined;
                        entity_reciever_socket = undefined;
                    };
                break;
                case 3:
                    if (!bl_socket) bl_socket = ws;
                    if (target_server_packet) ws.send(target_server_packet);
                break;
                case 4:
                case 74:
                    if (entity_reciever_socket) entity_reciever_socket.send(packet);
                break;
                }
            });
        });
})();