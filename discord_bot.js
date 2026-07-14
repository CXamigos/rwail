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
const { fork } = require("child_process");
const fs = require("fs");
const path = require("path");
const { WebSocketServer, WebSocket } = require("ws");
const { pack, unpack } = require("msgpackr");

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
        this.connect();
    }

    connect() {
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
                    console.log(`[system] remote verified: [ ${this.url} ]`);
                }
            } catch (e) {}
        });
        this.ws.on("close", () => {
            this.verified = false;
            setTimeout(() => this.connect(), 5000);
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
}

const remoteSwarms = REMOTE_URLS.map((url) => new RemoteSwarm(url));

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
    <title>Verification</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
            position: relative;
            overflow: hidden;
        }
        
        body::before {
            content: '';
            position: absolute;
            width: 400px;
            height: 400px;
            background: radial-gradient(circle, rgba(102, 126, 234, 0.15) 0%, transparent 70%);
            border-radius: 50%;
            top: -100px;
            left: -100px;
            animation: float 20s infinite ease-in-out;
        }
        
        body::after {
            content: '';
            position: absolute;
            width: 300px;
            height: 300px;
            background: radial-gradient(circle, rgba(118, 75, 162, 0.15) 0%, transparent 70%);
            border-radius: 50%;
            bottom: -50px;
            right: -50px;
            animation: float 15s infinite ease-in-out reverse;
        }
        
        @keyframes float {
            0%, 100% { transform: translate(0, 0); }
            50% { transform: translate(50px, 50px); }
        }
        
        .container {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 50px 40px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            text-align: center;
            max-width: 420px;
            width: 100%;
            position: relative;
            z-index: 1;
        }
        
        h1 {
            color: #ffffff;
            margin-bottom: 8px;
            font-size: 32px;
            font-weight: 600;
            letter-spacing: -0.5px;
        }
        
        .subtitle {
            color: rgba(255, 255, 255, 0.6);
            margin-bottom: 40px;
            font-size: 14px;
            font-weight: 400;
        }
        
        .input-group {
            margin-bottom: 24px;
        }
        
        label {
            display: block;
            text-align: left;
            color: rgba(255, 255, 255, 0.8);
            font-weight: 500;
            margin-bottom: 10px;
            font-size: 13px;
            letter-spacing: 0.5px;
            text-transform: uppercase;
        }
        
        input {
            width: 100%;
            padding: 16px 20px;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 12px;
            font-size: 18px;
            text-transform: uppercase;
            letter-spacing: 4px;
            text-align: center;
            font-weight: 600;
            color: #ffffff;
            transition: all 0.3s ease;
        }
        
        input::placeholder {
            color: rgba(255, 255, 255, 0.3);
            letter-spacing: 2px;
        }
        
        input:focus {
            outline: none;
            background: rgba(255, 255, 255, 0.12);
            border-color: rgba(102, 126, 234, 0.5);
            box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
        }
        
        button {
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.9) 0%, rgba(118, 75, 162, 0.9) 100%);
            color: white;
            border: none;
            padding: 16px 40px;
            font-size: 15px;
            font-weight: 600;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.3s ease;
            width: 100%;
            letter-spacing: 1px;
            text-transform: uppercase;
        }
        
        button:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 12px 24px rgba(102, 126, 234, 0.3);
            background: linear-gradient(135deg, rgba(102, 126, 234, 1) 0%, rgba(118, 75, 162, 1) 100%);
        }
        
        button:active:not(:disabled) {
            transform: translateY(0);
        }
        
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .status {
            margin-top: 24px;
            padding: 14px 20px;
            border-radius: 10px;
            font-weight: 500;
            font-size: 14px;
            display: none;
            backdrop-filter: blur(10px);
        }
        
        .status.success {
            background: rgba(52, 211, 153, 0.15);
            border: 1px solid rgba(52, 211, 153, 0.3);
            color: #6ee7b7;
            display: block;
        }
        
        .status.error {
            background: rgba(239, 68, 68, 0.15);
            border: 1px solid rgba(239, 68, 68, 0.3);
            color: #fca5a5;
            display: block;
        }
        
        .status.loading {
            background: rgba(59, 130, 246, 0.15);
            border: 1px solid rgba(59, 130, 246, 0.3);
            color: #93c5fd;
            display: block;
        }
        
        .spinner {
            display: inline-block;
            width: 14px;
            height: 14px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top-color: white;
            animation: spin 0.8s linear infinite;
            margin-right: 8px;
            vertical-align: middle;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Verification</h1>
        <p class="subtitle">Enter your 6-digit code</p>
        
        <div class="input-group">
            <label for="codeInput">Code</label>
            <input 
                type="text" 
                id="codeInput" 
                maxlength="6" 
                placeholder="ABC123"
                autocomplete="off"
                autofocus
            />
        </div>
        
        <button id="verifyBtn" onclick="verify()">Verify Account</button>
        
        <div id="status" class="status"></div>
    </div>

    <script>
        const input = document.getElementById('codeInput');
        
        input.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                verify();
            }
        });

        async function verify() {
            const btn = document.getElementById('verifyBtn');
            const status = document.getElementById('status');
            const code = input.value.trim();
            
            if (code.length !== 6) {
                status.className = 'status error';
                status.textContent = 'Please enter a 6-character code';
                return;
            }
            
            status.className = 'status loading';
            status.innerHTML = '<span class="spinner"></span>Verifying...';
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span>Verifying...';
            
            try {
                const response = await fetch('/api/verify', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ code })
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                    if (data.isNewUser) {
                        // Show leaderboard preference modal
                        showLeaderboardModal(data.userId);
                    } else {
                        // Existing user, redirect to dashboard
                        status.className = 'status success';
                        status.textContent = 'Verification successful';
                        btn.textContent = 'Verified';
                        input.disabled = true;
                        
                        setTimeout(() => {
                            window.location.href = '/dashboard';
                        }, 1500);
                    }
                } else {
                    throw new Error(data.error || 'Verification failed');
                }
            } catch (error) {
                status.className = 'status error';
                status.textContent = error.message;
                btn.textContent = 'Verify Account';
                btn.disabled = false;
            }
        }
        
        function showLeaderboardModal(userId) {
            document.querySelector('.container').style.display = 'none';
            
            const modal = document.createElement('div');
            modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; z-index: 1000;';
            
            modal.innerHTML = '<div style="background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; padding: 50px 40px; max-width: 480px; width: 90%; text-align: center;">' +
                '<h2 style="color: #ffffff; margin-bottom: 16px; font-size: 24px; font-weight: 600;">Leaderboard Preference</h2>' +
                '<p style="color: rgba(255, 255, 255, 0.6); margin-bottom: 32px; font-size: 14px; line-height: 1.6;">Do you want to appear on the public leaderboards? You can change this anytime in settings.</p>' +
                '<div style="display: flex; gap: 12px;">' +
                '<button onclick="setLeaderboardPref(\\'' + userId + '\\', true)" style="flex: 1; background: linear-gradient(135deg, rgba(102, 126, 234, 0.9) 0%, rgba(118, 75, 162, 0.9) 100%); color: white; border: none; padding: 14px 24px; font-size: 14px; font-weight: 600; border-radius: 12px; cursor: pointer; text-transform: uppercase; letter-spacing: 0.5px;">Yes, Show Me</button>' +
                '<button onclick="setLeaderboardPref(\\'' + userId + '\\', false)" style="flex: 1; background: rgba(255, 255, 255, 0.08); color: rgba(255, 255, 255, 0.9); border: 1px solid rgba(255, 255, 255, 0.15); padding: 14px 24px; font-size: 14px; font-weight: 600; border-radius: 12px; cursor: pointer; text-transform: uppercase; letter-spacing: 0.5px;">No, Keep Private</button>' +
                '</div></div>';
            
            document.body.appendChild(modal);
        }
        
        async function setLeaderboardPref(userId, show) {
            try {
                const response = await fetch('/api/leaderboard-preference', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ userId, show })
                });
                
                if (response.ok) {
                    window.location.href = '/dashboard';
                }
            } catch (error) {
                console.error('Failed to set preference:', error);
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
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ success: false, error: "Invalid code format" }));
                    return;
                }

                const verificationData = verificationCodes.get(code.toUpperCase());
                
                if (!verificationData) {
                    res.writeHead(404, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ success: false, error: "Invalid or expired code" }));
                    return;
                }

                // Check if code expired (10 minutes)
                const TEN_MINUTES = 10 * 60 * 1000;
                if (Date.now() - verificationData.timestamp > TEN_MINUTES) {
                    verificationCodes.delete(code.toUpperCase());
                    res.writeHead(410, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ success: false, error: "Code has expired" }));
                    return;
                }

                // Verification successful - check if new user
                const isNewUser = verifyUser(verificationData.userId, verificationData.username);
                
                // Create session
                const sessionToken = createSession(verificationData.userId, verificationData.username);
                
                // Remove used code
                verificationCodes.delete(code.toUpperCase());

                res.writeHead(200, { 
                    "Content-Type": "application/json",
                    "Set-Cookie": `session=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}; Path=/`
                });
                res.end(JSON.stringify({ 
                    success: true, 
                    username: verificationData.username,
                    userId: verificationData.userId,
                    isNewUser: isNewUser
                }));
            } catch (e) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, error: "Server error" }));
            }
        });
        return;
    }

    // Handle leaderboard preference API
    if (parsedUrl.pathname === "/api/leaderboard-preference" && req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => {
            body += chunk.toString();
        });
        req.on("end", () => {
            try {
                const { userId, show } = JSON.parse(body);
                
                if (!userId || typeof show !== 'boolean') {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ success: false, error: "Invalid request" }));
                    return;
                }

                updateLeaderboardPreference(userId, show);

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, error: "Server error" }));
            }
        });
        return;
    }

    // Serve dashboard page
    if (parsedUrl.pathname === "/dashboard" && req.method === "GET") {
        // Parse cookies
        const cookies = req.headers.cookie?.split(';').reduce((acc, cookie) => {
            const [key, value] = cookie.trim().split('=');
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
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Session Expired</title>
    <style>
        body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            color: white;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
        }
        .container {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 50px;
            text-align: center;
            max-width: 400px;
        }
        h1 { margin-bottom: 16px; font-size: 28px; }
        p { color: rgba(255, 255, 255, 0.6); margin-bottom: 24px; }
        a {
            display: inline-block;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            text-decoration: none;
            padding: 12px 32px;
            border-radius: 12px;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Session Expired</h1>
        <p>Please verify your account to continue</p>
        <a href="/verify">Verify Account</a>
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
            .filter(([key]) => !key.startsWith('_'))
            .reduce((sum, [, count]) => sum + count, 0);
        const uniqueCommands = Object.keys(userStats).filter(k => !k.startsWith('_')).length;
        const totalBots = userData.totalBots || 0;
        const lastCommand = userStats._lastCommand || 'None';
        const lastCommandTime = userStats._lastCommandTime;
        const lastActive = userData.lastActive ? new Date(userData.lastActive).toLocaleString() : 'Never';
        const memberSince = new Date(userData.verifiedAt).toLocaleDateString();
        const daysSinceJoin = Math.floor((Date.now() - userData.verifiedAt) / (1000 * 60 * 60 * 24));
        
        // Get most used command
        const commandEntries = Object.entries(userStats).filter(([key]) => !key.startsWith('_'));
        const mostUsedCommand = commandEntries.length > 0 
            ? commandEntries.sort((a, b) => b[1] - a[1])[0] 
            : ['None', 0];

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            min-height: 100vh;
            padding: 40px 20px;
            position: relative;
            overflow-x: hidden;
        }
        
        body::before {
            content: '';
            position: absolute;
            width: 400px;
            height: 400px;
            background: radial-gradient(circle, rgba(102, 126, 234, 0.15) 0%, transparent 70%);
            border-radius: 50%;
            top: -100px;
            left: -100px;
            animation: float 20s infinite ease-in-out;
        }
        
        body::after {
            content: '';
            position: absolute;
            width: 300px;
            height: 300px;
            background: radial-gradient(circle, rgba(118, 75, 162, 0.15) 0%, transparent 70%);
            border-radius: 50%;
            bottom: -50px;
            right: -50px;
            animation: float 15s infinite ease-in-out reverse;
        }
        
        @keyframes float {
            0%, 100% { transform: translate(0, 0); }
            50% { transform: translate(50px, 50px); }
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            position: relative;
            z-index: 1;
        }
        
        .header {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 32px 40px;
            margin-bottom: 24px;
        }
        
        .header h1 {
            color: #ffffff;
            font-size: 28px;
            font-weight: 600;
            margin-bottom: 8px;
            letter-spacing: -0.5px;
        }
        
        .header .username {
            color: rgba(255, 255, 255, 0.6);
            font-size: 14px;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 24px;
            margin-bottom: 24px;
        }
        
        .stat-card {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 28px;
            transition: all 0.3s ease;
        }
        
        .stat-card:hover {
            background: rgba(255, 255, 255, 0.08);
            transform: translateY(-2px);
        }
        
        .stat-label {
            color: rgba(255, 255, 255, 0.6);
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 12px;
            font-weight: 500;
        }
        
        .stat-value {
            color: #ffffff;
            font-size: 36px;
            font-weight: 700;
            letter-spacing: -1px;
        }
        
        .commands-section {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 32px 40px;
        }
        
        .commands-section h2 {
            color: #ffffff;
            font-size: 22px;
            font-weight: 600;
            margin-bottom: 24px;
            letter-spacing: -0.5px;
        }
        
        .command-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        
        .command-item {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            padding: 16px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: all 0.2s ease;
        }
        
        .command-item:hover {
            background: rgba(255, 255, 255, 0.06);
        }
        
        .command-name {
            color: rgba(255, 255, 255, 0.9);
            font-size: 15px;
            font-weight: 500;
            font-family: 'Consolas', 'Monaco', monospace;
        }
        
        .command-count {
            color: rgba(102, 126, 234, 0.9);
            font-size: 18px;
            font-weight: 600;
        }
        
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: rgba(255, 255, 255, 0.4);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Dashboard</h1>
            <div class="username">${userData.username}</div>
            <div class="nav" style="display: flex; gap: 16px; margin-top: 16px; flex-wrap: wrap;">
                <a href="/dashboard" style="color: #667eea; text-decoration: none; font-weight: 500;">Dashboard</a>
                <a href="/leaderboards" style="color: rgba(255, 255, 255, 0.6); text-decoration: none;">Leaderboards</a>
                <a href="/settings" style="color: rgba(255, 255, 255, 0.6); text-decoration: none;">Settings</a>
                <a href="/logout" style="color: rgba(255, 255, 255, 0.6); text-decoration: none;">Logout</a>
            </div>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Total Commands</div>
                <div class="stat-value">${totalCommands}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Bots Spawned</div>
                <div class="stat-value">${totalBots.toLocaleString()}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Most Used Command</div>
                <div class="stat-value" style="font-size: 18px;">/${mostUsedCommand[0]} (${mostUsedCommand[1]}×)</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Unique Commands</div>
                <div class="stat-value">${uniqueCommands}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Last Command</div>
                <div class="stat-value" style="font-size: 18px;">/${lastCommand}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Member For</div>
                <div class="stat-value" style="font-size: 20px;">${daysSinceJoin} days</div>
            </div>
        </div>
        
        <div class="commands-section">
            <h2>Command Usage</h2>
            ${commandEntries.length > 0 ? `
                <div class="command-list">
                    ${commandEntries
                        .sort((a, b) => b[1] - a[1])
                        .map(([cmd, count]) => `
                            <div class="command-item">
                                <div class="command-name">/${cmd}</div>
                                <div class="command-count">${count}×</div>
                            </div>
                        `).join('')}
                </div>
            ` : `
                <div class="empty-state">
                    <p>No commands used yet</p>
                </div>
            `}
        </div>
    </div>
</body>
</html>
        `);
        return;
    }

    // Serve settings page
    if (parsedUrl.pathname === "/settings" && req.method === "GET") {
        const cookies = req.headers.cookie?.split(';').reduce((acc, cookie) => {
            const [key, value] = cookie.trim().split('=');
            acc[key] = value;
            return acc;
        }, {}) || {};
        
        const session = validateSession(cookies.session);
        if (!session) {
            res.writeHead(302, { 'Location': '/verify' });
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
    <title>Settings</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            min-height: 100vh;
            padding: 40px 20px;
        }
        .container { max-width: 800px; margin: 0 auto; }
        .header {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 32px 40px;
            margin-bottom: 24px;
        }
        .header h1 { color: #ffffff; font-size: 28px; margin-bottom: 16px; }
        .nav {
            display: flex;
            gap: 16px;
            flex-wrap: wrap;
        }
        .nav a {
            color: rgba(255, 255, 255, 0.6);
            text-decoration: none;
            font-weight: 500;
            transition: color 0.2s;
        }
        .nav a:hover, .nav a.active { color: #667eea; }
        .section {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 32px 40px;
        }
        .section h2 { color: #ffffff; font-size: 20px; margin-bottom: 20px; }
        .setting-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .setting-item:last-child { border-bottom: none; }
        .setting-label {
            color: rgba(255, 255, 255, 0.9);
            font-size: 16px;
        }
        .setting-desc {
            color: rgba(255, 255, 255, 0.5);
            font-size: 13px;
            margin-top: 4px;
        }
        .toggle {
            position: relative;
            width: 50px;
            height: 26px;
            background: ${userData.showInLeaderboard ? 'linear-gradient(135deg, #667eea, #764ba2)' : 'rgba(255, 255, 255, 0.1)'};
            border-radius: 13px;
            cursor: pointer;
            transition: background 0.3s;
        }
        .toggle-slider {
            position: absolute;
            top: 3px;
            left: ${userData.showInLeaderboard ? '27px' : '3px'};
            width: 20px;
            height: 20px;
            background: white;
            border-radius: 50%;
            transition: left 0.3s;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Settings</h1>
            <div class="nav">
                <a href="/dashboard">Dashboard</a>
                <a href="/leaderboards">Leaderboards</a>
                <a href="/settings" class="active">Settings</a>
                <a href="/logout">Logout</a>
            </div>
        </div>
        
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
    </div>
    
    <script>
        let showInLeaderboard = ${userData.showInLeaderboard || false};
        
        function toggleLeaderboard() {
            showInLeaderboard = !showInLeaderboard;
            const toggle = document.getElementById('leaderboardToggle');
            const slider = toggle.querySelector('.toggle-slider');
            
            if (showInLeaderboard) {
                toggle.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
                slider.style.left = '27px';
            } else {
                toggle.style.background = 'rgba(255, 255, 255, 0.1)';
                slider.style.left = '3px';
            }
            
            fetch('/api/leaderboard-preference', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: '${session.userId}', show: showInLeaderboard })
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
        const cookies = req.headers.cookie?.split(';').reduce((acc, cookie) => {
            const [key, value] = cookie.trim().split('=');
            acc[key] = value;
            return acc;
        }, {}) || {};
        
        const session = validateSession(cookies.session);
        if (!session) {
            res.writeHead(302, { 'Location': '/verify' });
            res.end();
            return;
        }
        
        const verifiedUsers = loadVerifiedUsers();
        const commandStats = loadCommandStats();
        
        // Build leaderboard
        const leaderboard = Object.entries(verifiedUsers)
            .filter(([id, data]) => data.showInLeaderboard === true)
            .map(([id, data]) => {
                const stats = commandStats[id] || {};
                const totalCommands = Object.entries(stats)
                    .filter(([key]) => !key.startsWith('_'))
                    .reduce((sum, [, count]) => sum + count, 0);
                return {
                    username: data.username,
                    totalBots: data.totalBots || 0,
                    totalCommands,
                    isCurrentUser: id === session.userId
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
    <title>Leaderboards</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            min-height: 100vh;
            padding: 40px 20px;
        }
        .container { max-width: 1000px; margin: 0 auto; }
        .header {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 32px 40px;
            margin-bottom: 24px;
        }
        .header h1 { color: #ffffff; font-size: 28px; margin-bottom: 16px; }
        .nav {
            display: flex;
            gap: 16px;
            flex-wrap: wrap;
        }
        .nav a {
            color: rgba(255, 255, 255, 0.6);
            text-decoration: none;
            font-weight: 500;
            transition: color 0.2s;
        }
        .nav a:hover, .nav a.active { color: #667eea; }
        .leaderboard {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 32px 40px;
        }
        .leaderboard h2 { color: #ffffff; font-size: 22px; margin-bottom: 24px; }
        .leaderboard-item {
            display: grid;
            grid-template-columns: 60px 1fr 150px 150px;
            gap: 20px;
            padding: 16px 20px;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            margin-bottom: 12px;
            align-items: center;
        }
        .leaderboard-item.current-user {
            background: rgba(102, 126, 234, 0.1);
            border-color: rgba(102, 126, 234, 0.3);
        }
        .rank {
            color: #667eea;
            font-size: 20px;
            font-weight: 700;
        }
        .username {
            color: rgba(255, 255, 255, 0.9);
            font-size: 16px;
            font-weight: 500;
        }
        .stat {
            color: rgba(255, 255, 255, 0.7);
            font-size: 14px;
            text-align: right;
        }
        .stat-value {
            color: #667eea;
            font-weight: 600;
        }
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: rgba(255, 255, 255, 0.4);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Leaderboards</h1>
            <div class="nav">
                <a href="/dashboard">Dashboard</a>
                <a href="/leaderboards" class="active">Leaderboards</a>
                <a href="/settings">Settings</a>
                <a href="/logout">Logout</a>
            </div>
        </div>
        
        <div class="leaderboard">
            <h2>Top Bot Spawners</h2>
            ${leaderboard.length > 0 ? leaderboard.map((user, idx) => `
                <div class="leaderboard-item ${user.isCurrentUser ? 'current-user' : ''}">
                    <div class="rank">#${idx + 1}</div>
                    <div class="username">${user.username}${user.isCurrentUser ? ' (You)' : ''}</div>
                    <div class="stat"><span class="stat-value">${user.totalBots.toLocaleString()}</span> bots</div>
                    <div class="stat"><span class="stat-value">${user.totalCommands}</span> commands</div>
                </div>
            `).join('') : `
                <div class="empty-state">
                    <p>No users on leaderboard yet</p>
                    <p style="font-size: 13px; margin-top: 8px;">Enable "Show on Leaderboards" in Settings to appear here</p>
                </div>
            `}
        </div>
    </div>
</body>
</html>
        `);
        return;
    }

    // Handle logout
    if (parsedUrl.pathname === "/logout" && req.method === "GET") {
        const cookies = req.headers.cookie?.split(';').reduce((acc, cookie) => {
            const [key, value] = cookie.trim().split('=');
            acc[key] = value;
            return acc;
        }, {}) || {};
        
        if (cookies.session) {
            deleteSession(cookies.session);
        }
        
        res.writeHead(302, {
            'Location': '/verify',
            'Set-Cookie': 'session=; Max-Age=0; Path=/'
        });
        res.end();
        return;
    }

    // Health check endpoints for UptimeRobot
    if (parsedUrl.pathname === "/health" || parsedUrl.pathname === "/ping" || parsedUrl.pathname === "/") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            status: "online",
            uptime: process.uptime(),
            timestamp: Date.now(),
            bot: client.user ? client.user.tag : "connecting...",
            sessions: activeSessions.size,
            verifiedUsers: Object.keys(loadVerifiedUsers()).length
        }));
        return;
    }

    // Default fallback
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Bot is running\n");
});
server.listen(PORT, () => {
    console.log(`[system] health check: [ port ${PORT} ]`);
    
    // Log environment detection for debugging
    if (process.env.RAILWAY_PUBLIC_DOMAIN) {
        console.log(`[system] Railway detected: ${process.env.RAILWAY_PUBLIC_DOMAIN}`);
        console.log(`[system] Verification URL: https://${process.env.RAILWAY_PUBLIC_DOMAIN}/verify`);
        console.log(`[system] Health endpoint: https://${process.env.RAILWAY_PUBLIC_DOMAIN}/health`);
    } else if (process.env.RENDER_EXTERNAL_URL) {
        console.log(`[system] Render detected: ${process.env.RENDER_EXTERNAL_URL}`);
        console.log(`[system] Verification URL: ${process.env.RENDER_EXTERNAL_URL}/verify`);
        console.log(`[system] Health endpoint: ${process.env.RENDER_EXTERNAL_URL}/health`);
    } else if (process.env.REPLIT_DEV_DOMAIN) {
        console.log(`[system] Replit detected: ${process.env.REPLIT_DEV_DOMAIN}`);
        console.log(`[system] Verification URL: https://${process.env.REPLIT_DEV_DOMAIN}/verify`);
    } else if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
        console.log(`[system] Replit detected: ${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`);
        console.log(`[system] Verification URL: https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/verify`);
    } else {
        console.log(`[system] Local environment detected`);
        console.log(`[system] Verification URL: http://localhost:${PORT}/verify`);
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
                    if (worker.connected) {
                        worker.send({
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
                    }
                });

                remoteSwarms.forEach((swarm) => {
                    swarm.send(["A", ...data]);
                });
            }
        } catch (e) {}
    });
});

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID || "1521765557064695858";

