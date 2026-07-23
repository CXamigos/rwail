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
    let sockets = new Set();

    function send_to_bl(packet) {
        if (bl_socket && bl_socket.readyState === WebSocket.OPEN) bl_socket.send(packet);
    }

    function send_to_entity_receiver(packet) {
        if (entity_reciever_socket && entity_reciever_socket.readyState === WebSocket.OPEN) {
            entity_reciever_socket.send(packet);
        }
    }

    function broadcast_to_clients(packet) {
        for (let socket of sockets) {
            if (socket !== bl_socket && socket.readyState === WebSocket.OPEN) {
                socket.send(packet);
            }
        }
    }

    function packets_match(first, second) {
        if (!first || !second) return false;
        let a = new Uint8Array(first);
        let b = new Uint8Array(second);
        if (a.byteLength !== b.byteLength) return false;
        for (let index = 0; index < a.byteLength; index++) {
            if (a[index] !== b[index]) return false;
        }
        return true;
    }

    function clear_target_server() {
        target_server_packet = undefined;
        entity_reciever_socket = undefined;
        coords_packet = new Uint8Array([255]).buffer;
        send_to_bl(new Uint8Array([255]).buffer);
    }

    wss.on('connection', (ws) => {
        sockets.add(ws);
        ws.on('close', () => {
            sockets.delete(ws);
            if (ws === bl_socket) bl_socket = undefined;
            if (ws === entity_reciever_socket) clear_target_server();
        });

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
                    if (!same_target_server) {
                        if (had_target_server) send_to_bl(new Uint8Array([255]).buffer);
                        send_to_bl(target_server_packet);
                    }
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
                    send_to_entity_receiver(packet);
                break;
                case 10:
                    if (ws === bl_socket) {
                        broadcast_to_clients(packet);
                    } else {
                        send_to_bl(packet);
                    }
                break;
                case 11:
                    if (ws === bl_socket) broadcast_to_clients(packet);
                break;
                }
            });
        });
})();
