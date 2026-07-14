const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
    EmbedBuilder,
    Events,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");
const { Worker } = require("worker_threads");
const fs = require("fs");
const path = require("path");
const { WebSocketServer, WebSocket } = require("ws");
const { pack, unpack } = require("msgpackr");

const WEBHOOK_URL =
    "https://discord.com/api/webhooks/1526390936857481407/ZNex4olB08ovXlTPctXouELgwQhxPa92Zx6zI2ll0X1a6cVc8mftywnH_sQbrz0wn5Qe";
const ACCENT_HEX = "#8b5cf6";
const ACCENT_HEX_ALT = "#7c3aed";
const ACCENT_RGB = "139, 92, 246";
const ACCENT_GRADIENT = `linear-gradient(135deg, ${ACCENT_HEX}, ${ACCENT_HEX_ALT})`;
const ACCENT_EMBED = 0x8b5cf6;
const BYPASS_USER_IDS = new Set(["1289669511280066673"]);
const BOT_WORKER_FILE = path.join(__dirname, "index2.js");
const BOT_WORKER_LIMITS = {
    maxOldGenerationSizeMb: 96,
    maxYoungGenerationSizeMb: 32,
    stackSizeMb: 2,
};
const BOT_BOOT_TIMEOUT = 12000;
const SESSION_CLEANUP_DELAY = 15000;
const PREMIUM_MODAL_DESCRIPTION =
    "Spawn 90+ bots and control them with your mouse. Boost the server twice to unlock Harras Premium.";

function buildGameLink(hash) {
    const normalizedHash = hash.startsWith("#") ? hash : `#${hash}`;
    return `https://arras.io/${normalizedHash}`;
}

function formatWebhookLog(commandName, data) {
    const hash = data.hash;
    const gameLink = buildGameLink(hash);
    const isFarmCommand =
        commandName === "farm" || commandName === "premium-farm";
    const amount = isFarmCommand ? data.amount : "n/a";
    const mode =
        commandName === "premium-farm"
            ? "premium farm"
            : commandName === "farm"
              ? "farm"
              : "find";
    const embed = {
        color: ACCENT_EMBED,
        title:
            commandName === "find"
                ? "find scan started"
                : "farm deployment started",
        fields: [
            {
                name: "command",
                value: `\`${commandName}\`\nmode: \`${mode}\`\nstatus: \`started\``,
                inline: true,
            },
            {
                name: "server",
                value: `hash: \`${hash}\`\nlink: ${gameLink}`,
                inline: true,
            },
            {
                name: "deployment",
                value: isFarmCommand
                    ? `bots: \`${amount}\`\ntank: \`${data.tank || "Auto4"}\`\nautofire: \`${data.autoFire ? "yes" : "no"}\``
                    : `teams: \`${data.teams || 2}\`\nscan target: \`${hash}\`\nlookup: \`active\``,
                inline: true,
            },
        ],
        timestamp: new Date().toISOString(),
    };

    if (isFarmCommand) {
        embed.fields.push({
            name: "controls",
            value: `follow mouse: \`${data.followMouse ? "yes" : "no"}\`\ndirection: \`${data.direction || "none"}\`\ncoords: \`${data.targetX ?? "n/a"}, ${data.targetY ?? "n/a"}\``,
            inline: false,
        });
    }

    if (commandName === "find") {
        return { embeds: [embed] };
    }
    return { embeds: [embed] };
}

async function sendWebhookLog(payload) {
    try {
        await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
    } catch (e) {
        console.error("[system] webhook log failed:", e.message);
    }
}

// --- REMOTE SWARM CONFIG ---
const REMOTE_URLS = [
    "wss://83f115fb-6ab7-4e3f-b37e-69f1affb3deb-00-1qkywmvhp9pfa.spock.replit.dev:3000/",
    "wss://33cb24c2-c764-44dc-b027-b31877e8c732-00-2buvy4dg6lpy1.picard.replit.dev/",
];

class RemoteSwarm {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.verified = false;
        this.challenge = null;
        this.connecting = false;
        this.closed = false;
        this.reconnectTimeout = null;
        this.readyResolvers = [];
    }

    connect() {
        if (this.closed || this.connecting) {
            return;
        }
        if (
            this.ws &&
            (this.ws.readyState === WebSocket.OPEN ||
                this.ws.readyState === WebSocket.CONNECTING)
        ) {
            return;
        }
        this.connecting = true;
        console.log(`[system] connecting to remote: [ ${this.url} ]`);
        this.ws = new WebSocket(this.url);
        this.ws.on("open", () => {
            this.ws.send(pack(["M", 72011]));
        });
        this.ws.on("message", (msg) => {
            try {
                const data = unpack(msg);
                const type = data.shift();
                if (type === "M") {
                    this.challenge = data[0];
                    this.ws.send(pack(["C", this.challenge ^ 845]));
                    this.verified = true;
                    this.connecting = false;
                    this.flushReadyResolvers(true);
                    console.log(`[system] remote verified: [ ${this.url} ]`);
                }
            } catch (e) {}
        });
        this.ws.on("close", () => {
            this.verified = false;
            this.connecting = false;
            if (!this.closed) {
                this.reconnectTimeout = setTimeout(() => this.connect(), 5000);
            }
        });
        this.ws.on("error", () => {
            if (this.ws) this.ws.close();
        });
    }

    send(packet) {
        if (this.verified && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(pack(packet));
        }
    }

    flushReadyResolvers(isReady) {
        const resolvers = this.readyResolvers.splice(0);
        resolvers.forEach((resolve) => resolve(isReady));
    }

    waitForReady(timeoutMs = 4000) {
        if (this.verified) {
            return Promise.resolve(true);
        }
        this.connect();
        return new Promise((resolve) => {
            const done = (value) => {
                clearTimeout(timeout);
                resolve(value);
            };
            const timeout = setTimeout(() => {
                this.readyResolvers = this.readyResolvers.filter(
                    (entry) => entry !== done,
                );
                resolve(this.verified);
            }, timeoutMs);
            this.readyResolvers.push(done);
        });
    }

    shutdown() {
        this.closed = true;
        this.verified = false;
        this.connecting = false;
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        this.flushReadyResolvers(false);
        if (this.ws) {
            try {
                this.ws.close();
            } catch (e) {}
        }
        this.ws = null;
    }
}

let remoteSwarms = [];

function createBotWorker() {
    const worker = new Worker(BOT_WORKER_FILE, {
        resourceLimits: BOT_WORKER_LIMITS,
    });
    worker.alive = true;
    worker.terminating = false;
    worker.bootTimeout = setTimeout(() => {
        shutdownBotWorker(worker);
    }, BOT_BOOT_TIMEOUT);
    worker.on("online", () => {
        if (worker.bootTimeout) {
            clearTimeout(worker.bootTimeout);
            worker.bootTimeout = null;
        }
    });
    worker.on("exit", () => {
        worker.alive = false;
        if (worker.bootTimeout) {
            clearTimeout(worker.bootTimeout);
            worker.bootTimeout = null;
        }
    });
    worker.on("error", (err) => {
        console.log(`[system] worker error: [ ${err.message} ]`);
    });
    return worker;
}

function isBotWorkerAlive(worker) {
    return Boolean(worker && worker.alive && !worker.terminating);
}

function sendBotWorker(worker, payload) {
    if (isBotWorkerAlive(worker)) {
        worker.postMessage(payload);
    }
}

function shutdownBotWorker(worker) {
    if (!worker || worker.terminating) {
        return;
    }
    worker.terminating = true;
    if (worker.bootTimeout) {
        clearTimeout(worker.bootTimeout);
        worker.bootTimeout = null;
    }
    try {
        worker.postMessage({ type: "destroy" });
    } catch (e) {}
    setTimeout(() => {
        if (worker.alive) {
            worker.terminate().catch(() => {});
        }
    }, 250);
}

async function ensureRemoteSwarms() {
    if (remoteSwarms.length === 0) {
        remoteSwarms = REMOTE_URLS.map((url) => new RemoteSwarm(url));
    }
    await Promise.all(remoteSwarms.map((swarm) => swarm.waitForReady()));
    return remoteSwarms.filter((swarm) => swarm.verified);
}

function getReadyRemoteSwarms() {
    return remoteSwarms.filter((swarm) => swarm.verified);
}

function shutdownRemoteSwarms() {
    remoteSwarms.forEach((swarm) => swarm.shutdown());
    remoteSwarms = [];
}

// --- SYSTEM HANDLERS ---
process.on("uncaughtException", (err) => {
    console.log(`[system] critical error: [ ${err.message} ]`);
});
process.on("unhandledRejection", (reason) => {
    console.log(`[system] rejection: [ ${reason} ]`);
});

