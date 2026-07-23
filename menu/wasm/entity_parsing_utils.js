(() => {
    function decode_entities(buffer, entities) {
        let view = buffer instanceof DataView ? buffer : new DataView(buffer instanceof ArrayBuffer ? buffer : buffer.buffer);
        let writer = view.getUint8(1);
        let offset = 2;
        if (offset + 8 <= view.byteLength) {
            let delete_count = Number(view.getBigUint64(offset, true));
            offset += 8;
            for (let i = 0; i < delete_count; i++) {
                let id = view.getBigUint64(offset, true).toString();
                if (entities.entities[id]?.writer == writer) delete entities.entities[id];
                offset += 8;
            }
        }
        while (offset + 44 <= view.byteLength) {
            let id = view.getBigUint64(offset, true).toString();
            offset += 8;
            let x = view.getFloat32(offset, true);
            let y = view.getFloat32(offset + 4, true);
            let angle = view.getFloat32(offset + 8, true);
            let size = view.getFloat32(offset + 12, true);
            let health = view.getFloat32(offset + 16, true);
            offset += 20;
            let color = view.getUint8(offset);
            offset += 1;
            let mockup_id = view.getUint16(offset, true);
            offset += 2;
            let opacity = view.getFloat32(offset, true);
            offset += 4;
            let score = view.getUint32(offset, true);
            offset += 4;
            let shield = view.getFloat32(offset, true);
            offset += 4;
            let bot_raw = view.getUint8(offset);
            let bot = bot_raw === 255 ? undefined : bot_raw;
            offset += 1;
            let name_length = view.getUint8(offset);
            offset += 1;
            let name = "";
            if (name_length > 0) {
                let bytes = new Uint8Array(view.buffer, view.byteOffset + offset, name_length);
                name = new TextDecoder().decode(bytes);
                offset += name_length;
            }
            let existing = entities.entities[id];
            let should_update = false;
            if (!existing) {
                should_update = true;
            } else {
                if (existing.bot !== undefined) {
                    if (existing.bot == writer) should_update = true;
                } 
                else if (existing.writer == writer) {
                    should_update = true;
                }
            }
            if (should_update) {
                entities.entities[id] = { x, y, angle, size, health, color, mockup_id, opacity, score, shield, bot, name, writer };
            }
        }
        return entities;
    }

    function encode_entities(entities, deleted_entities, static_mockups, writer) {
        let entity_ids = Object.keys(entities).filter(id => !static_mockups?.[entities[id].mockup_id]);
        let encoder = new TextEncoder();
        let entity_sizes = entity_ids.map(id => {
            let name_bytes = encoder.encode(entities[id].name ?? "");
            return 31 + 4 + 4 + 4 + 1 + 1 + name_bytes.length;
        });
        let len = 2 + 8 + (deleted_entities.length * 8) + entity_sizes.reduce((a, b) => a + b, 0);
        let buffer = new ArrayBuffer(len);
        let view = new DataView(buffer);
        view.setUint8(0, 4);
        view.setUint8(1, writer);
        view.setBigUint64(2, BigInt(deleted_entities.length), true);
        let offset = 10;
        for (let id of deleted_entities) {
            view.setBigUint64(offset, BigInt(id), true);
            offset += 8;
        }
        for (let id of entity_ids) {
            let entity = entities[id];
            let name_bytes = encoder.encode(entity.name ?? "");
            view.setBigUint64(offset, BigInt(id), true);
            offset += 8;
            view.setFloat32(offset, entity.x ?? 0, true);
            view.setFloat32(offset + 4, entity.y ?? 0, true);
            view.setFloat32(offset + 8, entity.angle ?? 0, true);
            view.setFloat32(offset + 12, entity.size ?? 24.125, true);
            view.setFloat32(offset + 16, entity.health ?? 1, true);
            offset += 20;
            view.setUint8(offset, entity.color ?? 0);
            offset += 1;
            view.setUint16(offset, entity.mockup_id ?? 0, true);
            offset += 2;
            view.setFloat32(offset, entity.opacity ?? 1, true);
            offset += 4;
            view.setUint32(offset, entity.score ?? 0, true);
            offset += 4;
            view.setFloat32(offset, entity.shield ?? 1, true);
            offset += 4;
            view.setUint8(offset, entity.bot ?? 255);
            offset += 1;
            view.setUint8(offset, name_bytes.length);
            offset += 1;
            new Uint8Array(buffer, offset, name_bytes.length).set(name_bytes);
            offset += name_bytes.length;
        }
        return buffer;
    }
    return [decode_entities, encode_entities];
})();