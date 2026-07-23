const fs = require("fs");
const path = require("path");

const ROOT_DIR = __dirname;
const PRESET_DIR = path.join(ROOT_DIR, "presets");
const DEFAULT_GROWTH_ORDER = [2, 7, 1, 0, 8, 9];
const UPGRADE_FILES = {
    normal: path.join(ROOT_DIR, "normal_upgrades.txt"),
    ar: path.join(ROOT_DIR, "ar_upgrades.txt")
};

function normalizeName(name) {
    return String(name || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeMode(value) {
    let mode = String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
    if (!mode || mode === "normal") return "normal";
    if (mode === "ar" || mode === "armsrace") return "ar";
    return "normal";
}

function parsePath(value) {
    if (Array.isArray(value)) {
        return value.map(part => Number.parseInt(part, 10)).filter(Number.isFinite);
    }
    return String(value || "")
        .split(/[,\s]+/)
        .map(part => part.trim())
        .filter(part => /^\d+$/.test(part))
        .map(part => Number.parseInt(part, 10))
        .filter(Number.isFinite);
}

function pathKey(value) {
    return parsePath(value).join(",");
}

function quotePresetShorthandValues(text) {
    return String(text || "").replace(/(^|[,{]\s*)(mode|tank|stats)\s*:\s*([^,\n\r}]+)/g, (match, prefix, key, value) => {
        let trimmed = String(value || "").trim();
        if (!trimmed || /^["'`\[{]/.test(trimmed)) return match;
        return `${prefix}${key}: ${JSON.stringify(trimmed)}`;
    });
}

function parsePresetText(text, filename) {
    let source = String(text || "").trim();
    if (!source) return [];
    try {
        let parsed = JSON.parse(source);
        return Array.isArray(parsed) ? parsed : [parsed];
    } catch (_) {
        let shorthand = quotePresetShorthandValues(source);
        let expression = shorthand.startsWith("[") ? shorthand : `[${shorthand}]`;
        try {
            let parsed = Function(`"use strict"; return (${expression});`)();
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch (error) {
            throw new Error(`${filename}: ${error.message}`);
        }
    }
}

function loadUpgradeMap(file) {
    let byPath = new Map();
    let byName = new Map();
    if (!fs.existsSync(file)) return { byPath, byName };
    for (let line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
        line = line.trim();
        if (!line || line.startsWith("#")) continue;
        let match = line.match(/^([0-9,\s]+)\s+(.+)$/);
        if (!match) continue;
        let upgradePath = parsePath(match[1]);
        let name = match[2].trim();
        if (!upgradePath.length || !name) continue;
        let entry = { path: upgradePath, pathText: upgradePath.join(","), name };
        if (!byPath.has(entry.pathText)) byPath.set(entry.pathText, entry);
        let nameKey = normalizeName(name);
        if (nameKey && !byName.has(nameKey)) byName.set(nameKey, entry);
    }
    return { byPath, byName };
}

const upgradeMaps = {
    normal: loadUpgradeMap(UPGRADE_FILES.normal),
    ar: loadUpgradeMap(UPGRADE_FILES.ar)
};

function inferModeFromFilename(filename) {
    let base = path.basename(filename).toLowerCase();
    if (base === "ar" || base.startsWith("ar-") || base.startsWith("ar_") || base.includes("-ar-") || base.includes("_ar_")) {
        return "ar";
    }
    return "";
}

function resolvePathInMode(upgradePath, mode) {
    let key = pathKey(upgradePath);
    return upgradeMaps[mode]?.byPath.get(key) || null;
}

function resolveTankInMode(tank, mode) {
    return upgradeMaps[mode]?.byName.get(normalizeName(tank)) || null;
}

function chooseMode(entry, filename) {
    if (entry.mode != null) return normalizeMode(entry.mode);
    let fileMode = inferModeFromFilename(filename);
    let key = pathKey(entry.tanks);
    if (fileMode && key && resolvePathInMode(key, fileMode)) return fileMode;
    let normalMatch = key ? resolvePathInMode(key, "normal") : null;
    let arMatch = key ? resolvePathInMode(key, "ar") : null;
    if (normalMatch && !arMatch) return "normal";
    if (arMatch && !normalMatch) return "ar";
    return fileMode || "normal";
}

function statsToAmounts(value) {
    if (typeof value === "string") {
        return value.split("/").map(part => {
            let amount = Number.parseInt(part.trim(), 10);
            return Number.isFinite(amount) && amount > 0 ? amount : 0;
        });
    }
    if (!Array.isArray(value)) return [];
    if (value.every(item => !Array.isArray(item))) {
        return value.map(amount => {
            amount = Number.parseInt(amount, 10);
            return Number.isFinite(amount) && amount > 0 ? amount : 0;
        });
    }
    let maxStat = 7;
    for (let pair of value) {
        if (!Array.isArray(pair) || pair.length < 2) continue;
        let stat = Number.parseInt(pair[0], 10);
        if (Number.isFinite(stat)) maxStat = Math.max(maxStat, stat);
    }
    let amounts = Array(maxStat + 1).fill(0);
    for (let pair of value) {
        if (!Array.isArray(pair) || pair.length < 2) continue;
        let stat = Number.parseInt(pair[0], 10);
        let amount = Number.parseInt(pair[1], 10);
        if (Number.isFinite(stat) && stat >= 0 && Number.isFinite(amount) && amount > 0) {
            amounts[stat] = amount;
        }
    }
    return amounts;
}

function formatStats(value) {
    let amounts = statsToAmounts(value);
    while (amounts.length < 8) amounts.push(0);
    while (amounts.length > 8 && amounts[amounts.length - 1] === 0) amounts.pop();
    return amounts.join("/");
}

function formatArray(values) {
    return `[${values.map(value => Number.parseInt(value, 10)).filter(Number.isFinite).join(", ")}]`;
}

function formatScalar(value) {
    let number = Number(value);
    if (!Number.isFinite(number)) return "0";
    if (Math.abs(number - Math.PI) < 1e-12) return "Math.PI";
    if (Math.abs(number + Math.PI) < 1e-12) return "-Math.PI";
    return String(number);
}

function formatBareText(value) {
    let text = String(value || "").trim();
    if (!text) return "\"\"";
    if (/[,{}\n\r]/.test(text)) return JSON.stringify(text);
    return text;
}

function convertEntry(entry, filename) {
    entry = entry && typeof entry === "object" ? entry : {};
    let mode = chooseMode(entry, filename);
    let tanks = parsePath(entry.tanks);
    let tankName = String(entry.tank || "").trim();
    let resolved = tankName ? resolveTankInMode(tankName, mode) : null;
    if (resolved) {
        tankName = resolved.name;
        tanks = resolved.path;
    } else if (tanks.length) {
        resolved = resolvePathInMode(tanks, mode);
        if (resolved) tankName = resolved.name;
    }

    let growthOrder = Array.isArray(entry.growth_extended_upgrades_order_to_max)
        ? entry.growth_extended_upgrades_order_to_max
        : DEFAULT_GROWTH_ORDER;
    let lines = [
        "{",
        `    mode: ${mode},`
    ];
    if (tankName) {
        lines.push(`    tank: ${formatBareText(tankName)},`);
    } else {
        lines.push(`    tanks: ${formatArray(tanks)},`);
    }
    lines.push(
        `    stats: ${formatStats(entry.stats)},`,
        `    growth_extended_upgrades_order_to_max: ${formatArray(growthOrder)},`,
        `    autospin: ${entry.autospin === true},`,
        `    autofire: ${entry.autofire === true},`,
        `    pathfinding_facing_angle_offset: ${formatScalar(entry.pathfinding_facing_angle_offset)}`,
        "}"
    );
    return lines.join("\n");
}

function isPresetFile(file) {
    if (file.startsWith(".")) return false;
    if (/\.bak$/i.test(file)) return false;
    let fullPath = path.join(PRESET_DIR, file);
    if (!fs.statSync(fullPath).isFile()) return false;
    return /\.(txt|json|js)$/i.test(file) || !path.extname(file);
}

function convertFile(file, options) {
    let fullPath = path.join(PRESET_DIR, file);
    let original = fs.readFileSync(fullPath, "utf8");
    let entries = parsePresetText(original, file);
    if (!entries.length) return { file, changed: false, entries: 0 };
    let converted = entries.map(entry => convertEntry(entry, file)).join(",\n") + "\n";
    if (converted === original) return { file, changed: false, entries: entries.length };
    if (!options.dryRun) {
        let backupPath = `${fullPath}.bak`;
        if (!fs.existsSync(backupPath)) fs.writeFileSync(backupPath, original);
        fs.writeFileSync(fullPath, converted);
    }
    return { file, changed: true, entries: entries.length };
}

function main() {
    let options = {
        dryRun: process.argv.includes("--dry-run")
    };
    if (!fs.existsSync(PRESET_DIR)) {
        console.error(`Missing presets directory: ${PRESET_DIR}`);
        process.exitCode = 1;
        return;
    }
    let files = fs.readdirSync(PRESET_DIR).filter(isPresetFile).sort((a, b) => a.localeCompare(b));
    let changed = 0;
    for (let file of files) {
        try {
            let result = convertFile(file, options);
            if (result.changed) changed += 1;
            console.log(`${result.changed ? "converted" : "unchanged"} ${file} (${result.entries} entries)`);
        } catch (error) {
            console.error(`failed ${file}: ${error.message}`);
            process.exitCode = 1;
        }
    }
    console.log(`${options.dryRun ? "would convert" : "converted"} ${changed} file(s).`);
}

main();