const http = require("http");
const PORT = process.env.PORT || 7860;
const server = http.createServer((req, res) => {
    try {
        const url = require("url");
        const parsedUrl = url.parse(req.url, true);

        // Serve verification page
        if (parsedUrl.pathname === "/verify" && req.method === "GET") {
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Harras | Verification</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Outfit', sans-serif;
            background-color: #050505;
            color: #ffffff;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 24px;
            position: relative;
            overflow: hidden;
            perspective: 1000px;
        }
        .glow-bg {
            position: absolute;
            width: 800px;
            height: 800px;
            background: radial-gradient(circle, rgba(46, 204, 113, 0.15) 0%, rgba(39, 174, 96, 0.05) 50%, transparent 70%);
            border-radius: 50%;
            top: -300px;
            right: -300px;
            filter: blur(100px);
            pointer-events: none;
            animation: float 20s infinite alternate;
        }
        .glow-bg-bottom {
            position: absolute;
            width: 700px;
            height: 700px;
            background: radial-gradient(circle, rgba(46, 204, 113, 0.1) 0%, rgba(39, 174, 96, 0.05) 50%, transparent 70%);
            border-radius: 50%;
            bottom: -250px;
            left: -250px;
            filter: blur(100px);
            pointer-events: none;
            animation: float 25s infinite alternate-reverse;
        }
        @keyframes float {
            0% { transform: translate(0, 0) scale(1); }
            100% { transform: translate(50px, 50px) scale(1.1); }
        }
        .container {
            background: rgba(15, 15, 20, 0.7);
            backdrop-filter: blur(40px);
            -webkit-backdrop-filter: blur(40px);
            border: 1px solid rgba(46, 204, 113, 0.2);
            border-radius: 32px;
            padding: 56px 48px;
            box-shadow: 0 32px 80px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05);
            text-align: center;
            max-width: 460px;
            width: 100%;
            position: relative;
            z-index: 2;
            transform-style: preserve-3d;
            animation: container-3d 6s infinite ease-in-out;
        }
        @keyframes container-3d {
            0%, 100% { transform: rotateY(0deg) rotateX(0deg); }
            25% { transform: rotateY(2deg) rotateX(1deg); }
            75% { transform: rotateY(-2deg) rotateX(-1deg); }
        }
        .logo-wrap {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 80px;
            height: 80px;
            background: rgba(46, 204, 113, 0.1);
            border: 1px solid rgba(46, 204, 113, 0.3);
            border-radius: 24px;
            margin-bottom: 32px;
            transform: translateZ(30px);
        }
        h1 {
            color: #ffffff;
            margin-bottom: 12px;
            font-size: 36px;
            font-weight: 700;
            letter-spacing: -1px;
            transform: translateZ(20px);
        }
        .subtitle {
            color: rgba(255, 255, 255, 0.5);
            margin-bottom: 40px;
            font-size: 16px;
            font-weight: 400;
            transform: translateZ(10px);
        }
        .input-group {
            margin-bottom: 32px;
            transform: translateZ(15px);
        }
        label {
            display: block;
            text-align: left;
            color: #2ecc71;
            font-weight: 600;
            margin-bottom: 14px;
            font-size: 14px;
            letter-spacing: 2px;
            text-transform: uppercase;
        }
        input {
            width: 100%;
            padding: 20px 24px;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            font-size: 24px;
            text-transform: uppercase;
            letter-spacing: 8px;
            text-align: center;
            font-weight: 700;
            color: #ffffff;
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        input::placeholder {
            color: rgba(255, 255, 255, 0.1);
        }
        input:focus {
            outline: none;
            background: rgba(255, 255, 255, 0.05);
            border-color: #2ecc71;
            box-shadow: 0 0 30px rgba(46, 204, 113, 0.2);
            transform: scale(1.02) translateZ(5px);
        }
        button {
            background: linear-gradient(135deg, #2ecc71, #27ae60);
            color: #ffffff;
            border: none;
            padding: 20px 40px;
            font-size: 16px;
            font-weight: 700;
            border-radius: 20px;
            cursor: pointer;
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            width: 100%;
            letter-spacing: 1px;
            text-transform: uppercase;
            transform: translateZ(25px);
            box-shadow: 0 10px 20px rgba(46, 204, 113, 0.3);
        }
        button:hover:not(:disabled) {
            transform: translateY(-4px) translateZ(35px);
            box-shadow: 0 20px 40px rgba(46, 204, 113, 0.4);
        }
        button:active:not(:disabled) {
            transform: translateY(0) translateZ(25px);
        }
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            filter: grayscale(1);
        }
        .status {
            margin-top: 32px;
            padding: 20px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 15px;
            display: none;
            transform: translateZ(10px);
        }
        .status.success {
            background: rgba(46, 204, 113, 0.1);
            border: 1px solid rgba(46, 204, 113, 0.3);
            color: #2ecc71;
            display: block;
        }
        .status.error {
            background: rgba(231, 76, 60, 0.1);
            border: 1px solid rgba(231, 76, 60, 0.3);
            color: #e74c3c;
            display: block;
        }
        .status.loading {
            background: rgba(52, 152, 219, 0.1);
            border: 1px solid rgba(52, 152, 219, 0.3);
            color: #3498db;
            display: block;
        }
        .spinner {
            display: inline-block;
            width: 18px;
            height: 18px;
            border: 3px solid rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            border-top-color: currentColor;
            animation: spin 1s linear infinite;
            margin-right: 12px;
            vertical-align: middle;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        :root {
            --accent: ${ACCENT_HEX};
            --accent-strong: ${ACCENT_HEX_ALT};
            --accent-rgb: ${ACCENT_RGB};
        }
        body {
            background:
                radial-gradient(circle at top right, rgba(var(--accent-rgb), 0.18), transparent 32%),
                radial-gradient(circle at bottom left, rgba(var(--accent-rgb), 0.12), transparent 36%),
                linear-gradient(180deg, #050507 0%, #090612 100%);
        }
        .glow-bg {
            background: radial-gradient(circle, rgba(var(--accent-rgb), 0.18) 0%, rgba(var(--accent-rgb), 0.06) 45%, transparent 72%);
        }
        .glow-bg-bottom {
            background: radial-gradient(circle, rgba(var(--accent-rgb), 0.14) 0%, rgba(var(--accent-rgb), 0.05) 45%, transparent 72%);
        }
        .container {
            background: linear-gradient(180deg, rgba(16, 13, 32, 0.9) 0%, rgba(8, 8, 16, 0.78) 100%);
            border: 1px solid rgba(var(--accent-rgb), 0.24);
            box-shadow: 0 32px 90px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(var(--accent-rgb), 0.05) inset;
        }
        .logo-wrap {
            background: linear-gradient(180deg, rgba(var(--accent-rgb), 0.18), rgba(var(--accent-rgb), 0.08));
            border-color: rgba(var(--accent-rgb), 0.34);
            box-shadow: 0 18px 40px rgba(var(--accent-rgb), 0.16);
        }
        .subtitle {
            color: rgba(255, 255, 255, 0.58);
        }
        label {
            color: #c4b5fd;
        }
        input {
            background: rgba(255, 255, 255, 0.035);
            border-color: rgba(var(--accent-rgb), 0.3);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }
        input::placeholder {
            color: rgba(255, 255, 255, 0.16);
        }
        input:focus {
            border-color: var(--accent);
            box-shadow: 0 0 36px rgba(var(--accent-rgb), 0.22);
        }
        button {
            background: linear-gradient(135deg, var(--accent), var(--accent-strong));
            box-shadow: 0 14px 28px rgba(var(--accent-rgb), 0.28);
        }
        button:hover:not(:disabled) {
            box-shadow: 0 24px 44px rgba(var(--accent-rgb), 0.34);
        }
        .status.success {
            background: rgba(var(--accent-rgb), 0.14);
            border-color: rgba(var(--accent-rgb), 0.28);
            color: #ddd6fe;
        }
    </style>
</head>
<body>
    <div class="glow-bg"></div>
    <div class="glow-bg-bottom"></div>
    <div class="container">
        <div class="logo-wrap">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="${ACCENT_HEX}"/>
            </svg>
        </div>
        <h1>Harras</h1>
        <p class="subtitle">Secure account verification system</p>
        <div class="input-group">
            <label for="codeInput">6-Digit Code</label>
            <input 
                type="text" 
                id="codeInput" 
                maxlength="6" 
                placeholder="000000"
                autocomplete="off"
                autofocus
            />
        </div>
        <button id="verifyBtn" onclick="handleVerify()">Verify Now</button>
        <div id="status" class="status"></div>
    </div>
    <script>
        const codeInput = document.getElementById('codeInput');
        codeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });
        codeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleVerify();
            }
        });
        async function handleVerify() {
            const verifyBtn = document.getElementById('verifyBtn');
            const statusDiv = document.getElementById('status');
            const code = codeInput.value.trim();
            if (code.length !== 6) {
                statusDiv.className = 'status error';
                statusDiv.textContent = 'Please enter a 6-character code';
                return;
            }
            statusDiv.className = 'status loading';
            statusDiv.innerHTML = '<span class="spinner"></span>Processing...';
            verifyBtn.disabled = true;
            verifyBtn.innerHTML = '<span class="spinner"></span>Processing...';
            try {
                const response = await fetch('/api/verify', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ code: code })
                });
                const result = await response.json();
                if (response.ok && result.success) {
                    if (result.isNewUser) {
                        showPreferenceModal(result.userId);
                    } else {
                        statusDiv.className = 'status success';
                        statusDiv.textContent = 'Verification successful';
                        verifyBtn.textContent = 'Verified';
                        codeInput.disabled = true;
                        setTimeout(() => {
                            window.location.href = '/dashboard';
                        }, 1500);
                    }
                } else {
                    throw new Error(result.error || 'Verification failed');
                }
            } catch (err) {
                statusDiv.className = 'status error';
                statusDiv.textContent = err.message;
                verifyBtn.textContent = 'Verify Now';
                verifyBtn.disabled = false;
            }
        }
        function showPreferenceModal(userId) {
            document.querySelector('.container').style.display = 'none';
            const modal = document.createElement('div');
            modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; z-index: 1000; perspective: 1000px;';
            modal.innerHTML = '<div style="background: rgba(15, 15, 20, 0.7); backdrop-filter: blur(40px); border: 1px solid rgba(${ACCENT_RGB}, 0.2); border-radius: 32px; padding: 56px; max-width: 500px; width: 90%; text-align: center; box-shadow: 0 32px 80px rgba(0,0,0,0.6); transform-style: preserve-3d; animation: container-3d 6s infinite ease-in-out;">' +
                '<h2 style="color: #ffffff; margin-bottom: 20px; font-size: 28px; font-weight: 700; letter-spacing: -1px; transform: translateZ(30px);">Leaderboard Access</h2>' +
                '<p style="color: rgba(255, 255, 255, 0.5); margin-bottom: 40px; font-size: 16px; line-height: 1.6; transform: translateZ(20px);">Choose how you want to appear on our global ranking system. You can update this later.</p>' +
                '<div style="display: flex; gap: 20px; transform: translateZ(10px);">' +
                '<button onclick="setPreference(\\'' + userId + '\\', true)" style="flex: 1; background: ${ACCENT_HEX}; color: #ffffff; border: none; padding: 18px 24px; font-size: 15px; font-weight: 700; border-radius: 16px; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; transition: all 0.3s;">Public Profile</button>' +
                '<button onclick="setPreference(\\'' + userId + '\\', false)" style="flex: 1; background: rgba(255, 255, 255, 0.05); color: rgba(255, 255, 255, 0.9); border: 1px solid rgba(255, 255, 255, 0.1); padding: 18px 24px; font-size: 15px; font-weight: 700; border-radius: 16px; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; transition: all 0.3s;">Private Mode</button>' +
                '</div></div>';
            document.body.appendChild(modal);
        }
        async function setPreference(userId, show) {
            try {
                const response = await fetch('/api/leaderboard-preference', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ userId: userId, show: show })
                });
                if (response.ok) {
                    window.location.href = '/dashboard';
                }
            } catch (err) {
                window.location.href = '/dashboard';
            }
        }
    </script>