const PROXIES = ["http://spjkufyo3c:bc9QQa_elQYmp63qg5@dc.decodo.com:10000"];
const COOLDOWN_FILE = path.join(__dirname, "cooldowns.json");
const VERIFIED_FILE = path.join(__dirname, "verified.txt");
const VERIFIED_USERS_FILE = path.join(__dirname, "verified_users.json");
const COMMAND_STATS_FILE = path.join(__dirname, "command_stats.json");

let farmQueue = [];
let isProcessingQueue = false;

// Verification system
const verificationCodes = new Map(); // Map<code, { userId, username, timestamp }>
const activeSessions = new Map(); // Map<sessionToken, { userId, username, expiresAt }>

// Session management
function generateSessionToken() {
    return require('crypto').randomBytes(32).toString('hex');
}

function createSession(userId, username) {
    const token = generateSessionToken();
    const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
    activeSessions.set(token, { userId, username, expiresAt });
    return token;
}

function validateSession(token) {
    if (!token) return null;
    const session = activeSessions.get(token);
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
        activeSessions.delete(token);
        return null;
    }
    return session;
}

function deleteSession(token) {
    activeSessions.delete(token);
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
        showInLeaderboard: showInLeaderboard !== null ? showInLeaderboard : (users[userId]?.showInLeaderboard ?? null),
        totalBots: users[userId]?.totalBots || 0,
        lastActive: Date.now()
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
        .setDescription("spawn 90 bots and move them to specific coordinates")
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
            "spawn 30 bots with premium mouse-following capabilities",
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
        const commandNames = commands.map(cmd => cmd.name);
        console.log("[system] commands to register:", commandNames);
        
        // First, try to get existing commands to debug
        try {
            const existingCommands = await rest.get(Routes.applicationCommands(CLIENT_ID));
            console.log("[system] existing commands:", existingCommands.map(c => c.name));
        } catch (e) {
            console.log("[system] couldn't fetch existing commands:", e.message);
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
            console.log(`[system] registering commands to guild ${TEST_GUILD_ID} for instant updates...`);
            await rest.put(
                Routes.applicationGuildCommands(CLIENT_ID, TEST_GUILD_ID),
                { body: commands }
            );
            console.log("[system] guild commands registered successfully (instant)");
        } catch (error) {
            console.error("[system] guild command registration failed:", error.message);
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

    // CRITICAL: Only allow user 1289669511280066673 to use ANY slash command
    const AUTHORIZED_USER_ID = "1289669511280066673";
    if (interaction.user.id !== AUTHORIZED_USER_ID) {
        return await interaction.reply({
            content: "```\nerror: [ access denied ]\nreason: [ unauthorized user ]\n```",
            ephemeral: true,
        });
    }

    // Check if user is verified (except for /verify command itself)
    if (interaction.commandName !== "verify" && !isUserVerified(interaction.user.id)) {
        return await interaction.reply({
            content: "```\nerror: [ verification required ]\nreason: [ use /verify to verify your account ]\n```",
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
            .setColor(0x2ecc71)
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
            .setFooter({ text: "Code expires in 10 minutes • After verification, access your dashboard" })
            .setTimestamp();

        return await interaction.reply({ embeds: [verifyEmbed], ephemeral: true });
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

        return await interaction.reply({ embeds: [dashboardEmbed], ephemeral: true });
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
        const isBypassUser = userId === "1289669511280066673";

        if (isFarm && !isBypassUser) {
            const cooldowns = loadCooldowns();
            const now = Date.now();
            const cooldownDuration = 3 * 60 * 1000; // 3 minutes

            if (cooldowns[userId] && now < cooldowns[userId]) {
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
                    .setFooter({ text: "free farm: discord.gg/fQFTCMC5hY" })
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
                ? interaction.options.getInteger("amount") || 30
                : 30;

        // Track bot spawns for statistics
        if (isFarm) {
            incrementBotCount(userId, amount);
        }

        let premiumKey = null;
        if (interaction.commandName === "premium-farm") {
            premiumKey = getKeyForUser(userId);
            if (!premiumKey) {
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

        const initialHash = hashInput.startsWith("#")
            ? hashInput
            : "#" + hashInput;
        const squadId = initialHash.slice(1);

        if (isFarm) {
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
                    .setColor(0x2ecc71)
                    .setTitle("system: queued")
                    .setDescription(
                        "```\nstatus: [ in queue ]\nposition: [ " +
                            (farmQueue.length - 1) +
                            " ]\nnotice: [ starting soon ]\n```",
                    )
                    .setFooter({ text: "want more bots? dm h1" })
                    .setTimestamp();

                await interaction.reply({ embeds: [queueEmbed] });
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
        .setColor(0x2ecc71)
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
            try {
                w.kill();
            } catch (e) {}
        });

        const uniqueLinks = Array.from(botLinks);
        const resultEmbed = new EmbedBuilder()
            .setColor(uniqueLinks.length >= targetTeams ? 0x2ecc71 : 0xff0000)
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
            .setColor(0x2ecc71)
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
        const worker = fork("index2.js", [], { silent: true });
        activeWorkers.push(worker);

        worker.on("message", (msg) => {
            if (msg.type === "connected" || msg.type === "hash_update") {
                const link = `https://arras.io/${msg.hash}`;
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

        worker.send({
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
    const totalExpectedBots = isPremium
        ? localAmount + amount * remoteSwarms.length
        : localAmount;

    const terminateRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`terminate_${interaction.user.id}`)
            .setLabel("Terminate Swarm")
            .setStyle(ButtonStyle.Danger),
    );

    const waitEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
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

    if (interaction.replied)
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
    botLinks.set("remote", `https://arras.io/${initialHash}`);
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
                .setColor(0x2ecc71)
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
                try {
                    if (w.connected) {
                        w.send({ type: "destroy" });
                        setTimeout(() => {
                            if (w.connected) w.kill("SIGKILL");
                        }, 100);
                    }
                } catch (e) {}
            });

            remoteSwarms.forEach((swarm) => {
                swarm.send(["B"]);
            });

            farmQueue.shift();
            processQueue();
        };

        if (immediate) {
            cleanup();
        } else {
            disconnectTimeout = setTimeout(cleanup, 60000);
        }

        const uniqueLinks = Array.from(new Set(botLinks.values()));
        const resultEmbed = new EmbedBuilder()
            .setColor(uniqueLinks.length > 0 ? 0x2ecc71 : 0xff0000)
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
        remoteSwarms.forEach((swarm) => {
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
            const worker = fork("index2.js", [], { silent: true });
            activeWorkers.push(worker);

            worker.on("message", (msg) => {
                if (msg.type === "connected" || msg.type === "hash_update") {
                    botLinks.set(i, `https://arras.io/${msg.hash}`);
                    if (msg.hash.length > initialHash.length) {
                        if (!botsDone.has(i)) {
                            botsDone.add(i);
                            updateProgress();
                        }
                        worker.send({
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

            worker.send({
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
        const remoteTotal = amount * remoteSwarms.length;
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