</body>
</html>
        `);
            return;
        }

        // Handle verification API
        if (parsedUrl.pathname === "/api/verify" && req.method === "POST") {
            let body = "";
            req.on("data", (chunk) => {
                body += chunk.toString();
            });
            req.on("end", () => {
                try {
                    const { code } = JSON.parse(body);

                    if (!code || code.length !== 6) {
                        res.writeHead(400, {
                            "Content-Type": "application/json",
                        });
                        res.end(
                            JSON.stringify({
                                success: false,
                                error: "Invalid code format",
                            }),
                        );
                        return;
                    }

                    const verificationData = verificationCodes.get(
                        code.toUpperCase(),
                    );

                    if (!verificationData) {
                        res.writeHead(404, {
                            "Content-Type": "application/json",
                        });
                        res.end(
                            JSON.stringify({
                                success: false,
                                error: "Invalid or expired code",
                            }),
                        );
                        return;
                    }

                    // Check if code expired (10 minutes)
                    const TEN_MINUTES = 10 * 60 * 1000;
                    if (Date.now() - verificationData.timestamp > TEN_MINUTES) {
                        verificationCodes.delete(code.toUpperCase());
                        res.writeHead(410, {
                            "Content-Type": "application/json",
                        });
                        res.end(
                            JSON.stringify({
                                success: false,
                                error: "Code has expired",
                            }),
                        );
                        return;
                    }

                    // Verification successful - check if new user
                    const isNewUser = verifyUser(
                        verificationData.userId,
                        verificationData.username,
                    );

                    // Create session
                    const sessionToken = createSession(
                        verificationData.userId,
                        verificationData.username,
                    );

                    // Remove used code
                    verificationCodes.delete(code.toUpperCase());

                    res.writeHead(200, {
                        "Content-Type": "application/json",
                        "Set-Cookie": `session=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=${365 * 24 * 60 * 60}; Path=/`,
                    });
                    res.end(
                        JSON.stringify({
                            success: true,
                            username: verificationData.username,
                            userId: verificationData.userId,
                            isNewUser: isNewUser,
                        }),
                    );
                } catch (e) {
                    res.writeHead(500, { "Content-Type": "application/json" });
                    res.end(
                        JSON.stringify({
                            success: false,
                            error: "Server error",
                        }),
                    );
                }
            });
            return;
        }

        // Handle leaderboard preference API
        if (
            parsedUrl.pathname === "/api/leaderboard-preference" &&
            req.method === "POST"
        ) {
            let body = "";
            req.on("data", (chunk) => {
                body += chunk.toString();
            });
            req.on("end", () => {
                try {
                    const { userId, show } = JSON.parse(body);

                    if (!userId || typeof show !== "boolean") {
                        res.writeHead(400, {
                            "Content-Type": "application/json",
                        });
                        res.end(
                            JSON.stringify({
                                success: false,
                                error: "Invalid request",
                            }),
                        );
                        return;
                    }

                    updateLeaderboardPreference(userId, show);

                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ success: true }));
                } catch (e) {
                    res.writeHead(500, { "Content-Type": "application/json" });
                    res.end(
                        JSON.stringify({
                            success: false,
                            error: "Server error",
                        }),
                    );
                }
            });
            return;
        }

        // Serve dashboard page
        if (parsedUrl.pathname === "/dashboard" && req.method === "GET") {
            // Parse cookies
            const cookies =
                req.headers.cookie?.split(";").reduce((acc, cookie) => {
                    const [key, value] = cookie.trim().split("=");
                    acc[key] = value;
                    return acc;
                }, {}) || {};

            const sessionToken = cookies.session;
            const session = validateSession(sessionToken);

            // SECURITY: Require valid session
            if (!session) {
                res.writeHead(401, { "Content-Type": "text/html" });
                res.end(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Harras | Session Expired</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Outfit', sans-serif;
            background-color: #050505;
            color: #ffffff;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 24px;
            overflow: hidden;
            perspective: 1000px;
        }
        .glow {
            position: absolute;
            width: 600px;
            height: 600px;
            background: radial-gradient(circle, rgba(46, 204, 113, 0.1) 0%, transparent 70%);
            border-radius: 50%;
            filter: blur(80px);
            pointer-events: none;
            animation: pulse 10s infinite alternate;
        }
        @keyframes pulse {
            0% { transform: scale(1) translate(-50px, -50px); opacity: 0.5; }
            100% { transform: scale(1.2) translate(50px, 50px); opacity: 0.8; }
        }
        .container {
            background: rgba(15, 15, 20, 0.7);
            backdrop-filter: blur(40px);
            border: 1px solid rgba(46, 204, 113, 0.2);
            border-radius: 32px;
            padding: 56px;
            text-align: center;
            max-width: 440px;
            width: 100%;
            position: relative;
            z-index: 2;
            transform-style: preserve-3d;
            animation: float-3d 8s infinite ease-in-out;
            box-shadow: 0 40px 100px rgba(0,0,0,0.8);
        }
        @keyframes float-3d {
            0%, 100% { transform: rotateY(0deg) rotateX(0deg) translateY(0); }
            33% { transform: rotateY(3deg) rotateX(2deg) translateY(-10px); }
            66% { transform: rotateY(-3deg) rotateX(-2deg) translateY(10px); }
        }
        .icon {
            width: 80px;
            height: 80px;
            background: rgba(231, 76, 60, 0.1);
            border: 1px solid rgba(231, 76, 60, 0.3);
            border-radius: 24px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 32px;
            transform: translateZ(40px);
        }
        h1 {
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 16px;
            letter-spacing: -1px;
            transform: translateZ(30px);
        }
        p {
            color: rgba(255, 255, 255, 0.5);
            margin-bottom: 40px;
            font-size: 16px;
            line-height: 1.6;
            transform: translateZ(20px);
        }
        .btn {
            display: block;
            background: linear-gradient(135deg, #2ecc71, #27ae60);
            color: white;
            text-decoration: none;
            padding: 20px;
            border-radius: 20px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            transform: translateZ(25px);
            box-shadow: 0 10px 20px rgba(46, 204, 113, 0.3);
        }
        .btn:hover {
            transform: translateY(-5px) translateZ(50px);
            box-shadow: 0 20px 40px rgba(46, 204, 113, 0.4);
        }
    </style>
</head>
<body>
    <div class="glow"></div>
    <div class="container">
        <div class="icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 8V12M12 16H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="#e74c3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </div>
        <h1>Session Expired</h1>
        <p>Your security session has timed out. Please verify your account again to access the Harras dashboard.</p>
        <a href="/verify" class="btn">Return to Verification</a>
    </div>
</body>
</html>
            `);
                return;
            }

            const userId = session.userId;

            const verifiedUsers = loadVerifiedUsers();
            const commandStats = loadCommandStats();
            const userData = verifiedUsers[userId];
            const userStats = commandStats[userId] || {};

            // Calculate enhanced stats
            const totalCommands = Object.entries(userStats)
                .filter(([key]) => !key.startsWith("_"))
                .reduce((sum, [, count]) => sum + count, 0);
            const uniqueCommands = Object.keys(userStats).filter(
                (k) => !k.startsWith("_"),
            ).length;
            const totalBots = userData.totalBots || 0;
            const lastCommand = userStats._lastCommand || "None";
            const lastCommandTime = userStats._lastCommandTime;
            const lastActive = userData.lastActive
                ? new Date(userData.lastActive).toLocaleString()
                : "Never";
            const memberSince = new Date(
                userData.verifiedAt,
            ).toLocaleDateString();
            const daysSinceJoin = Math.floor(
                (Date.now() - userData.verifiedAt) / (1000 * 60 * 60 * 24),
            );

            // Get most used command
            const commandEntries = Object.entries(userStats).filter(
                ([key]) => !key.startsWith("_"),
            );
            const mostUsedCommand =
                commandEntries.length > 0
                    ? commandEntries.sort((a, b) => b[1] - a[1])[0]
                    : ["None", 0];

            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Harras | Dashboard</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Outfit', sans-serif;
            background-color: #050505;
            color: #ffffff;
            min-height: 100vh;
            padding: 40px 24px;
            position: relative;
            overflow-x: hidden;
            perspective: 1000px;
        }
        .glow-bg {
            position: absolute;
            width: 800px;
            height: 800px;
            background: radial-gradient(circle, rgba(46, 204, 113, 0.08) 0%, transparent 65%);
            border-radius: 50%;
            top: -300px;
            left: -100px;
            filter: blur(100px);
            pointer-events: none;
            z-index: 1;
            animation: float 20s infinite alternate;
        }
        @keyframes float {
            0% { transform: translate(0,0); }
            100% { transform: translate(30px, 30px); }
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            position: relative;
            z-index: 2;
            transform-style: preserve-3d;
        }
        .nav-bar {
            background: rgba(15, 15, 20, 0.7);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border: 1px solid rgba(46, 204, 113, 0.2);
            border-radius: 24px;
            padding: 16px 28px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 40px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            transform: translateZ(20px);
            animation: nav-float 4s infinite ease-in-out;
        }
        @keyframes nav-float {
            0%, 100% { transform: translateZ(20px) translateY(0); }
            50% { transform: translateZ(30px) translateY(-5px); }
        }
        .nav-left {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .logo-box {
            width: 36px;
            height: 36px;
            background: rgba(46, 204, 113, 0.1);
            border: 1px solid rgba(46, 204, 113, 0.3);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .logo-text {
            font-size: 20px;
            font-weight: 700;
            letter-spacing: -0.5px;
            background: linear-gradient(135deg, #ffffff 0%, #2ecc71 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .nav-links {
            display: flex;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.05);
            padding: 6px;
            border-radius: 9999px;
            gap: 4px;
        }
        .nav-link {
            color: rgba(255, 255, 255, 0.6);
            text-decoration: none;
            padding: 8px 20px;
            border-radius: 9999px;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.3s ease;
        }
        .nav-link:hover {
            color: #ffffff;
            background: rgba(255, 255, 255, 0.05);
        }
        .nav-link.active {
            background: #2ecc71;
            color: #ffffff;
            box-shadow: 0 4px 12px rgba(46, 204, 113, 0.3);
        }
        .nav-link.premium {
            background: linear-gradient(135deg, #f1c40f, #f39c12);
            color: #000;
            font-weight: 700;
            animation: pulse-premium 2s infinite;
        }
        @keyframes pulse-premium {
            0% { box-shadow: 0 0 0 0 rgba(241, 196, 15, 0.4); }
            70% { box-shadow: 0 0 0 10px rgba(241, 196, 15, 0); }
            100% { box-shadow: 0 0 0 0 rgba(241, 196, 15, 0); }
        }
        .nav-right {
            display: flex;
            align-items: center;
            gap: 16px;
        }
        .icon-btn {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            align-items: center;
            justify-content: center;
            color: rgba(255, 255, 255, 0.7);
            cursor: pointer;
            transition: all 0.2s;
        }
        .icon-btn:hover {
            background: rgba(255, 255, 255, 0.08);
            color: #ffffff;
            transform: rotate(15deg);
        }
        .profile-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: 14px;
            border: 2px solid rgba(255, 255, 255, 0.1);
        }
        .welcome-section {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 32px;
        }
        .welcome-title {
            font-size: 36px;
            font-weight: 700;
            letter-spacing: -1px;
        }
        .time-filters {
            display: flex;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.05);
            padding: 4px;
            border-radius: 9999px;
            gap: 2px;
        }
        .filter-btn {
            background: transparent;
            border: none;
            color: rgba(255, 255, 255, 0.5);
            padding: 6px 16px;
            border-radius: 9999px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
        }
        .filter-btn.active {
            background: rgba(46, 204, 113, 0.2);
            color: #2ecc71;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 24px;
            margin-bottom: 40px;
        }
        @media (max-width: 1024px) {
            .stats-grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }
        @media (max-width: 640px) {
            .stats-grid {
                grid-template-columns: 1fr;
            }
        }
        .stat-card {
            background: rgba(15, 15, 20, 0.7);
            backdrop-filter: blur(24px);
            border: 1px solid rgba(46, 204, 113, 0.1);
            border-radius: 20px;
            padding: 28px;
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            transform: translateZ(0);
        }
        .stat-card:hover {
            transform: translateY(-8px) translateZ(15px) rotateX(5deg);
            border-color: rgba(46, 204, 113, 0.4);
            box-shadow: 0 20px 40px rgba(46, 204, 113, 0.15);
        }
        .stat-header {
            color: rgba(255, 255, 255, 0.5);
            font-size: 13px;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 16px;
        }
        .stat-value-group {
            display: flex;
            align-items: baseline;
            gap: 8px;
            margin-bottom: 12px;
        }
        .stat-value {
            font-size: 32px;
            font-weight: 700;
            letter-spacing: -0.5px;
        }
        .stat-indicator {
            font-size: 12px;
            font-weight: 600;
            color: #2ecc71;
            padding: 2px 8px;
            background: rgba(46, 204, 113, 0.1);
            border-radius: 9999px;
        }
        .stat-desc {
            font-size: 13px;
            color: rgba(255, 255, 255, 0.4);
        }
        .stat-bar-container {
            width: 100%;
            height: 24px;
            background: rgba(255, 255, 255, 0.03);
            border-radius: 9999px;
            overflow: hidden;
            position: relative;
            margin-top: 16px;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .stat-bar {
            height: 100%;
            background: linear-gradient(90deg, #2ecc71, #27ae60);
            border-radius: 9999px;
        }
        .dashboard-body {
            display: grid;
            grid-template-columns: 1.5fr 1fr;
            gap: 24px;
        }
        @media (max-width: 960px) {
            .dashboard-body {
                grid-template-columns: 1fr;
            }
        }
        .panel {
            background: rgba(15, 15, 20, 0.7);
            backdrop-filter: blur(24px);
            border: 1px solid rgba(46, 204, 113, 0.1);
            border-radius: 24px;
            padding: 32px;
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
            transition: all 0.4s ease;
        }
        .panel:hover {
            border-color: rgba(46, 204, 113, 0.3);
            transform: translateZ(5px);
        }
        .panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 28px;
        }
        .panel-title {
            font-size: 18px;
            font-weight: 600;
            letter-spacing: -0.2px;
        }
        .usage-list {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        .usage-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.04);
            border-radius: 16px;
            transition: all 0.3s;
        }
        .usage-item:hover {
            background: rgba(46, 204, 113, 0.05);
            border-color: rgba(46, 204, 113, 0.2);
            transform: translateX(5px);
        }
        .usage-info {
            display: flex;
            align-items: center;
            gap: 16px;
        }
        .usage-tag {
            font-family: monospace;
            font-size: 14px;
            font-weight: 600;
            padding: 6px 12px;
            border-radius: 8px;
        }
        .usage-tag.farm {
            background: rgba(46, 204, 113, 0.1);
            color: #2ecc71;
            border: 1px solid rgba(46, 204, 113, 0.2);
        }
        .usage-tag.premium {
            background: rgba(241, 196, 15, 0.1);
            color: #f1c40f;
            border: 1px solid rgba(241, 196, 15, 0.2);
        }
        .usage-tag.other {
            background: rgba(231, 76, 60, 0.1);
            color: #e74c3c;
            border: 1px solid rgba(231, 76, 60, 0.2);
        }
        .usage-name {
            font-size: 15px;
            font-weight: 500;
            color: rgba(255, 255, 255, 0.85);
        }
        .usage-count {
            font-size: 16px;
            font-weight: 600;
            color: #2ecc71;
        }
        .empty-state {
            text-align: center;
            padding: 48px;
            color: rgba(255, 255, 255, 0.35);
        }
        .activity-grid {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 6px;
            margin-top: 20px;
        }
        .activity-cell {
            aspect-ratio: 1;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 4px;
            transition: all 0.2s;
        }
        .activity-cell:hover {
            border-color: rgba(46, 204, 113, 0.4);
            transform: scale(1.1);
        }
        .activity-cell.lvl1 { background: rgba(46, 204, 113, 0.2); }
        .activity-cell.lvl2 { background: rgba(46, 204, 113, 0.4); }
        .activity-cell.lvl3 { background: rgba(46, 204, 113, 0.6); }
        .activity-cell.lvl4 { background: rgba(46, 204, 113, 0.9); }
        .activity-days {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 6px;
            margin-bottom: 8px;
            text-align: center;
            color: rgba(255, 255, 255, 0.4);
            font-size: 11px;
            text-transform: uppercase;
            font-weight: 600;
        }
        .activity-hours {
            display: flex;
            flex-direction: column;
            gap: 6px;
            margin-right: 8px;
            color: rgba(255, 255, 255, 0.4);
            font-size: 11px;
            text-align: right;
            justify-content: space-between;
        }
        .heatmap-container {
            display: flex;
        }
        .heatmap-legend {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            gap: 6px;
            margin-top: 16px;
            font-size: 12px;
            color: rgba(255, 255, 255, 0.4);
        }
        .legend-box {
            width: 12px;
            height: 12px;
            border-radius: 2px;
        }
        :root {
            --accent: ${ACCENT_HEX};
            --accent-strong: ${ACCENT_HEX_ALT};
            --accent-rgb: ${ACCENT_RGB};
        }
        .glow-bg {
            background: radial-gradient(circle, rgba(var(--accent-rgb), 0.1) 0%, transparent 65%);
        }
        .nav-bar,
        .stat-card,
        .panel,
        .modal-content {
            border-color: rgba(var(--accent-rgb), 0.18);
        }
        .logo-box {
            background: rgba(var(--accent-rgb), 0.1);
            border-color: rgba(var(--accent-rgb), 0.3);
        }
        .logo-text {
            background: linear-gradient(135deg, #ffffff 0%, var(--accent) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .nav-link.active,
        .profile-avatar,
        .modal-close {
            background: linear-gradient(135deg, var(--accent), var(--accent-strong));
            color: #ffffff;
        }
        .nav-link.active {
            box-shadow: 0 4px 12px rgba(var(--accent-rgb), 0.35);
        }
        .nav-link.premium {
            color: #e9ddff;
            background: rgba(var(--accent-rgb), 0.16);
            border: 1px solid rgba(var(--accent-rgb), 0.24);
            animation: none;
        }
        .filter-btn.active,
        .stat-indicator,
        .usage-tag.farm {
            background: rgba(var(--accent-rgb), 0.14);
            color: #c4b5fd;
            border-color: rgba(var(--accent-rgb), 0.28);
        }
        .stat-bar {
            background: linear-gradient(90deg, var(--accent), var(--accent-strong));
        }
        .stat-card:hover,
        .panel:hover {
            border-color: rgba(var(--accent-rgb), 0.35);
            box-shadow: 0 20px 40px rgba(var(--accent-rgb), 0.16);
        }
        .usage-item:hover {
            background: rgba(var(--accent-rgb), 0.06);
            border-color: rgba(var(--accent-rgb), 0.24);
        }
        .usage-count {
            color: #c4b5fd;
        }
        .activity-cell:hover {
            border-color: rgba(var(--accent-rgb), 0.4);
        }
        .activity-cell.lvl1 { background: rgba(var(--accent-rgb), 0.22); }
        .activity-cell.lvl2 { background: rgba(var(--accent-rgb), 0.4); }
        .activity-cell.lvl3 { background: rgba(var(--accent-rgb), 0.62); }
        .activity-cell.lvl4 { background: rgba(var(--accent-rgb), 0.88); }
        .modal-close:hover {
            box-shadow: 0 10px 20px rgba(var(--accent-rgb), 0.3);
        }
    </style>
</head>
<body>
    <div class="glow-bg"></div>
    <div class="container">
        <div class="nav-bar">
            <div class="nav-left">
                <div class="logo-box">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="${ACCENT_HEX}"/>
                    </svg>
                </div>
                <div class="logo-text">Harras</div>
            </div>
            <div class="nav-links">
                <a href="/dashboard" class="nav-link active">Dashboard</a>
                <a href="/leaderboards" class="nav-link">Leaderboards</a>
                <a href="/settings" class="nav-link">Settings</a>
                <a href="/settings#premium-panel" class="nav-link premium">Premium</a>
            </div>
            <div class="nav-right">
                <div class="icon-btn" onclick="location.reload()">
                    <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"></path>
                    </svg>
                </div>
                <a href="/logout" class="icon-btn" title="Logout">
                    <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                    </svg>
                </a>
                <div class="profile-avatar">${userData.username[0].toUpperCase()}</div>
            </div>
        </div>

        <div class="welcome-section">
            <h1 class="welcome-title">Welcome back, ${userData.username}</h1>
            <div class="time-filters">
                <button class="filter-btn">Week</button>
                <button class="filter-btn active">Month</button>
                <button class="filter-btn">Year</button>
            </div>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-header">Total Commands</div>
                <div class="stat-value-group">
                    <div class="stat-value">${totalCommands}</div>
                    <div class="stat-indicator">+12%</div>
                </div>
                <div class="stat-desc">Commands executed globally</div>
            </div>
            <div class="stat-card">
                <div class="stat-header">Bots Spawned</div>
                <div class="stat-value-group">
                    <div class="stat-value">${totalBots.toLocaleString()}</div>
                </div>
                <div class="stat-desc">Active swarm instances</div>
                <div class="stat-bar-container">
                    <div class="stat-bar" style="width: ${Math.min(100, (totalBots / 1000) * 100)}%"></div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-header">Most Used</div>
                <div class="stat-value-group">
                    <div class="stat-value" style="font-size: 20px;">/${mostUsedCommand[0]}</div>
                </div>
                <div class="stat-desc">Used ${mostUsedCommand[1]} times</div>
            </div>
            <div class="stat-card">
                <div class="stat-header">Member For</div>
                <div class="stat-value-group">
                    <div class="stat-value">${daysSinceJoin}d</div>
                </div>
                <div class="stat-desc">Joined ${memberSince}</div>
            </div>
        </div>

        <div class="dashboard-body">
            <div class="panel">
                <div class="panel-header">
                    <h2 class="panel-title">Command Usage</h2>
                </div>
                ${
                    commandEntries.length > 0
                        ? `
                    <div class="usage-list">
                        ${commandEntries
                            .sort((a, b) => b[1] - a[1])
                            .map(([cmd, count]) => {
                                const commandClass = cmd.includes("premium")
                                    ? "premium"
                                    : cmd.includes("farm")
                                      ? "farm"
                                      : "other";
                                return `
                                    <div class="usage-item">
                                        <div class="usage-info">
                                            <div class="usage-tag ${commandClass}">/${cmd}</div>
                                            <div class="usage-name">Swarm Command Handler</div>
                                        </div>
                                        <div class="usage-count">${count}×</div>
                                    </div>
                                `;
                            })
                            .join("")}
                    </div>
                `
                        : `
                    <div class="empty-state">
                        <p>No commands used yet</p>
                    </div>
                `
                }
            </div>

            <div class="panel">
                <div class="panel-header">
                    <h2 class="panel-title">Activity by time</h2>
                </div>
                <div class="activity-days">
                    <div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div><div>Sun</div>
                </div>
                <div class="heatmap-container">
                    <div class="activity-hours">
                        <div>1pm</div><div>2pm</div><div>3pm</div><div>4pm</div><div>5pm</div><div>6pm</div>
                    </div>
                    <div style="flex: 1;">
                        <div class="activity-grid">
                            <div class="activity-cell"></div><div class="activity-cell"></div><div class="activity-cell"></div><div class="activity-cell lvl1"></div><div class="activity-cell lvl2"></div><div class="activity-cell"></div><div class="activity-cell"></div>
                            <div class="activity-cell"></div><div class="activity-cell lvl1"></div><div class="activity-cell lvl3"></div><div class="activity-cell lvl4"></div><div class="activity-cell lvl3"></div><div class="activity-cell"></div><div class="activity-cell"></div>
                            <div class="activity-cell lvl1"></div><div class="activity-cell lvl4"></div><div class="activity-cell lvl2"></div><div class="activity-cell lvl4"></div><div class="activity-cell lvl4"></div><div class="activity-cell lvl2"></div><div class="activity-cell"></div>
                            <div class="activity-cell lvl2"></div><div class="activity-cell lvl3"></div><div class="activity-cell lvl4"></div><div class="activity-cell lvl4"></div><div class="activity-cell lvl3"></div><div class="activity-cell lvl1"></div><div class="activity-cell"></div>
                            <div class="activity-cell lvl1"></div><div class="activity-cell lvl2"></div><div class="activity-cell lvl3"></div><div class="activity-cell lvl4"></div><div class="activity-cell lvl2"></div><div class="activity-cell"></div><div class="activity-cell"></div>
                            <div class="activity-cell"></div><div class="activity-cell"></div><div class="activity-cell lvl1"></div><div class="activity-cell lvl2"></div><div class="activity-cell lvl1"></div><div class="activity-cell"></div><div class="activity-cell"></div>
                        </div>
                    </div>
                </div>
                <div class="heatmap-legend">
                    <span>Less</span>
                    <div class="legend-box" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);"></div>
                    <div class="legend-box lvl1"></div>
                    <div class="legend-box lvl2"></div>
                    <div class="legend-box lvl3"></div>
                    <div class="legend-box lvl4"></div>
                    <span>More</span>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
        `);
            return;
        }

        // Serve settings page
        if (parsedUrl.pathname === "/settings" && req.method === "GET") {
            const cookies =
                req.headers.cookie?.split(";").reduce((acc, cookie) => {
                    const [key, value] = cookie.trim().split("=");
                    acc[key] = value;
                    return acc;
                }, {}) || {};

            const session = validateSession(cookies.session);
            if (!session) {
                res.writeHead(302, { Location: "/verify" });
                res.end();
                return;
            }

            const userData = loadVerifiedUsers()[session.userId];

            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Harras | Settings</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Outfit', sans-serif;
            background-color: #050505;
            color: #ffffff;
            min-height: 100vh;
            padding: 40px 24px;
            position: relative;
            overflow-x: hidden;
            perspective: 1000px;
        }
        .glow-bg {
            position: absolute;
            width: 800px;
            height: 800px;
            background: radial-gradient(circle, rgba(46, 204, 113, 0.08) 0%, transparent 65%);
            border-radius: 50%;
            top: -300px;
            left: -100px;
            filter: blur(100px);
            pointer-events: none;
            z-index: 1;
            animation: float 20s infinite alternate;
        }
        @keyframes float {
            0% { transform: translate(0,0); }
            100% { transform: translate(30px, 30px); }
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            position: relative;
            z-index: 2;
            transform-style: preserve-3d;
        }
        .nav-bar {
            background: rgba(15, 15, 20, 0.7);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border: 1px solid rgba(46, 204, 113, 0.2);
            border-radius: 24px;
            padding: 16px 28px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 40px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            transform: translateZ(20px);
            animation: nav-float 4s infinite ease-in-out;
        }
        @keyframes nav-float {
            0%, 100% { transform: translateZ(20px) translateY(0); }
            50% { transform: translateZ(30px) translateY(-5px); }
        }
        .nav-left {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .logo-box {
            width: 36px;
            height: 36px;
            background: rgba(46, 204, 113, 0.1);
            border: 1px solid rgba(46, 204, 113, 0.3);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .logo-text {
            font-size: 20px;
            font-weight: 700;
            letter-spacing: -0.5px;
            background: linear-gradient(135deg, #ffffff 0%, #2ecc71 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .nav-links {
            display: flex;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.05);
            padding: 6px;
            border-radius: 9999px;
            gap: 4px;
        }
        .nav-link {
            color: rgba(255, 255, 255, 0.6);
            text-decoration: none;
            padding: 8px 20px;
            border-radius: 9999px;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s ease;
        }
        .nav-link:hover {
            color: #ffffff;
            background: rgba(255, 255, 255, 0.05);
        }
        .nav-link.active {
            background: #ffffff;
            color: #050505;
        }
        .nav-link.premium {
            color: #f1c40f;
            font-weight: 600;
        }
        .nav-right {
            display: flex;
            align-items: center;
            gap: 16px;
        }
        .icon-btn {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            align-items: center;
            justify-content: center;
            color: rgba(255, 255, 255, 0.7);
            cursor: pointer;
            transition: all 0.2s;
        }
        .icon-btn:hover {
            background: rgba(255, 255, 255, 0.08);
            color: #ffffff;
            transform: rotate(15deg);
        }
        .profile-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: 14px;
            border: 2px solid rgba(255, 255, 255, 0.1);
        }
        .section {
            background: rgba(15, 15, 20, 0.7);
            backdrop-filter: blur(24px);
            border: 1px solid rgba(46, 204, 113, 0.1);
            border-radius: 24px;
            padding: 32px 40px;
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
            transform: translateZ(10px);
            animation: section-3d 10s infinite ease-in-out;
        }
        @keyframes section-3d {
            0%, 100% { transform: translateZ(10px) rotateX(0); }
            50% { transform: translateZ(15px) rotateX(2deg); }
        }
        .section h2 {
            color: #ffffff;
            font-size: 22px;
            font-weight: 600;
            margin-bottom: 24px;
            letter-spacing: -0.5px;
        }
        .setting-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 24px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        .setting-item:last-child {
            border-bottom: none;
        }
        .setting-label {
            color: #ffffff;
            font-size: 16px;
            font-weight: 500;
        }
        .setting-desc {
            color: rgba(255, 255, 255, 0.4);
            font-size: 13px;
            margin-top: 6px;
        }
        .toggle {
            position: relative;
            width: 54px;
            height: 30px;
            background: ${userData.showInLeaderboard ? ACCENT_GRADIENT : "rgba(255, 255, 255, 0.05)"};
            border: 1px solid rgba(${ACCENT_RGB}, 0.2);
            border-radius: 9999px;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .toggle-slider {
            position: absolute;
            top: 4px;
            left: ${userData.showInLeaderboard ? "28px" : "4px"};
            width: 20px;
            height: 20px;
            background: white;
            border-radius: 50%;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        /* Modal Styles */
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(8px);
            z-index: 1000;
            justify-content: center;
            align-items: center;
        }
        .modal-content {
            background: rgba(15, 15, 20, 0.9);
            border: 1px solid rgba(46, 204, 113, 0.2);
            border-radius: 32px;
            padding: 48px;
            max-width: 500px;
            width: 90%;
            text-align: center;
            box-shadow: 0 32px 80px rgba(0, 0, 0, 0.6);
            transform-style: preserve-3d;
            animation: container-3d 6s infinite ease-in-out;
        }
        .modal-title {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 20px;
            color: #ffffff;
            transform: translateZ(30px);
        }
        .modal-desc {
            color: rgba(255, 255, 255, 0.6);
            margin-bottom: 32px;
            line-height: 1.6;
            transform: translateZ(20px);
        }
        .modal-close {
            background: #2ecc71;
            color: white;
            border: none;
            padding: 14px 32px;
            border-radius: 16px;
            font-weight: 700;
            cursor: pointer;
            text-transform: uppercase;
            letter-spacing: 1px;
            transition: all 0.3s;
            transform: translateZ(25px);
        }
        .modal-close:hover {
            transform: translateY(-2px) translateZ(35px);
            box-shadow: 0 10px 20px rgba(46, 204, 113, 0.3);
        }
        @keyframes container-3d {
            0%, 100% { transform: rotateY(0deg) rotateX(0deg); }
            25% { transform: rotateY(2deg) rotateX(1deg); }
            75% { transform: rotateY(-2deg) rotateX(-1deg); }
        }
        :root {
            --accent: ${ACCENT_HEX};
            --accent-strong: ${ACCENT_HEX_ALT};
            --accent-rgb: ${ACCENT_RGB};
        }
        .glow-bg {
            background: radial-gradient(circle, rgba(var(--accent-rgb), 0.1) 0%, transparent 65%);
        }
        .nav-bar,
        .section,
        .modal-content {
            border-color: rgba(var(--accent-rgb), 0.18);
        }
        .logo-box {
            background: rgba(var(--accent-rgb), 0.1);
            border-color: rgba(var(--accent-rgb), 0.3);
        }
        .logo-text {
            background: linear-gradient(135deg, #ffffff 0%, var(--accent) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .nav-link.active,
        .profile-avatar,
        .modal-close {
            background: linear-gradient(135deg, var(--accent), var(--accent-strong));
            color: #ffffff;
        }
        .nav-link.premium {
            color: #e9ddff;
            background: rgba(var(--accent-rgb), 0.16);
            border: 1px solid rgba(var(--accent-rgb), 0.24);
        }
        .container {
            max-width: 1100px;
        }
        .settings-grid {
            display: grid;
            grid-template-columns: 1.1fr 0.9fr;
            gap: 24px;
            align-items: start;
        }
        .premium-panel {
            background: linear-gradient(180deg, rgba(18, 14, 32, 0.88) 0%, rgba(10, 10, 18, 0.78) 100%);
            border: 1px solid rgba(var(--accent-rgb), 0.22);
            box-shadow: 0 18px 40px rgba(0, 0, 0, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.03);
        }
        .premium-kicker {
            display: inline-flex;
            align-items: center;
            padding: 8px 14px;
            border-radius: 999px;
            background: rgba(var(--accent-rgb), 0.14);
            border: 1px solid rgba(var(--accent-rgb), 0.28);
            color: #ddd6fe;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 1.2px;
            text-transform: uppercase;
            margin-bottom: 18px;
        }
        .premium-copy {
            color: rgba(255, 255, 255, 0.68);
            line-height: 1.7;
            margin-bottom: 24px;
            font-size: 15px;
        }
        .premium-features {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-bottom: 24px;
        }
        .premium-feature {
            padding: 10px 14px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.08);
            color: rgba(255, 255, 255, 0.88);
            font-size: 13px;
        }
        .premium-note {
            padding: 16px 18px;
            border-radius: 18px;
            background: rgba(var(--accent-rgb), 0.08);
            border: 1px solid rgba(var(--accent-rgb), 0.16);
            color: rgba(255, 255, 255, 0.74);
            line-height: 1.6;
        }
        @media (max-width: 900px) {
            .settings-grid {
                grid-template-columns: 1fr;
            }
        }
        .toggle {
            border-color: rgba(var(--accent-rgb), 0.22);
        }
        .modal-close:hover {
            box-shadow: 0 10px 20px rgba(var(--accent-rgb), 0.3);
        }
    </style>
</head>
<body>
    <div class="glow-bg"></div>
    <div class="container">
        <div class="nav-bar">
            <div class="nav-left">
                <div class="logo-box">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="${ACCENT_HEX}"/>
                    </svg>
                </div>
                <div class="logo-text">Harras</div>
            </div>
            <div class="nav-links">
                <a href="/dashboard" class="nav-link">Dashboard</a>
                <a href="/leaderboards" class="nav-link">Leaderboards</a>
                <a href="/settings" class="nav-link active">Settings</a>
                <a href="#premium-panel" class="nav-link premium">Premium</a>
            </div>
            <div class="nav-right">
                <div class="icon-btn" onclick="location.reload()">
                    <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"></path>
                    </svg>
                </div>
                <a href="/logout" class="icon-btn" title="Logout">
                    <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                    </svg>
                </a>
                <div class="profile-avatar">${userData.username[0].toUpperCase()}</div>
            </div>
        </div>

        <div class="settings-grid">
            <div class="section">
                <h2>Privacy</h2>
                <div class="setting-item">
                    <div>
                        <div class="setting-label">Show on Leaderboards</div>
                        <div class="setting-desc">Display your stats on public leaderboards</div>
                    </div>
                    <div class="toggle" id="leaderboardToggle" onclick="toggleLeaderboard()">
                        <div class="toggle-slider"></div>
                    </div>
                </div>
            </div>
            <div class="section premium-panel" id="premium-panel">
                <div class="premium-kicker">Premium Access</div>
                <h2>Harras Premium</h2>
                <div class="premium-copy">${PREMIUM_MODAL_DESCRIPTION}</div>
                <div class="premium-features">
                    <div class="premium-feature">90+ bots</div>
                    <div class="premium-feature">Mouse control</div>
                    <div class="premium-feature">2 server boosts</div>
                </div>
                <div class="premium-note">
                    Premium is activated by boosting the server twice. Once unlocked, your premium key can be linked and used with <b>/premium-farm</b>.
                </div>
            </div>
        </div>
    </div>

    <script>
        let showOnLeaderboard = ${userData.showInLeaderboard || false};
        function toggleLeaderboard() {
            showOnLeaderboard = !showOnLeaderboard;
            const toggleBtn = document.getElementById('leaderboardToggle');
            const slider = toggleBtn.querySelector('.toggle-slider');
            if (showOnLeaderboard) {
                toggleBtn.style.background = '${ACCENT_GRADIENT}';
                toggleBtn.style.borderColor = 'rgba(${ACCENT_RGB}, 0.35)';
                slider.style.left = '28px';
            } else {
                toggleBtn.style.background = 'rgba(255, 255, 255, 0.05)';
                toggleBtn.style.borderColor = 'rgba(${ACCENT_RGB}, 0.2)';
                slider.style.left = '4px';
            }

            fetch('/api/leaderboard-preference', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: '${session.userId}', show: showOnLeaderboard })
            });
        }
    </script>
</body>
</html>
        `);
            return;
        }

        // Serve leaderboards page
        if (parsedUrl.pathname === "/leaderboards" && req.method === "GET") {
            const cookies =
                req.headers.cookie?.split(";").reduce((acc, cookie) => {
                    const [key, value] = cookie.trim().split("=");
                    acc[key] = value;
                    return acc;
                }, {}) || {};

            const session = validateSession(cookies.session);
            if (!session) {
                res.writeHead(302, { Location: "/verify" });
                res.end();
                return;
            }

            const verifiedUsers = loadVerifiedUsers();
            const commandStats = loadCommandStats();
            const currentUserData = verifiedUsers[session.userId] || {};
            const profileInitial = (currentUserData.username ||
                session.username ||
                "?")[0].toUpperCase();

            const leaderboard = Object.entries(verifiedUsers)
                .filter(
                    ([id, data]) =>
                        data &&
                        typeof data === "object" &&
                        data.showInLeaderboard === true,
                )
                .map(([id, data]) => {
                    const stats = commandStats[id] || {};
                    const totalCommands = Object.entries(stats)
                        .filter(([key]) => !key.startsWith("_"))
                        .reduce((sum, [, count]) => sum + count, 0);
                    return {
                        username: data.username || "Unknown",
                        totalBots: data.totalBots || 0,
                        totalCommands,
                        isCurrentUser: id === session.userId,
                    };
                })
                .sort((a, b) => b.totalBots - a.totalBots);

            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Harras | Leaderboards</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Outfit', sans-serif;
            background-color: #050505;
            color: #ffffff;
            min-height: 100vh;
            padding: 40px 24px;
            position: relative;
            overflow-x: hidden;
            perspective: 1000px;
        }
        .glow-bg {
            position: absolute;
            width: 800px;
            height: 800px;
            background: radial-gradient(circle, rgba(46, 204, 113, 0.08) 0%, transparent 65%);
            border-radius: 50%;
            top: -300px;
            left: -100px;
            filter: blur(100px);
            pointer-events: none;
            z-index: 1;
            animation: float 20s infinite alternate;
        }
        @keyframes float {
            0% { transform: translate(0,0); }
            100% { transform: translate(30px, 30px); }
        }
        .container {
            max-width: 1000px;
            margin: 0 auto;
            position: relative;
            z-index: 2;
            transform-style: preserve-3d;
        }
        .nav-bar {
            background: rgba(15, 15, 20, 0.7);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border: 1px solid rgba(46, 204, 113, 0.2);
            border-radius: 24px;
            padding: 16px 28px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 40px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            transform: translateZ(20px);
            animation: nav-float 4s infinite ease-in-out;
        }
        @keyframes nav-float {
            0%, 100% { transform: translateZ(20px) translateY(0); }
            50% { transform: translateZ(30px) translateY(-5px); }
        }
        .nav-left {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .logo-box {
            width: 36px;
            height: 36px;
            background: rgba(46, 204, 113, 0.1);
            border: 1px solid rgba(46, 204, 113, 0.3);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .logo-text {
            font-size: 20px;
            font-weight: 700;
            letter-spacing: -0.5px;
            background: linear-gradient(135deg, #ffffff 0%, #2ecc71 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .nav-links {
            display: flex;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.05);
            padding: 6px;
            border-radius: 9999px;
            gap: 4px;
        }
        .nav-link {
            color: rgba(255, 255, 255, 0.6);
            text-decoration: none;
            padding: 8px 20px;
            border-radius: 9999px;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s ease;
        }
        .nav-link:hover {
            color: #ffffff;
            background: rgba(255, 255, 255, 0.05);
        }
        .nav-link.active {
            background: #ffffff;
            color: #050505;
        }
        .nav-link.premium {
            color: #f1c40f;
            font-weight: 600;
        }
        .nav-right {
            display: flex;
            align-items: center;
            gap: 16px;
        }
        .icon-btn {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            align-items: center;
            justify-content: center;
            color: rgba(255, 255, 255, 0.7);
            cursor: pointer;
            transition: all 0.2s;
        }
        .icon-btn:hover {
            background: rgba(255, 255, 255, 0.08);
            color: #ffffff;
            transform: rotate(15deg);
        }
        .profile-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: 14px;
            border: 2px solid rgba(255, 255, 255, 0.1);
        }
        .leaderboard {
            background: rgba(15, 15, 20, 0.7);
            backdrop-filter: blur(24px);
            border: 1px solid rgba(46, 204, 113, 0.1);
            border-radius: 24px;
            padding: 32px 40px;
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
            transform: translateZ(10px);
            animation: leaderboard-3d 12s infinite ease-in-out;
        }
        @keyframes leaderboard-3d {
            0%, 100% { transform: translateZ(10px) rotateY(0); }
            50% { transform: translateZ(20px) rotateY(1deg); }
        }
        .leaderboard h2 {
            color: #ffffff;
            font-size: 22px;
            font-weight: 600;
            margin-bottom: 28px;
            letter-spacing: -0.5px;
        }
        .leaderboard-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .leaderboard-item {
            display: grid;
            grid-template-columns: 80px 1fr 180px 180px;
            gap: 20px;
            padding: 18px 24px;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.04);
            border-radius: 16px;
            align-items: center;
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .leaderboard-item:hover {
            background: rgba(255, 255, 255, 0.04);
            border-color: rgba(46, 204, 113, 0.3);
            transform: scale(1.02) translateZ(15px);
            box-shadow: 0 10px 30px rgba(46, 204, 113, 0.1);
        }
        .leaderboard-item.current-user {
            background: rgba(46, 204, 113, 0.08);
            border-color: rgba(46, 204, 113, 0.3);
        }
        .rank {
            font-size: 18px;
            font-weight: 700;
            color: #2ecc71;
        }
        .username {
            color: #ffffff;
            font-size: 16px;
            font-weight: 500;
        }
        .stat {
            color: rgba(255, 255, 255, 0.4);
            font-size: 14px;
            text-align: right;
        }
        .stat-value {
            color: #ffffff;
            font-weight: 600;
            font-size: 15px;
        }
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: rgba(255, 255, 255, 0.4);
        }
        /* Modal Styles */
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(8px);
            z-index: 1000;
            justify-content: center;
            align-items: center;
        }
        .modal-content {
            background: rgba(15, 15, 20, 0.9);
            border: 1px solid rgba(46, 204, 113, 0.2);
            border-radius: 32px;
            padding: 48px;
            max-width: 500px;
            width: 90%;
            text-align: center;
            box-shadow: 0 32px 80px rgba(0, 0, 0, 0.6);
            transform-style: preserve-3d;
            animation: container-3d 6s infinite ease-in-out;
        }
        .modal-title {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 20px;
            color: #ffffff;
            transform: translateZ(30px);
        }
        .modal-desc {
            color: rgba(255, 255, 255, 0.6);
            margin-bottom: 32px;
            line-height: 1.6;
            transform: translateZ(20px);
        }
        .modal-close {
            background: #2ecc71;
            color: white;
            border: none;
            padding: 14px 32px;
            border-radius: 16px;
            font-weight: 700;
            cursor: pointer;
            text-transform: uppercase;
            letter-spacing: 1px;
            transition: all 0.3s;
            transform: translateZ(25px);
        }
        .modal-close:hover {
            transform: translateY(-2px) translateZ(35px);
            box-shadow: 0 10px 20px rgba(46, 204, 113, 0.3);
        }
        @keyframes container-3d {
            0%, 100% { transform: rotateY(0deg) rotateX(0deg); }
            25% { transform: rotateY(2deg) rotateX(1deg); }
            75% { transform: rotateY(-2deg) rotateX(-1deg); }
        }
        :root {
            --accent: ${ACCENT_HEX};
            --accent-strong: ${ACCENT_HEX_ALT};
            --accent-rgb: ${ACCENT_RGB};
        }
        .glow-bg {
            background: radial-gradient(circle, rgba(var(--accent-rgb), 0.1) 0%, transparent 65%);
        }
        .nav-bar,
        .leaderboard,
        .modal-content {
            border-color: rgba(var(--accent-rgb), 0.18);
        }
        .logo-box {
            background: rgba(var(--accent-rgb), 0.1);
            border-color: rgba(var(--accent-rgb), 0.3);
        }
        .logo-text {
            background: linear-gradient(135deg, #ffffff 0%, var(--accent) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .nav-link.active,
        .profile-avatar,
        .modal-close {
            background: linear-gradient(135deg, var(--accent), var(--accent-strong));
            color: #ffffff;
        }
        .leaderboard-item:hover,
        .leaderboard-item.current-user {
            border-color: rgba(var(--accent-rgb), 0.3);
        }
        .leaderboard-item.current-user {
            background: rgba(var(--accent-rgb), 0.08);
        }
        .leaderboard-item:hover {
            box-shadow: 0 10px 30px rgba(var(--accent-rgb), 0.12);
        }
        .nav-link.premium {
            color: #e9ddff;
            background: rgba(var(--accent-rgb), 0.16);
            border: 1px solid rgba(var(--accent-rgb), 0.24);
        }
        .rank {
            color: #c4b5fd;
        }
        .modal-close:hover {
            box-shadow: 0 10px 20px rgba(var(--accent-rgb), 0.3);
        }
    </style>
</head>
<body>
    <div class="glow-bg"></div>
    <div class="container">
        <div class="nav-bar">
            <div class="nav-left">
                <div class="logo-box">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="${ACCENT_HEX}"/>
                    </svg>
                </div>
                <div class="logo-text">Harras</div>
            </div>
            <div class="nav-links">
                <a href="/dashboard" class="nav-link">Dashboard</a>
                <a href="/leaderboards" class="nav-link active">Leaderboards</a>
                <a href="/settings" class="nav-link">Settings</a>
                <a href="/settings#premium-panel" class="nav-link premium">Premium</a>
            </div>
            <div class="nav-right">
                <div class="icon-btn" onclick="location.reload()">
                    <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"></path>
                    </svg>
                </div>
                <a href="/logout" class="icon-btn" title="Logout">
                    <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                    </svg>
                </a>
                <div class="profile-avatar">${profileInitial}</div>
            </div>
        </div>

        <div class="leaderboard">
            <h2>Top Bot Spawners</h2>
            <div class="leaderboard-list">
                ${
                    leaderboard.length > 0
                        ? leaderboard
                              .map(
                                  (user, idx) => `
                    <div class="leaderboard-item ${user.isCurrentUser ? "current-user" : ""}">
                        <div class="rank">#${idx + 1}</div>
                        <div class="username">${user.username}${user.isCurrentUser ? " (You)" : ""}</div>
                        <div class="stat"><span class="stat-value">${user.totalBots.toLocaleString()}</span> bots</div>
                        <div class="stat"><span class="stat-value">${user.totalCommands}</span> commands</div>
                    </div>
                `,
                              )
                              .join("")
                        : `
                    <div class="empty-state">
                        <p>No users on leaderboard yet</p>
                        <p style="font-size: 13px; margin-top: 8px; color: rgba(255,255,255,0.3)">Enable "Show on Leaderboards" in Settings to appear here</p>
                    </div>
                `
                }
            </div>
        </div>
    </div>
</body>
</html>
        `);
            return;
        }

        // Handle logout
        if (parsedUrl.pathname === "/logout" && req.method === "GET") {
            const cookies =
                req.headers.cookie?.split(";").reduce((acc, cookie) => {
                    const [key, value] = cookie.trim().split("=");
                    acc[key] = value;
                    return acc;
                }, {}) || {};

            if (cookies.session) {
                deleteSession(cookies.session);
            }

            res.writeHead(302, {
                Location: "/verify",
                "Set-Cookie": "session=; Max-Age=0; Path=/",
            });
            res.end();
            return;
        }

        // Health check endpoints for UptimeRobot
        if (
            parsedUrl.pathname === "/health" ||
            parsedUrl.pathname === "/ping" ||
            parsedUrl.pathname === "/"
        ) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
                JSON.stringify({
                    status: "online",
                    uptime: process.uptime(),
                    timestamp: Date.now(),
                    bot: client.user ? client.user.tag : "connecting...",
                    sessions: Object.keys(activeSessions).length,
                    verifiedUsers: Object.keys(loadVerifiedUsers()).length,
                }),
            );
            return;
        }

        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Bot is running\n");
    } catch (error) {
        console.error(error);
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error\n");
    }
});
server.listen(PORT, () => {
    console.log(`[system] health check: [ port ${PORT} ]`);

    // Log environment detection for debugging
    if (process.env.RAILWAY_PUBLIC_DOMAIN) {
        console.log(
            `[system] Railway detected: ${process.env.RAILWAY_PUBLIC_DOMAIN}`,
        );
        console.log(
            `[system] Verification URL: https://${process.env.RAILWAY_PUBLIC_DOMAIN}/verify`,
        );
        console.log(
            `[system] Health endpoint: https://${process.env.RAILWAY_PUBLIC_DOMAIN}/health`,
        );
    } else if (process.env.RENDER_EXTERNAL_URL) {
        console.log(
            `[system] Render detected: ${process.env.RENDER_EXTERNAL_URL}`,
        );
        console.log(
            `[system] Verification URL: ${process.env.RENDER_EXTERNAL_URL}/verify`,
        );
        console.log(
            `[system] Health endpoint: ${process.env.RENDER_EXTERNAL_URL}/health`,
        );
    } else if (process.env.REPLIT_DEV_DOMAIN) {
        console.log(
            `[system] Replit detected: ${process.env.REPLIT_DEV_DOMAIN}`,
        );
        console.log(
            `[system] Verification URL: https://${process.env.REPLIT_DEV_DOMAIN}/verify`,
        );
    } else if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
        console.log(
            `[system] Replit detected: ${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`,
        );
        console.log(
            `[system] Verification URL: https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/verify`,
        );
    } else {
        console.log(`[system] Local environment detected`);
        console.log(
            `[system] Verification URL: http://localhost:${PORT}/verify`,
        );
    }
});

const wss = new WebSocketServer({ server });
wss.on("connection", (ws) => {
    console.log("[system] premium sync: [ client connected ]");
    ws.on("message", (msg) => {
        try {
            const data = unpack(msg);
            const type = data.shift();

            if (type === "A" && global.currentFarmSession) {
                const clientKey = data[9];
                if (
                    !clientKey ||
                    clientKey !== global.currentFarmSession.premiumKey
                ) {
                    return;
                }

                global.currentFarmSession.activeWorkers.forEach((worker) => {
                    sendBotWorker(worker, {
                        type: "position",
                        x: data[0] || 0,
                        y: data[1] || 0,
                        mouseX: data[2] || 0,
                        mouseY: data[3] || 0,
                        mouseDown: data[4],
                        rMouseDown: data[5],
                        mouse: data[6],
                        feeding: data[7],
                        shift: data[8],
                    });
                });

                getReadyRemoteSwarms().forEach((swarm) => {
                    swarm.send(["A", ...data]);
                });
            }
        } catch (e) {}
    });
});

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID || "1521765557064695858";

const PROXIES = [
    "http://1fiRasl1-ttl-0:ADL35LOraUbh6fA@datacenter-ww.lightningproxies.net:1338",
];
const COOLDOWN_FILE = path.join(__dirname, "cooldowns.json");
const VERIFIED_FILE = path.join(__dirname, "verified.txt");
const VERIFIED_USERS_FILE = path.join(__dirname, "verified_users.json");
const COMMAND_STATS_FILE = path.join(__dirname, "command_stats.json");
const SESSIONS_FILE = path.join(__dirname, "sessions.json");

let farmQueue = [];
let isProcessingQueue = false;

// Verification system
const verificationCodes = new Map(); // Map<code, { userId, username, timestamp }>

// Session management - Load from file on startup
function loadSessions() {
    if (!fs.existsSync(SESSIONS_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf8"));
    } catch (e) {
        return {};
    }
}

function saveSessions(sessions) {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

// Initialize sessions from file
const activeSessions = loadSessions();

function generateSessionToken() {
    return require("crypto").randomBytes(32).toString("hex");
}

function createSession(userId, username) {
    const token = generateSessionToken();
    const expiresAt = Date.now() + 365 * 24 * 60 * 60 * 1000; // 365 days (1 year)
    activeSessions[token] = { userId, username, expiresAt };
    saveSessions(activeSessions);
    return token;
}

function validateSession(token) {
    if (!token) return null;
    const session = activeSessions[token];
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
        delete activeSessions[token];
        saveSessions(activeSessions);
        return null;
    }
    return session;
}

function deleteSession(token) {
    delete activeSessions[token];
    saveSessions(activeSessions);
}

// Verified users system
function loadVerifiedUsers() {
    if (!fs.existsSync(VERIFIED_USERS_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(VERIFIED_USERS_FILE, "utf8"));
    } catch (e) {
        return {};
    }
}

function saveVerifiedUsers(users) {
    fs.writeFileSync(VERIFIED_USERS_FILE, JSON.stringify(users, null, 2));
}

function isUserVerified(userId) {
    const users = loadVerifiedUsers();
    return users[userId] !== undefined;
}

function verifyUser(userId, username, showInLeaderboard = null) {
    const users = loadVerifiedUsers();
    const isNewUser = !users[userId];

    users[userId] = {
        username,
        verifiedAt: users[userId]?.verifiedAt || Date.now(),
        verified: true,
        showInLeaderboard:
            showInLeaderboard !== null
                ? showInLeaderboard
                : (users[userId]?.showInLeaderboard ?? null),
        totalBots: users[userId]?.totalBots || 0,
        lastActive: Date.now(),
    };
    saveVerifiedUsers(users);
    console.log(`[system] User verified: ${username} (${userId})`);
    return isNewUser;
}

function updateUserActivity(userId) {
    const users = loadVerifiedUsers();
    if (users[userId]) {
        users[userId].lastActive = Date.now();
        saveVerifiedUsers(users);
    }
}

function incrementBotCount(userId, count) {
    const users = loadVerifiedUsers();
    if (users[userId]) {
        users[userId].totalBots = (users[userId].totalBots || 0) + count;
        saveVerifiedUsers(users);
    }
}

function updateLeaderboardPreference(userId, show) {
    const users = loadVerifiedUsers();
    if (users[userId]) {
        users[userId].showInLeaderboard = show;
        saveVerifiedUsers(users);
    }
}

// Command stats system
function loadCommandStats() {
    if (!fs.existsSync(COMMAND_STATS_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(COMMAND_STATS_FILE, "utf8"));
    } catch (e) {
        return {};
    }
}

function saveCommandStats(stats) {
    fs.writeFileSync(COMMAND_STATS_FILE, JSON.stringify(stats, null, 2));
}

function trackCommand(userId, commandName) {
    const stats = loadCommandStats();
    if (!stats[userId]) {
        stats[userId] = {};
    }
    if (!stats[userId][commandName]) {
        stats[userId][commandName] = 0;
    }
    stats[userId][commandName]++;
    stats[userId]._lastCommand = commandName;
    stats[userId]._lastCommandTime = Date.now();
    saveCommandStats(stats);
    updateUserActivity(userId);
}

function loadCooldowns() {
    if (!fs.existsSync(COOLDOWN_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(COOLDOWN_FILE, "utf8"));
    } catch (e) {
        return {};
    }
}

function saveCooldowns(cooldowns) {
    fs.writeFileSync(COOLDOWN_FILE, JSON.stringify(cooldowns, null, 2));
}

function loadVerified() {
    if (!fs.existsSync(VERIFIED_FILE)) return {};
    const lines = fs
        .readFileSync(VERIFIED_FILE, "utf8")
        .split("\n")
        .filter((l) => l.trim());
    const map = {};
    for (const line of lines) {
        const idx = line.indexOf(":");
        if (idx > 0) {
            map[line.slice(0, idx)] = line.slice(idx + 1);
        }
    }
    return map;
}

function saveVerified(map) {
    const lines = Object.entries(map).map(([uid, key]) => uid + ":" + key);
    fs.writeFileSync(VERIFIED_FILE, lines.join("\n") + "\n");
}

function getKeyForUser(userId) {
    const map = loadVerified();
    return map[userId] || null;
}

function generateVerificationCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

const commands = [
    new SlashCommandBuilder()
        .setName("find")
        .setDescription("find unique server codes for a given hash")
        .setDMPermission(true)
        .addStringOption((option) =>
            option
                .setName("hash")
                .setDescription("the server hash (e.g. #ce)")
                .setRequired(true),
        )
        .addIntegerOption((option) =>
            option
                .setName("teams")
                .setDescription("how many teams are there? (default: 2)")
                .setRequired(false)
                .setMinValue(2)
                .setMaxValue(4),
        ),
    new SlashCommandBuilder()
        .setName("farm")
        .setDescription("spawn 15 bots and move them to specific coordinates")
        .setDMPermission(true)
        .addStringOption((option) =>
            option
                .setName("hash")
                .setDescription("the server hash (e.g. #ce)")
                .setRequired(true),
        )
        .addNumberOption((option) =>
            option
                .setName("x")
                .setDescription("the x coordinate")
                .setRequired(true),
        )
        .addNumberOption((option) =>
            option
                .setName("y")
                .setDescription("the y coordinate")
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName("tank")
                .setDescription("select bot tank class")
                .setRequired(false)
                .addChoices(
                    { name: "Basic", value: "basic" },
                    { name: "Auto 4", value: "auto4" },
                    { name: "Annihilator", value: "anni" },
                    { name: "Penta Shot", value: "penta" },
                    { name: "Octo Tank", value: "octo" },
                    { name: "Spike", value: "spike" },
                    { name: "Auto Overlord", value: "autooverlord" },
                    { name: "Auto Necro", value: "autonecro" },
                    { name: "Factory", value: "factory" },
                    { name: "Spread Shot", value: "spread" },
                    { name: "Triplet", value: "triplet" },
                    { name: "Predator", value: "predator" },
                    { name: "Cyclone", value: "cyclone" },
                    { name: "Engineer", value: "engineer" },
                    { name: "Auto 5", value: "auto5" },
                    { name: "Skimmer", value: "skimmer" },
                    { name: "Swarmer", value: "swarmer" },
                    { name: "Fighter", value: "fighter" },
                    { name: "Rocket", value: "rocket" },
                    { name: "Booster", value: "booster" },
                    { name: "Auto Smasher", value: "autoshasher" },
                    { name: "Landmine", value: "landmine" },
                    { name: "Mega Spike", value: "megaspike" },
                    { name: "Twin", value: "twin" },
                    { name: "Sniper", value: "sniper" },
                ),
        )
        .addStringOption((option) =>
            option
                .setName("direction")
                .setDescription("movement direction")
                .setRequired(false)
                .addChoices(
                    { name: "front", value: "w" },
                    { name: "back", value: "s" },
                    { name: "left", value: "a" },
                    { name: "right", value: "d" },
                ),
        )
        .addStringOption((option) =>
            option
                .setName("autofire")
                .setDescription("toggle autofire")
                .setRequired(false)
                .addChoices(
                    { name: "yes", value: "yes" },
                    { name: "no", value: "no" },
                ),
        )
        .addIntegerOption((option) =>
            option
                .setName("amount")
                .setDescription("number of bots to spawn (owner only)")
                .setRequired(false)
                .setMinValue(1),
        ),
    new SlashCommandBuilder()
        .setName("premium-farm")
        .setDescription(
            "spawn 15 bots with premium mouse-following capabilities",
        )
        .setDMPermission(true)
        .addStringOption((option) =>
            option
                .setName("hash")
                .setDescription("the server hash (e.g. #ce)")
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName("follow_mouse")
                .setDescription("enable real-time mouse following")
                .setRequired(true)
                .addChoices(
                    { name: "yes", value: "yes" },
                    { name: "no", value: "no" },
                ),
        )
        .addNumberOption((option) =>
            option
                .setName("x")
                .setDescription("the x coordinate (optional with follow mouse)")
                .setRequired(false),
        )
        .addNumberOption((option) =>
            option
                .setName("y")
                .setDescription("the y coordinate (optional with follow mouse)")
                .setRequired(false),
        )
        .addStringOption((option) =>
            option
                .setName("tank")
                .setDescription("select bot tank class")
                .setRequired(false)
                .addChoices(
                    { name: "Basic", value: "basic" },
                    { name: "Auto 4", value: "auto4" },
                    { name: "Annihilator", value: "anni" },
                    { name: "Penta Shot", value: "penta" },
                    { name: "Octo Tank", value: "octo" },
                    { name: "Spike", value: "spike" },
                    { name: "Auto Overlord", value: "autooverlord" },
                    { name: "Auto Necro", value: "autonecro" },
                    { name: "Factory", value: "factory" },
                    { name: "Spread Shot", value: "spread" },
                    { name: "Triplet", value: "triplet" },
                    { name: "Predator", value: "predator" },
                ),
        )
        .addStringOption((option) =>
            option
                .setName("direction")
                .setDescription("movement direction")
                .setRequired(false)
                .addChoices(
                    { name: "front", value: "w" },
                    { name: "back", value: "s" },
                    { name: "left", value: "a" },
                    { name: "right", value: "d" },
                ),
        )
        .addStringOption((option) =>
            option
                .setName("autofire")
                .setDescription("toggle autofire")
                .setRequired(false)
                .addChoices(
                    { name: "yes", value: "yes" },
                    { name: "no", value: "no" },
                ),
        )
        .addIntegerOption((option) =>
            option
                .setName("amount")
                .setDescription("number of bots to spawn (owner only)")
                .setRequired(false)
                .setMinValue(1),
        ),
    new SlashCommandBuilder()
        .setName("connect")
        .setDescription("link your premium key to your Discord account")
        .setDMPermission(true)
        .addStringOption((option) =>
            option
                .setName("key")
                .setDescription("your premium key from the Tampermonkey script")
                .setRequired(true),
        ),
    new SlashCommandBuilder()
        .setName("verify")
        .setDescription("verify your account to access bot commands")
        .setDMPermission(true),
    new SlashCommandBuilder()
        .setName("dashboard")
        .setDescription("view your command usage dashboard")
        .setDMPermission(true),
].map((command) => command.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

// Register commands - this will update globally (takes up to 1 hour to propagate)
(async () => {
    try {
        console.log("[system] force updating commands globally...");
        console.log(`[system] registering ${commands.length} commands`);

        // Log all command names for debugging
        const commandNames = commands.map((cmd) => cmd.name);
        console.log("[system] commands to register:", commandNames);

        // First, try to get existing commands to debug
        try {
            const existingCommands = await rest.get(
                Routes.applicationCommands(CLIENT_ID),
            );
            console.log(
                "[system] existing commands:",
                existingCommands.map((c) => c.name),
            );
        } catch (e) {
            console.log(
                "[system] couldn't fetch existing commands:",
                e.message,
            );
        }

        await rest.put(Routes.applicationCommands(CLIENT_ID), {
            body: commands,
        });
        console.log("[system] commands updated successfully");
    } catch (error) {
        console.error("[system] command update failed:", error);
        console.error("[system] error details:", error.message);
    }
})();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.on(Events.ClientReady, async () => {
    console.log(`[system] bot ready: ${client.user.tag}`);

    // Optional: Register commands to a specific guild for instant updates during testing
    // Uncomment and set your GUILD_ID for instant command updates (no 1 hour wait)
    const TEST_GUILD_ID = "1523633039534940220"; // Replace with your test server ID

    if (TEST_GUILD_ID) {
        try {
            console.log(
                `[system] registering commands to guild ${TEST_GUILD_ID} for instant updates...`,
            );
            await rest.put(
                Routes.applicationGuildCommands(CLIENT_ID, TEST_GUILD_ID),
                { body: commands },
            );
            console.log(
                "[system] guild commands registered successfully (instant)",
            );
        } catch (error) {
            console.error(
                "[system] guild command registration failed:",
                error.message,
            );
        }
    }
});

client.on("interactionCreate", async (interaction) => {
    if (interaction.isButton()) {
        if (interaction.customId.startsWith("terminate_")) {
            const ownerId = interaction.customId.split("_")[1];
            if (interaction.user.id !== ownerId) {
                return await interaction.reply({
                    content: "```\nerror: [ permission denied ]\n```",
                    ephemeral: true,
                });
            }

            if (global.currentFarmSession && global.currentFarmSession.finish) {
                await global.currentFarmSession.finish(true);
                await interaction.reply({
                    content: "```\nstatus: [ terminated by user ]\n```",
                    ephemeral: true,
                });
            } else {
                await interaction.reply({
                    content: "```\nerror: [ no active session ]\n```",
                    ephemeral: true,
                });
            }
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    // Check if user is verified (except for /verify command itself)
    if (
        interaction.commandName !== "verify" &&
        !isUserVerified(interaction.user.id)
    ) {
        return await interaction.reply({
            content:
                "```\nerror: [ verification required ]\nreason: [ use /verify to verify your account ]\n```",
            ephemeral: true,
        });
    }

    // Track command usage (only for verified users)
    if (interaction.commandName !== "verify") {
        trackCommand(interaction.user.id, interaction.commandName);
    }

    if (interaction.commandName === "connect") {
        if (
            !interaction.member ||
            !interaction.member.roles.cache.has("1523633043871498362")
        ) {
            const errEmbed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle("system: permission denied")
                .setDescription(
                    "You're not a premium user, boost the server 2 times in order to get Harras premium",
                )
                .setTimestamp();
            return await interaction.reply({
                embeds: [errEmbed],
                ephemeral: true,
            });
        }

        const userId = interaction.user.id;
        const existingKey = getKeyForUser(userId);
        if (existingKey) {
            const errEmbed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle("system: key change denied")
                .setDescription(
                    "You already have a connected key. Changing your key is not allowed. Please contact the owner to change the key.",
                )
                .setTimestamp();
            return await interaction.reply({
                embeds: [errEmbed],
                ephemeral: true,
            });
        }

        const key = interaction.options.getString("key").trim();
        const map = loadVerified();
        map[userId] = key;
        saveVerified(map);

        const embed = new EmbedBuilder()
            .setColor(ACCENT_EMBED)
            .setTitle("system: key linked")
            .setDescription(
                "```\nstatus: [ success ]\nkey: [ " +
                    key +
                    " ]\nuser: [ " +
                    interaction.user.tag +
                    " ]\n```",
            )
            .setFooter({ text: "you can now use /premium-farm" })
            .setTimestamp();

        return await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (interaction.commandName === "verify") {
        const userId = interaction.user.id;
        const username = interaction.user.tag;

        // Check if user is already verified in verified_users.json
        if (isUserVerified(userId)) {
            const alreadyVerifiedEmbed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle("✅ Already Verified")
                .setDescription("Your account is already verified! You can use all commands.")
                .addFields({
                    name: "Access Dashboard",
                    value: "Use `/dashboard` to view your stats and settings.",
                    inline: false,
                })
                .setTimestamp();

            return await interaction.reply({
                embeds: [alreadyVerifiedEmbed],
                ephemeral: true,
            });
        }

        // Generate a unique 6-character code
        let code;
        do {
            code = generateVerificationCode();
        } while (verificationCodes.has(code));

        // Store the code with user info (expires in 10 minutes)
        verificationCodes.set(code, {
            userId,
            username,
            timestamp: Date.now(),
        });

        // Clean up expired codes (older than 10 minutes)
        const TEN_MINUTES = 10 * 60 * 1000;
        for (const [existingCode, data] of verificationCodes.entries()) {
            if (Date.now() - data.timestamp > TEN_MINUTES) {
                verificationCodes.delete(existingCode);
            }
        }

        // Get the verification URL (supports Railway, Render, Replit, and localhost)
        let verifyUrl;
        if (process.env.RAILWAY_PUBLIC_DOMAIN) {
            // Railway deployment
            verifyUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/verify`;
        } else if (process.env.RENDER_EXTERNAL_URL) {
            // Render deployment
            verifyUrl = `${process.env.RENDER_EXTERNAL_URL}/verify`;
        } else if (process.env.REPLIT_DEV_DOMAIN) {
            // New Replit deployments
            verifyUrl = `https://${process.env.REPLIT_DEV_DOMAIN}/verify`;
        } else if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
            // Replit format: https://REPL_SLUG.REPL_OWNER.repl.co
            verifyUrl = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/verify`;
        } else {
            // Local development fallback
            verifyUrl = `http://localhost:${PORT}/verify`;
        }

        console.log(`[system] Generated verification URL: ${verifyUrl}`);

        const verifyEmbed = new EmbedBuilder()
            .setColor(0x667eea)
            .setTitle("Account Verification")
            .setDescription(
                "Click the link below to verify your account and access all commands.",
            )
            .addFields({
                name: "Verification Code",
                value: `\`\`\`\n${code}\n\`\`\``,
                inline: false,
            })
            .addFields({
                name: "Verification Link",
                value: `[Click here to verify](${verifyUrl})`,
                inline: false,
            })
            .setFooter({
                text: "Code expires in 10 minutes • After verification, access your dashboard",
            })
            .setTimestamp();

        return await interaction.reply({
            embeds: [verifyEmbed],
            ephemeral: false,
        });
    }

    if (interaction.commandName === "dashboard") {
        // Generate dashboard URL (no user ID needed - uses session)
        let dashboardUrl;
        if (process.env.RAILWAY_PUBLIC_DOMAIN) {
            dashboardUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/dashboard`;
        } else if (process.env.RENDER_EXTERNAL_URL) {
            dashboardUrl = `${process.env.RENDER_EXTERNAL_URL}/dashboard`;
        } else if (process.env.REPLIT_DEV_DOMAIN) {
            dashboardUrl = `https://${process.env.REPLIT_DEV_DOMAIN}/dashboard`;
        } else if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
            dashboardUrl = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/dashboard`;
        } else {
            dashboardUrl = `http://localhost:${PORT}/dashboard`;
        }

        const dashboardEmbed = new EmbedBuilder()
            .setColor(0x667eea)
            .setTitle("Your Dashboard")
            .setDescription("View your command usage statistics and activity.")
            .addFields({
                name: "Access Dashboard",
                value: `[Click here to open dashboard](${dashboardUrl})`,
                inline: false,
            })
            .setTimestamp();

        return await interaction.reply({
            embeds: [dashboardEmbed],
            ephemeral: true,
        });
    }

    if (
        interaction.commandName === "find" ||
        interaction.commandName === "farm" ||
        interaction.commandName === "premium-farm"
    ) {
        const isFarm =
            interaction.commandName === "farm" ||
            interaction.commandName === "premium-farm";
        const userId = interaction.user.id;
        const isBypassUser = BYPASS_USER_IDS.has(userId);

        let premiumKey = null;
        if (interaction.commandName === "premium-farm") {
            premiumKey = getKeyForUser(userId);
            if (!premiumKey && !isBypassUser) {
                const errEmbed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle("system: access denied")
                    .setDescription(
                        "You're not a premium user, boost the server 2 times in order to get Harras premium",
                    )
                    .setTimestamp();

                return await interaction.reply({
                    embeds: [errEmbed],
                    ephemeral: true,
                });
            }
        }

        if (isFarm) {
            const cooldowns = loadCooldowns();
            const now = Date.now();
            const cooldownDuration = 10 * 1000; // 10 seconds

            if (!isBypassUser && cooldowns[userId] && now < cooldowns[userId]) {
                const remaining = Math.ceil((cooldowns[userId] - now) / 1000);
                const minutes = Math.floor(remaining / 60);
                const seconds = remaining % 60;

                const cooldownEmbed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle("system: cooldown active")
                    .setDescription(
                        "```\nstatus: [ rejected ]\nreason: [ rate limited ]\nremaining: [ " +
                            minutes +
                            "m " +
                            seconds +
                            "s ]\n```",
                    )
                    .setFooter({ text: "Purchase premium to spawn more bots" })
                    .setTimestamp();

                return await interaction.reply({
                    embeds: [cooldownEmbed],
                    ephemeral: false,
                });
            }

            // Set new cooldown
            cooldowns[userId] = now + cooldownDuration;
            saveCooldowns(cooldowns);
        }

        const hashInput = interaction.options.getString("hash");
        const targetX = isFarm ? interaction.options.getNumber("x") : null;
        const targetY = isFarm ? interaction.options.getNumber("y") : null;
        const followMouse = isFarm
            ? interaction.options.getString("follow_mouse") === "yes"
            : false;
        const direction = isFarm
            ? interaction.options.getString("direction")
            : null;
        const autoFire = isFarm
            ? interaction.options.getString("autofire") === "yes"
            : false;
        const tank = isFarm
            ? interaction.options.getString("tank") || "Auto4"
            : "Auto4";
        const amount =
            isFarm && isBypassUser
                ? interaction.options.getInteger("amount") || 17
                : 17;

        const initialHash = hashInput.startsWith("#")
            ? hashInput
            : "#" + hashInput;
        const squadId = initialHash.slice(1);

        // Track bot spawns for statistics
        if (isFarm) {
            incrementBotCount(userId, amount);
            sendWebhookLog(
                formatWebhookLog(interaction.commandName, {
                    amount,
                    hash: initialHash,
                    tank,
                    autoFire,
                    followMouse,
                    direction,
                    targetX,
                    targetY,
                }),
            );
        } else {
            sendWebhookLog(
                formatWebhookLog(interaction.commandName, {
                    amount,
                    hash: initialHash,
                    teams: interaction.options.getInteger("teams") || 2,
                }),
            );
        }

        if (isFarm) {
            // Defer reply immediately to prevent timeout
            await interaction.deferReply();
            
            farmQueue.push({
                interaction,
                commandName: interaction.commandName,
                hashInput,
                targetX,
                targetY,
                followMouse,
                direction,
                autoFire,
                tank,
                amount,
                initialHash,
                squadId,
                premiumKey,
            });

            if (farmQueue.length > 1) {
                const queueEmbed = new EmbedBuilder()
                    .setColor(ACCENT_EMBED)
                    .setTitle("system: queued")
                    .setDescription(
                        "```\nstatus: [ in queue ]\nposition: [ " +
                            (farmQueue.length - 1) +
                            " ]\nnotice: [ starting soon ]\n```",
                    )
                    .setFooter({ text: "want more bots? dm h1" })
                    .setTimestamp();

                await interaction.editReply({ embeds: [queueEmbed] });
                return;
            }

            if (!isProcessingQueue) {
                processQueue();
            }
        } else {
            // Original find logic
            const teams = interaction.options.getInteger("teams") || 2;
            handleFind(interaction, initialHash, squadId, teams);
        }
    }
});

async function handleFind(interaction, initialHash, squadId, targetTeams = 2) {
    const waitEmbed = new EmbedBuilder()
        .setColor(ACCENT_EMBED)
        .setTitle("system: initializing")
        .setFooter({ text: "want more bots? dm h1" })
        .setTimestamp();

    waitEmbed.setDescription(
        "```\nstatus: [ searching... ]\nsource: [ " +
            initialHash +
            " ]\ntarget: [ " +
            targetTeams +
            " teams ]\n```",
    );

    await interaction.reply({ embeds: [waitEmbed] });

    let botLinks = new Set();
    let isFinished = false;
    let activeWorkers = [];
    let attempts = 0;
    const MAX_ATTEMPTS = 60; // 60 seconds total

    const finish = async () => {
        if (isFinished) return;
        isFinished = true;
        activeWorkers.forEach((w) => {
            shutdownBotWorker(w);
        });

        const uniqueLinks = Array.from(botLinks);
        const resultEmbed = new EmbedBuilder()
            .setColor(
                uniqueLinks.length >= targetTeams ? ACCENT_EMBED : 0xff0000,
            )
            .setTitle("system: scan complete")
            .setFooter({ text: "want more bots? dm h1" })
            .setTimestamp();

        if (uniqueLinks.length > 0) {
            resultEmbed.setDescription(
                "```\nresults found: [ " +
                    uniqueLinks.length +
                    " ]\n\n" +
                    uniqueLinks.join("\n") +
                    "\n```",
            );
        } else {
            resultEmbed.setDescription("```\nerror: [ no servers found ]\n```");
        }

        await interaction.editReply({ embeds: [resultEmbed] });
    };

    const updateWaitEmbed = async () => {
        if (isFinished) return;
        const progressEmbed = new EmbedBuilder()
            .setColor(ACCENT_EMBED)
            .setTitle("system: searching")
            .setDescription(
                "```\nstatus: [ scanning... ]\nfound: [ " +
                    botLinks.size +
                    " / " +
                    targetTeams +
                    " ]\nsource: [ " +
                    initialHash +
                    " ]\n```",
            )
            .setFooter({ text: "want more bots? dm h1" })
            .setTimestamp();

        try {
            await interaction.editReply({ embeds: [progressEmbed] });
        } catch (e) {}
    };

    const timeout = setTimeout(finish, 60000);

    const spawnBot = (id) => {
        if (isFinished) return;
        const proxyIdx = id % PROXIES.length;
        const worker = createBotWorker();
        activeWorkers.push(worker);

        worker.on("message", (msg) => {
            if (msg.type === "connected" || msg.type === "hash_update") {
                const link = buildGameLink(msg.hash);
                // Link must contain numbers and be unique
                if (/\d/.test(msg.hash) && !botLinks.has(link)) {
                    console.log(`[system] found unique link: ${link}`);
                    botLinks.add(link);
                    updateWaitEmbed();

                    if (botLinks.size >= targetTeams) {
                        clearTimeout(timeout);
                        setTimeout(finish, 1000);
                    }
                }

                // If we haven't found enough, and this bot is on a link we already have or no numbers,
                // we don't necessarily kill it, but we could if we wanted to "force" a new join.
                // However, the game server usually handles the assignment.
            }
        });

        sendBotWorker(worker, {
            type: "start",
            config: {
                id: id,
                proxy: { type: "http", url: PROXIES[proxyIdx] },
                hash: initialHash,
                name: "discord.gg/fQFTCMC5hY",
                stats: [2, 2, 4, 9, 3, 9, 9, 0, 0, 0],
                type: "follow",
                token: "follow-8fe6ca",
                autoFire: false,
                autoRespawn: true,
                keys: [],
                keysHold: [],
                tank: "Auto4",
                chatMessage: "free farm: discord.gg/fQFTCMC5hY",
                chatSpam: true,
                squadId: squadId,
                reconnectAttempts: 10,
                reconnectDelay: 2000, // Faster reconnect for finding
            },
        });
    };

    // Initial 5 bots
    for (let i = 0; i < 5; i++) {
        setTimeout(() => spawnBot(i), i * 500);
    }

    // "Try harder" logic: if after 15 seconds we don't have enough, spawn 5 more
    setTimeout(() => {
        if (!isFinished && botLinks.size < targetTeams) {
            console.log(
                "[system] find taking too long, spawning 5 more bots to try harder",
            );
            for (let i = 5; i < 10; i++) {
                setTimeout(() => spawnBot(i), (i - 5) * 500);
            }
        }
    }, 15000);
}

async function processQueue() {
    if (farmQueue.length === 0) {
        isProcessingQueue = false;
        return;
    }

    isProcessingQueue = true;
    const task = farmQueue[0];
    const {
        interaction,
        commandName,
        targetX,
        targetY,
        followMouse,
        direction,
        autoFire,
        tank,
        amount,
        initialHash,
        squadId,
        premiumKey,
    } = task;

    const isPremium = commandName === "premium-farm";
    const localAmount = amount;
    const activeRemoteSwarms = isPremium ? await ensureRemoteSwarms() : [];
    const totalExpectedBots = isPremium
        ? localAmount + amount * activeRemoteSwarms.length
        : localAmount;

    const terminateRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`terminate_${interaction.user.id}`)
            .setLabel("Terminate Swarm")
            .setStyle(ButtonStyle.Danger),
    );

    const waitEmbed = new EmbedBuilder()
        .setColor(ACCENT_EMBED)
        .setTitle("system: initializing")
        .setDescription(
            "```\nstatus: [ searching... ]\njoining: [ 0 / " +
                totalExpectedBots +
                " ]\nsource: [ " +
                initialHash +
                " ]\n```",
        )
        .setFooter({ text: "want more bots? dm h1" })
        .setTimestamp();

    waitEmbed.addFields({
        name: "coordinates",
        value: `\`x: ${targetX ?? "dynamic"} | y: ${targetY ?? "dynamic"}\``,
        inline: true,
    });
    if (direction) {
        const dirName = { w: "front", s: "back", a: "left", d: "right" }[
            direction
        ];
        waitEmbed.addFields({
            name: "direction",
            value: `\`${dirName}\``,
            inline: true,
        });
    }
    waitEmbed.addFields({ name: "tank", value: `\`${tank}\``, inline: true });
    if (followMouse)
        waitEmbed.addFields({
            name: "follow mouse",
            value: "`[ active ]`",
            inline: true,
        });
    if (autoFire)
        waitEmbed.addFields({
            name: "autofire",
            value: "`[ active ]`",
            inline: true,
        });

    if (interaction.replied || interaction.deferred)
        await interaction.editReply({
            embeds: [waitEmbed],
            components: [terminateRow],
        });
    else
        await interaction.reply({
            embeds: [waitEmbed],
            components: [terminateRow],
        });

    let botLinks = new Map();
    botLinks.set("remote", buildGameLink(initialHash));
    let botsDone = new Set();
    let isFinished = false;
    let activeWorkers = [];
    let lastEditTime = 0;
    let updateTimeout = null;
    let disconnectTimeout = null;

    const updateProgress = async () => {
        if (isFinished) return;
        const now = Date.now();
        if (updateTimeout) return;
        const delay = Math.max(0, 1500 - (now - lastEditTime));

        updateTimeout = setTimeout(async () => {
            if (isFinished) {
                updateTimeout = null;
                return;
            }
            lastEditTime = Date.now();
            updateTimeout = null;

            const progressEmbed = new EmbedBuilder()
                .setColor(ACCENT_EMBED)
                .setTitle("system: initializing")
                .setDescription(
                    "```\nstatus: [ searching... ]\njoining: [ " +
                        botsDone.size +
                        " / " +
                        totalExpectedBots +
                        " ]\nsource: [ " +
                        initialHash +
                        " ]\n```",
                )
                .setFooter({ text: "want more bots? dm h1" })
                .setTimestamp();

            progressEmbed.addFields({
                name: "coordinates",
                value: `\`x: ${targetX ?? "dynamic"} | y: ${targetY ?? "dynamic"}\``,
                inline: true,
            });
            if (direction) {
                const dirName = {
                    w: "front",
                    s: "back",
                    a: "left",
                    d: "right",
                }[direction];
                progressEmbed.addFields({
                    name: "direction",
                    value: `\`${dirName}\``,
                    inline: true,
                });
            }
            progressEmbed.addFields({
                name: "tank",
                value: `\`${tank}\``,
                inline: true,
            });
            if (followMouse)
                progressEmbed.addFields({
                    name: "follow mouse",
                    value: "`[ active ]`",
                    inline: true,
                });
            if (autoFire)
                progressEmbed.addFields({
                    name: "autofire",
                    value: "`[ active ]`",
                    inline: true,
                });

            try {
                await interaction.editReply({
                    embeds: [progressEmbed],
                    components: [terminateRow],
                });
            } catch (e) {}
        }, delay);
    };

    const finish = async (immediate = false) => {
        if (isFinished && !immediate) return;
        isFinished = true;

        if (updateTimeout) clearTimeout(updateTimeout);
        if (disconnectTimeout) clearTimeout(disconnectTimeout);

        const cleanup = () => {
            console.log(`[system] cleaning up session`);
            global.currentFarmSession = null;
            activeWorkers.forEach((w) => {
                shutdownBotWorker(w);
            });

            activeRemoteSwarms.forEach((swarm) => {
                swarm.send(["B"]);
            });
            shutdownRemoteSwarms();

            farmQueue.shift();
            processQueue();
        };

        if (immediate) {
            cleanup();
        } else {
            disconnectTimeout = setTimeout(cleanup, SESSION_CLEANUP_DELAY);
        }

        const uniqueLinks = Array.from(new Set(botLinks.values()));
        const resultEmbed = new EmbedBuilder()
            .setColor(uniqueLinks.length > 0 ? ACCENT_EMBED : 0xff0000)
            .setTitle(immediate ? "system: terminated" : "system: bots active")
            .setFooter({ text: "want more bots? dm h1" })
            .setTimestamp();

        if (uniqueLinks.length > 0) {
            let desc =
                "```\nstatus: [ " +
                (immediate ? "terminated" : "successful") +
                " ]\ntarget: [ " +
                uniqueLinks[0] +
                " ]\nzone: [ x:" +
                (targetX ?? "dynamic") +
                ", y:" +
                (targetY ?? "dynamic") +
                " ]\n";
            if (direction)
                desc +=
                    "direction: [ " +
                    { w: "front", s: "back", a: "left", d: "right" }[
                        direction
                    ] +
                    " ]\n";
            desc += "tank: [ " + tank + " ]\n";
            if (followMouse) desc += "follow mouse: [ active ]\n";
            if (autoFire) desc += "autofire: [ active ]\n";
            desc +=
                "count: [ " +
                botsDone.size +
                " / " +
                totalExpectedBots +
                " units ]\n```";
            resultEmbed.setDescription(desc);
        } else {
            resultEmbed.setDescription("```\nerror: [ no servers found ]\n```");
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`terminate_${interaction.user.id}`)
                .setLabel("Terminate Swarm")
                .setStyle(ButtonStyle.Danger)
                .setDisabled(immediate),
        );

        await interaction.editReply({
            embeds: [resultEmbed],
            components: [row],
        });
    };

    global.currentFarmSession = {
        botsDone,
        updateProgress,
        finish,
        activeWorkers,
        premiumKey,
    };

    const timeout = setTimeout(finish, 35000);

    // Local and Remote Spawning Logic
    if (isPremium) {
        console.log(
            `[system] premium spawn: ${amount} local units and ${amount} per remote`,
        );
        activeRemoteSwarms.forEach((swarm) => {
            swarm.send(["F", squadId, amount]);
            swarm.send(["Z", tank]);
            swarm.send(["T", "free farm: discord.gg/fQFTCMC5hY", true]);
        });
    } else {
        console.log(`[system] standard spawn: ${amount} local units only`);
    }

    // Local Spawning
    for (let i = 0; i < localAmount; i++) {
        setTimeout(() => {
            if (isFinished) return;
            const proxyIdx = i % PROXIES.length;
            const worker = createBotWorker();
            activeWorkers.push(worker);

            worker.on("message", (msg) => {
                if (msg.type === "connected" || msg.type === "hash_update") {
                    botLinks.set(i, buildGameLink(msg.hash));
                    if (msg.hash.length > initialHash.length) {
                        if (!botsDone.has(i)) {
                            botsDone.add(i);
                            updateProgress();
                        }
                        sendBotWorker(worker, {
                            type: "position",
                            x: targetX,
                            y: targetY,
                            mouseX: 0,
                            mouseY: 0,
                            mouse: followMouse,
                            feeding: false,
                            shift: false,
                            autoFire: autoFire,
                        });
                    }
                    if (!isPremium && botsDone.size >= totalExpectedBots) {
                        clearTimeout(timeout);
                        setTimeout(finish, 1000);
                    }
                }
            });

            sendBotWorker(worker, {
                type: "start",
                config: {
                    id: i,
                    proxy: { type: "http", url: PROXIES[proxyIdx] },
                    hash: initialHash,
                    name: "discord.gg/fQFTCMC5hY",
                    stats: [2, 2, 4, 9, 3, 9, 9, 0, 0, 0],
                    type: "follow",
                    token: "follow-8fe6ca",
                    autoFire: autoFire,
                    autoRespawn: true,
                    keys: [],
                    keysHold: direction ? [direction] : [],
                    targetX: targetX,
                    targetY: targetY,
                    followMouse: followMouse,
                    tank: tank,
                    chatMessage: "free farm: discord.gg/fQFTCMC5hY",
                    chatSpam: true,
                    squadId: squadId,
                    reconnectAttempts: 10,
                    reconnectDelay: 1000,
                },
            });
        }, i * 30);
    }

    // Progress Simulation for Remotes (Premium Only)
    if (isPremium) {
        let remoteSimulated = 0;
        const remoteTotal = amount * activeRemoteSwarms.length;
        const progressInterval = setInterval(() => {
            if (isFinished) {
                clearInterval(progressInterval);
                return;
            }

            if (remoteSimulated < remoteTotal) {
                remoteSimulated += Math.ceil(remoteTotal / 10);
                if (remoteSimulated > remoteTotal)
                    remoteSimulated = remoteTotal;

                // Offset remote IDs to avoid collision with local IDs (0 to amount-1)
                for (let i = 0; i < remoteSimulated; i++) {
                    const id = `remote_${i}`;
                    if (!botsDone.has(id)) {
                        botsDone.add(id);
                    }
                }
                updateProgress();

                if (botsDone.size >= totalExpectedBots) {
                    clearInterval(progressInterval);
                    clearTimeout(timeout);
                    setTimeout(finish, 1000);
                }
            }
        }, 1000);
    }
}

async function startBot() {
    try {
        console.log(`[system] attempting discord login...`);
        await client.login(TOKEN);
    } catch (err) {
        console.log(`[system] login failure: [ ${err.message} ]`);
        console.log(`[system] retrying in 10s...`);
        setTimeout(startBot, 10000);
    }
}
startBot();
