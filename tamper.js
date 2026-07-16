// ==UserScript==
// @name         xd
// @namespace    http://tampermonkey.net/
// @version      v0.3
// @description  Premium Arras.io Bot Controller
// @author       Antigravity
// @match        *://arras.io/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=arras.io
// @require      https://cdnjs.cloudflare.com/ajax/libs/msgpack-lite/0.1.26/msgpack.min.js
// @grant        none
// ==/UserScript==

/* global msgpack */

(function () {
    'use strict';

    // Premium UI Styles
    const style = document.createElement('style');
    style.innerHTML = `
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');

        :root {
            --primary: #00f5a0;
            --primary-glow: rgba(0, 245, 160, 0.4);
            --bg-glass: rgba(10, 15, 25, 0.8);
            --bg-card: rgba(255, 255, 255, 0.04);
            --bg-card-hover: rgba(255, 255, 255, 0.08);
            --text-main: #ffffff;
            --text-dim: #a0a0b0;
            --border: rgba(255, 255, 255, 0.1);
            --font: 'Outfit', sans-serif;
            --radius: 24px;
        }

        #scriptMenu {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 880px;
            background: #1a1a1a;
            border: 2px solid #000;
            border-radius: 4px;
            color: #fff;
            font-family: 'Outfit', sans-serif;
            z-index: 9999999;
            display: flex;
            flex-direction: column;
            box-shadow: 0 0 50px rgba(0,0,0,0.8);
            animation: fadeIn 0.2s ease-out;
            user-select: none;
            overflow: hidden;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translate(-50%, -49%) scale(0.98); }
            to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }

        .header-minimal {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            background: #111;
            border-bottom: 1px solid #333;
            gap: 10px;
        }

        .title-minimal {
            font-size: 10px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #666;
            white-space: nowrap;
        }

        .hub-trigger-btn {
            background: #222;
            color: var(--primary);
            border: 1px solid #333;
            font-size: 10px;
            font-weight: 700;
            padding: 4px 8px;
            border-radius: 4px;
            cursor: pointer;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            transition: 0.2s;
        }
        .hub-trigger-btn:hover {
            background: var(--primary);
            color: #000;
        }

        /* Status Modal Styles */
        #hubModal {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 500px;
            background: #151515;
            border: 2px solid #333;
            border-radius: 8px;
            color: #fff;
            font-family: 'Outfit', sans-serif;
            z-index: 10000000;
            display: none;
            flex-direction: column;
            box-shadow: 0 0 40px rgba(0,0,0,0.9);
            padding: 16px;
        }
        .hub-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #333;
            padding-bottom: 8px;
            margin-bottom: 12px;
        }
        .hub-modal-title {
            font-size: 14px;
            font-weight: 700;
            text-transform: uppercase;
            color: var(--primary);
        }
        .hub-close {
            cursor: pointer;
            color: var(--text-dim);
            font-size: 16px;
        }
        .hub-close:hover { color: #fff; }

        .modal-scroll-area {
            max-height: 300px;
            overflow-y: auto;
            margin-bottom: 12px;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .status-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: rgba(255,255,255,0.02);
            padding: 8px 12px;
            border-radius: 6px;
            border: 1px solid rgba(255,255,255,0.05);
        }
        .status-row-info {
            display: flex;
            flex-direction: column;
            gap: 2px;
            max-width: 70%;
        }
        .status-row-label {
            font-size: 12px;
            font-weight: 700;
        }
        .status-row-url {
            font-size: 10px;
            color: var(--text-dim);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .status-tag {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 9px;
            font-weight: 800;
            color: #ff4b2b;
            text-transform: uppercase;
            padding: 4px 8px;
            background: rgba(255, 75, 43, 0.05);
            border: 1px solid rgba(255, 75, 43, 0.15);
            border-radius: 4px;
            white-space: nowrap;
        }
        .status-tag.connected {
            color: var(--primary);
            background: rgba(0, 245, 160, 0.05);
            border-color: rgba(0, 245, 160, 0.15);
        }
        .status-tag::before {
            content: '';
            width: 4px;
            height: 4px;
            background: currentColor;
            border-radius: 50%;
            box-shadow: 0 0 5px currentColor;
        }

        .hub-add-form {
            display: grid;
            grid-template-columns: 80px 1fr 50px;
            gap: 8px;
            border-top: 1px solid #333;
            padding-top: 12px;
        }
        .hub-add-form input {
            background: #222 !important;
            border: 1px solid #444 !important;
            border-radius: 6px !important;
            padding: 8px 12px !important;
            font-size: 12px !important;
        }
        .hub-add-btn {
            background: var(--primary);
            color: #000;
            font-weight: 700;
            font-size: 12px;
            border-radius: 6px;
            cursor: pointer;
            border: none;
        }

        .tab-btn {
            flex: 1;
            padding: 10px;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 700;
            color: var(--text-dim);
            cursor: pointer;
            text-align: center;
            transition: 0.2s;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .tab-btn.active {
            background: var(--bg-card-hover);
            color: var(--primary);
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }

        .dashboard {
            display: flex;
            flex-direction: column;
            gap: 24px;
            padding: 24px;
            min-height: 420px;
            max-height: 60vh;
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: var(--primary) transparent;
        }

        .tab-content { display: none; flex-direction: column; gap: 24px; }
        .tab-content.active { display: flex; }

        .section-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 4px;
        }

        .section-header svg { width: 18px; height: 18px; color: var(--primary); }
        .section-header span { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #fff; }

        .section {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .section-label {
            font-size: 12px;
            font-weight: 700;
            color: var(--text-dim);
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        /* Improved Grid & Toggles */
        .toggle-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
        }

        .toggle-item {
            position: relative;
            cursor: pointer;
        }

        .toggle-item input {
            display: none;
        }

        .toggle-box {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: all 0.2s ease;
        }

        .toggle-item:hover .toggle-box {
            background: var(--bg-card-hover);
            border-color: rgba(255, 255, 255, 0.2);
            transform: translateY(-2px);
        }

        .toggle-name {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-main);
        }

        .switch-ui {
            width: 36px;
            height: 20px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            position: relative;
            transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .switch-ui::after {
            content: '';
            position: absolute;
            width: 14px;
            height: 14px;
            background: white;
            border-radius: 50%;
            top: 3px;
            left: 3px;
            transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .toggle-item input:checked + .toggle-box {
            background: rgba(0, 245, 160, 0.05);
            border-color: rgba(0, 245, 160, 0.3);
        }

        .toggle-item input:checked + .toggle-box .switch-ui {
            background: var(--primary);
            box-shadow: 0 0 15px var(--primary-glow);
        }

        .toggle-item input:checked + .toggle-box .switch-ui::after {
            left: 19px;
        }

        /* Inputs */
        input[type="text"], input[type="number"] {
            width: 100%;
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 14px 18px;
            color: white;
            font-family: var(--font);
            font-size: 15px;
            outline: none;
            transition: 0.2s;
            box-sizing: border-box;
        }

        input:focus {
            border-color: var(--primary);
            background: var(--bg-card-hover);
            box-shadow: 0 0 20px rgba(0, 245, 160, 0.1);
        }

        /* Select */
        .select-container { position: relative; }
        .select-head {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 14px 18px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            transition: 0.2s;
        }
        .select-head:hover { background: var(--bg-card-hover); }
        .select-head.active { border-color: var(--primary); }

        .dropdown {
            position: absolute;
            top: calc(100% + 8px);
            left: 0; right: 0;
            background: #0d1117;
            border: 1px solid var(--border);
            border-radius: 16px;
            max-height: 280px;
            overflow-y: auto;
            z-index: 1000;
            display: none;
            box-shadow: 0 20px 50px rgba(0,0,0,0.6);
        }
        .dropdown.show { display: block; }
        .drop-group { padding: 12px 18px; font-size: 10px; font-weight: 800; color: var(--primary); text-transform: uppercase; letter-spacing: 1px; background: rgba(0, 245, 160, 0.05); }
        .drop-item { padding: 12px 18px; font-size: 14px; color: var(--text-dim); cursor: pointer; transition: 0.2s; }
        .drop-item:hover { color: white; background: var(--bg-card-hover); padding-left: 24px; }
        .drop-item.selected { color: white; background: var(--primary); font-weight: 600; }

        /* Slider */
        .slider-box {
            background: var(--bg-card);
            border-radius: 16px;
            padding: 20px;
            border: 1px solid var(--border);
        }
        .slider-labels { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 13px; font-weight: 600; }

        input[type="range"] {
            -webkit-appearance: none;
            width: 100%;
            height: 4px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 2px;
            outline: none;
        }
        input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 18px;
            height: 18px;
            background: var(--primary);
            border-radius: 50%;
            cursor: pointer;
            box-shadow: 0 0 10px var(--primary-glow);
        }

        /* Buttons */
        .btn-group { display: grid; grid-template-columns: 2fr 1fr; gap: 12px; }
        button {
            padding: 16px;
            border-radius: 16px;
            border: none;
            font-family: var(--font);
            font-size: 15px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }

        #connectNoob { background: var(--primary); color: #050505; }
        #connectNoob:hover { transform: translateY(-2px); box-shadow: 0 8px 25px var(--primary-glow); }

        #reconnectServer { background: var(--bg-card); color: white; border: 1px solid var(--border); }
        #reconnectServer:hover { background: var(--bg-card-hover); }

        #deleteNoobs { background: rgba(255, 75, 43, 0.1); color: #ff4b2b; border: 1px solid rgba(255, 75, 43, 0.2); width: 100%; }
        #deleteNoobs:hover { background: #ff4b2b; color: white; }

        /* Tabs */
        .tab-bar {
            display: flex;
            gap: 8px;
            background: rgba(255, 255, 255, 0.03);
            padding: 4px;
            border-radius: 14px;
            border: 1px solid var(--border);
        }
        .tab-btn {
            flex: 1;
            padding: 10px;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 600;
            color: var(--text-dim);
            cursor: pointer;
            text-align: center;
            transition: 0.2s;
        }
        .tab-btn.active {
            background: var(--bg-card-hover);
            color: var(--primary);
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        }
        .tab-content { display: none; flex-direction: column; gap: 24px; }
        .tab-content.active { display: flex; }

        .chat-input-wrapper {
            position: relative;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        #broadcastBtn {
            background: linear-gradient(135deg, var(--primary) 0%, #00d2ff 100%);
            color: #050505;
            width: 100%;
        }

        .footer { text-align: center; font-size: 10px; color: #555; padding: 12px; border-top: 1px solid #222; background: #111; }
    `;
    document.head.appendChild(style);

    const menu = document.createElement('div');
    menu.id = 'scriptMenu';
    menu.style.display = 'none';
    menu.innerHTML = `
        <div class="header-minimal">
            <span class="title-minimal">Noob Hub</span>
            <button class="hub-trigger-btn" id="openHubBtn">Connections Hub</button>
        </div>

        <div class="tab-bar">
            <div class="tab-btn active" data-tab="main">Main Dashboard</div>
            <div class="tab-btn" data-tab="macros">Macros</div>
        </div>

        <div class="dashboard">
            <div id="mainTab" class="tab-content active">
                <div class="control-section">
                    <div class="section-header">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l-2 2-3-3-2 2L2 16l2-2-3-3 2-2 3 3 2-2 2 2z"/></svg>
                        <span>Combat Systems</span>
                    </div>
                    <div class="toggle-grid">
                        <label class="toggle-item">
                            <input id="autofire" type="checkbox">
                            <div class="toggle-box">
                                <span class="toggle-name">Autofire</span>
                                <div class="switch-ui"></div>
                            </div>
                        </label>
                        <label class="toggle-item">
                            <input id="autospin" type="checkbox">
                            <div class="toggle-box">
                                <span class="toggle-name">Auto Spin</span>
                                <div class="switch-ui"></div>
                            </div>
                        </label>
                    </div>
                    <div class="slider-box">
                        <div class="slider-labels">
                            <span>Aim Smoothing</span>
                            <span style="color:var(--primary);"><span id="sensitivityValue">20</span>%</span>
                        </div>
                        <input id="mouseSensitivity" type="range" min="1" max="100" step="1" value="20">
                    </div>
                </div>

                <div class="control-section">
                    <div class="section-header">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4M8 15h.01M16 15h.01"/></svg>
                        <span>Swarm Intelligence</span>
                    </div>
                    <div class="toggle-grid">
                        <label class="toggle-item">
                            <input id="mbs" type="checkbox" checked>
                            <div class="toggle-box">
                                <span class="toggle-name">Follow Mouse</span>
                                <div class="switch-ui"></div>
                            </div>
                        </label>
                        <label class="toggle-item">
                            <input id="feeding" type="checkbox">
                            <div class="toggle-box">
                                <span class="toggle-name">Auto Feed</span>
                                <div class="switch-ui"></div>
                            </div>
                        </label>
                    </div>
                    <div class="toggle-grid">
                        <label class="toggle-item" style="grid-column: span 2;">
                            <input id="manualMode" type="checkbox">
                            <div class="toggle-box">
                                <span class="toggle-name">Manual Coordinates Mode</span>
                                <div class="switch-ui"></div>
                            </div>
                        </label>
                    </div>
                    <div id="manualCoordsSection" style="display: none; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div class="section-label" style="grid-column: span 2;">Target Coordinates (X, Y)</div>
                        <input id="manualX" type="number" placeholder="X Coord" value="0">
                        <input id="manualY" type="number" placeholder="Y Coord" value="0">
                        <button id="copyCoords" style="grid-column: span 2; padding: 8px; background: #333; color: #fff; border: 1px solid #444; border-radius: 4px; cursor: pointer; font-size: 12px;">Copy My Coordinates</button>
                    </div>
                    <div class="select-container" id="tankContainer">
                        <div class="select-head" id="tankTrigger">
                            <span id="selectedTankDisplay">Select Tank Class</span>
                            <input type="text" id="tankSearchInput" placeholder="Search..." style="display:none; width:100%; background:transparent; border:none; color:white; outline:none;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6"/></svg>
                        </div>
                        <div class="dropdown" id="tankOptionsList"></div>
                    </div>
                </div>

                <div class="control-section">
                    <div class="section-header">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
                        <span>Network Configuration</span>
                    </div>
                    <div style="display:flex; flex-direction:column; gap: 12px;">
                        <input id="serverHash" type="text" placeholder="Server Endpoint (Hash or URL)">
                        <input id="botName" type="text" placeholder="Bot Name (leave empty for default)">
                        <div style="display:flex; gap:12px; align-items:center;">
                            <span style="font-size:12px; color:var(--text-dim); white-space:nowrap;">Bot Density:</span>
                            <input id="botCount" type="number" value="1" min="1" max="100">
                        </div>
                        <div class="btn-group" style="grid-template-columns: 1fr 1fr;">
                            <button id="connectNoob">Deploy Swarm</button>
                            <button id="reconnectServer" style="background:#222; color:#fff;">Reset Sync</button>
                        </div>
                        <button id="changeAllNames" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; width: 100%;">Change All Bot Names</button>
                        <button id="deleteNoobs">Terminate All Connections</button>
                    </div>
                </div>
            </div>

            <div id="macrosTab" class="tab-content">
                <div class="control-section">
                    <div class="section-header">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17.5 19c2.5 0 4.5-2 4.5-4.5 0-2.4-1.9-4.3-4.3-4.5C16.9 6.4 13.7 4 10 4 6.7 4 4 6.3 3.1 9.4 1.3 10.3 0 12.2 0 14.5 0 17 2 19 4.5 19Z"/></svg>
                        <span>Transmission Hub</span>
                    </div>
                    <div class="chat-input-wrapper">
                        <input id="chatMessage" type="text" placeholder="Broadcast message...">
                        <label class="toggle-item">
                            <input id="repeatChat" type="checkbox">
                            <div class="toggle-box" style="padding: 12px 16px;">
                                <span class="toggle-name" style="font-size: 12px;">Continuous Loop (Spam)</span>
                                <div class="switch-ui" style="width: 32px; height: 18px;"></div>
                            </div>
                        </label>
                        <button id="broadcastBtn">Execute Transmission</button>
                    </div>
                    <div class="toggle-grid" style="grid-template-columns: repeat(4, 1fr); gap: 8px;">
                        <button class="phrase-btn" style="padding: 8px; font-size: 11px; background: #222; border: 1px solid #333;">GG</button>
                        <button class="phrase-btn" style="padding: 8px; font-size: 11px; background: #222; border: 1px solid #333;">EZ</button>
                        <button class="phrase-btn" style="padding: 8px; font-size: 11px; background: #222; border: 1px solid #333;">WP</button>
                        <button class="phrase-btn" style="padding: 8px; font-size: 11px; background: #222; border: 1px solid #333;">?</button>
                    </div>
                </div>
            </div>
        </div>

        <div class="footer">Premium Arras Swarm Controller • ESC to Toggle</div>
    `;

    document.body.appendChild(menu);

    // Create Connection Hub Pop-out Modal
    const hub_modal = document.createElement('div');
    hub_modal.id = 'hubModal';
    hub_modal.innerHTML = `
        <div class="hub-modal-header">
            <span class="hub-modal-title">Connections Hub</span>
            <span class="hub-close" id="closeHubBtn">✕</span>
        </div>
        <div class="modal-scroll-area" id="hubSocketsList"></div>
        <div class="hub-add-form">
            <input type="text" id="newSocketLabel" placeholder="Label (e.g. S4)">
            <input type="text" id="newSocketUrl" placeholder="wss://...">
            <button class="hub-add-btn" id="addSocketBtn">Add</button>
        </div>
    `;
    document.body.appendChild(hub_modal);

    const getEl = id => document.getElementById(id);
    const HTML = {
        reconnectServer: getEl("reconnectServer"),
        tankContainer: getEl("tankContainer"),
        tankTrigger: getEl("tankTrigger"),
        selectedTankDisplay: getEl("selectedTankDisplay"),
        tankSearchInput: getEl("tankSearchInput"),
        tankOptionsList: getEl("tankOptionsList"),
        serverHash: getEl("serverHash"),
        botName: getEl("botName"),
        botCount: getEl("botCount"),
        mbs: getEl("mbs"),
        feeding: getEl("feeding"),
        connectNoob: getEl("connectNoob"),
        changeAllNames: getEl("changeAllNames"),
        deleteNoobs: getEl("deleteNoobs"),
        autofire: getEl("autofire"),
        autospin: getEl("autospin"),
        manualMode: getEl("manualMode"),
        manualX: getEl("manualX"),
        manualY: getEl("manualY"),
        copyCoords: getEl("copyCoords"),
        manualCoordsSection: getEl("manualCoordsSection"),
        mouseSensitivity: getEl("mouseSensitivity"),
        sensitivityValue: getEl("sensitivityValue"),
        broadcastBtn: getEl("broadcastBtn"),
        chatMessage: getEl("chatMessage"),
        repeatChat: getEl("repeatChat"),
        openHubBtn: getEl("openHubBtn"),
        closeHubBtn: getEl("closeHubBtn"),
        hubSocketsList: getEl("hubSocketsList"),
        newSocketLabel: getEl("newSocketLabel"),
        newSocketUrl: getEl("newSocketUrl"),
        addSocketBtn: getEl("addSocketBtn"),
        tabs: {
            main: getEl("mainTab"),
            macros: getEl("macrosTab")
        }
    };

    // Connections Registry State
    let active_connections = [];

    // Default system endpoints
    const system_endpoints = [
        { label: "L", url: "ws://localhost:8082" },
        { label: "C", url: "wss://cac5e4d0-006a-4557-b112-eb6de85e82d7-00-bifncumb1ojb.sisko.replit.dev/" },
        { label: "R", url: "wss://8af115fb-6ab7-4e3f-b37e-69f1affb3deb-00-1qkywmvhp9pfa.spock.replit.dev:3000/" },
        { label: "S", url: "wss://cfaa8f0f-5f0a-4850-882f-b3d5a4e29355-00-1eads13ku4pnt.sisko.replit.dev/" },
        { label: "S2", url: "wss://3762fe0c-0de1-4c32-9ade-d21a25ee2593-00-28ajclva72pip.sisko.replit.dev/" },
        { label: "S3", url: "wss://9b01dc53-24bc-468f-ad33-0d88805a9ac9-00-35ri8ttiz064v.sisko.replit.dev:3000/" },
        { label: "CSB", url: "wss://e6f6a89a-bfc1-4c89-adaf-3ff604642cfc-00-1os45ewcx2hko.worf.replit.dev:8080/" },
        { label: "GHV", url: "wss://organic-meme-qwwjgv5j74j2p54-8082.app.github.dev/" },
        { label: "RKR", url: "wss://9d641725-2fb8-4669-b103-a4fc9ba81dba-00-3aijjjpnuqi4u.riker.replit.dev:3000/" },
        { label: "SPK", url: "wss://454e6990-ef45-4c6b-b185-4977b214a196-00-1o4pb4sxbj2kp.spock.replit.dev/" },
        { label: "WRF", url: "wss://e6f6a89a-bfc1-4c89-adaf-3ff604642cfc-00-1os45ewcx2hko.worf.replit.dev/" },
        { label: "RK2", url: "wss://903ab248-4ccc-4079-a1a7-f17b13fbf341-00-9xyxq9t2goqe.riker.replit.dev/" },
        { label: "PCD", url: "wss://86cb24c2-c764-44dc-b027-b31877e8c732-00-2buvy4dg6lpy1.picard.replit.dev/" },
        { label: "SP2", url: "wss://8af115fb-6ab7-4e3f-b37e-69f1affb3deb-00-1qkywmvhp9pfa.spock.replit.dev:3000/" },
        { label: "SP3", url: "wss://b1a35fae-2c91-43bd-a5b0-13733adfb8e0-00-ahmpcgkh44r6.janeway.replit.dev/" },
        { label: "SP4", url: "wss://5582c498-a666-4251-b15c-238d159536ac-00-3d6pm9pmq15qd.riker.replit.dev/" },
        { label: "SP5", url: "wss://2edfcad8-20f0-4ead-86f2-7055a00b3cbb-00-c7r1qimvetxx.riker.replit.dev/" },
    ];

    // Pop-out Modal Toggle Operations
    HTML.openHubBtn.onclick = (e) => {
        e.stopPropagation();
        hub_modal.style.display = hub_modal.style.display === "flex" ? "none" : "flex";
        renderHubRows();
    };
    HTML.closeHubBtn.onclick = () => hub_modal.style.display = "none";

    // Tab Switching Logic
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const tabId = btn.dataset.tab;
            HTML.tabs[tabId].classList.add('active');
        };
    });

    // Chat Broadcast Logic
    HTML.broadcastBtn.onclick = () => {
        const msg = HTML.chatMessage.value.trim();
        const spam = HTML.repeatChat.checked;
        if (msg) {
            packet("T", msg, spam);
            if (!spam) HTML.chatMessage.value = "";
        } else if (!spam) {
            packet("T", "", false);
        }
    };

    HTML.chatMessage.onkeydown = (e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
            HTML.broadcastBtn.click();
        }
    };

    document.querySelectorAll('.phrase-btn').forEach(btn => {
        btn.onclick = () => {
            packet("T", btn.textContent, false);
        };
    });

    // Manual Coords Visibility
    HTML.manualMode.onchange = () => {
        HTML.manualCoordsSection.style.display = HTML.manualMode.checked ? "grid" : "none";
    };

    HTML.copyCoords.onclick = () => {
        if (x !== null && y !== null) {
            const coords = `${Math.round(x)}, ${Math.round(y)}`;
            navigator.clipboard.writeText(coords).then(() => {
                const originalText = HTML.copyCoords.textContent;
                HTML.copyCoords.textContent = "Copied!";
                HTML.copyCoords.style.background = "#28a745";
                setTimeout(() => {
                    HTML.copyCoords.textContent = originalText;
                    HTML.copyCoords.style.background = "#333";
                }, 1000);
            });
        } else {
            const originalText = HTML.copyCoords.textContent;
            HTML.copyCoords.textContent = "No Coords Found";
            HTML.copyCoords.style.background = "#dc3545";
            setTimeout(() => {
                HTML.copyCoords.textContent = originalText;
                HTML.copyCoords.style.background = "#333";
            }, 1000);
        }
    };

    const saveSettings = () => {
        const settings = {
            serverHash: HTML.serverHash.value,
            botName: HTML.botName.value,
            botCount: HTML.botCount.value,
            autofire: HTML.autofire.checked,
            autospin: HTML.autospin.checked,
            mbs: HTML.mbs.checked,
            feeding: HTML.feeding.checked,
            manualMode: HTML.manualMode.checked,
            manualX: HTML.manualX.value,
            manualY: HTML.manualY.value,
            mouseSensitivity: HTML.mouseSensitivity.value,
            chatMessage: HTML.chatMessage.value,
            repeatChat: HTML.repeatChat.checked,
            currentTank: currentTank,
            custom_endpoints: active_connections.filter(c => c.custom).map(c => ({ label: c.label, url: c.url }))
        };
        localStorage.setItem('noob_settings', JSON.stringify(settings));
    };

    const loadSettings = () => {
        const data = localStorage.getItem('noob_settings');
        let custom_saved = [];
        if (data) {
            try {
                const settings = JSON.parse(data);
                if (settings.serverHash !== undefined) HTML.serverHash.value = settings.serverHash;
                if (settings.botName !== undefined) HTML.botName.value = settings.botName;
                if (settings.botCount !== undefined) HTML.botCount.value = settings.botCount;
                if (settings.autofire !== undefined) HTML.autofire.checked = settings.autofire;
                if (settings.autospin !== undefined) HTML.autospin.checked = settings.autospin;
                if (settings.mbs !== undefined) HTML.mbs.checked = settings.mbs;
                if (settings.feeding !== undefined) HTML.feeding.checked = settings.feeding;
                if (settings.manualMode !== undefined) HTML.manualMode.checked = settings.manualMode;
                if (settings.manualX !== undefined) HTML.manualX.value = settings.manualX;
                if (settings.manualY !== undefined) HTML.manualY.value = settings.manualY;
                if (settings.mouseSensitivity !== undefined) {
                    HTML.mouseSensitivity.value = settings.mouseSensitivity;
                    HTML.sensitivityValue.textContent = settings.mouseSensitivity;
                }
                if (settings.chatMessage !== undefined) HTML.chatMessage.value = settings.chatMessage;
                if (settings.repeatChat !== undefined) HTML.repeatChat.checked = settings.repeatChat;
                if (settings.currentTank !== undefined) currentTank = settings.currentTank;
                if (settings.custom_endpoints !== undefined) custom_saved = settings.custom_endpoints;

                HTML.manualMode.onchange();
            } catch (e) { console.error("Failed to load settings", e); }
        }

        // Setup unified active connections tracking state
        system_endpoints.forEach(ep => {
            active_connections.push({ label: ep.label, url: ep.url, ws: null, status: "OFF", custom: false });
        });
        custom_saved.forEach(ep => {
            active_connections.push({ label: ep.label, url: ep.url, ws: null, status: "OFF", custom: true });
        });
    };

    // Dynamic Connections Hub UI Rendering
    function renderHubRows() {
        if (hub_modal.style.display !== "flex") return;
        HTML.hubSocketsList.innerHTML = "";
        active_connections.forEach(conn => {
            const row = document.createElement("div");
            row.className = "status-row";

            const is_ready = conn.status === "READY" || conn.status === "OK";
            row.innerHTML = `
                <div class="status-row-info">
                    <span class="status-row-label">${conn.label}</span>
                    <span class="status-row-url">${conn.url}</span>
                </div>
                <div class="status-tag ${is_ready ? 'connected' : ''}">
                    <span>${conn.label}: ${conn.status}</span>
                </div>
            `;
            HTML.hubSocketsList.appendChild(row);
        });
    }

    // Dynamic Socket Connection Engine
    function initConnection(conn) {
        if (conn.ws) return;

        try {
            const current_ws = new WebSocket(conn.url);
            conn.ws = current_ws;
            current_ws.binaryType = "arraybuffer";

            current_ws.onopen = () => {
                conn.status = "OK";
                renderHubRows();
                current_ws.send(msgpack.encode(["M", 72011]));
            };

            current_ws.onmessage = m => {
                const data = msgpack.decode(new Uint8Array(m.data));
                const type = data.shift();
                if (type == "M") {
                    current_ws.send(msgpack.encode(["C", data[0] ^ 845]));
                    conn.status = "READY";
                    renderHubRows();
                    selectTank();
                }
            };

            current_ws.onerror = () => {
                conn.status = "ERR";
                renderHubRows();
            };

            current_ws.onclose = () => {
                conn.status = "OFF";
                renderHubRows();
                conn.ws = null;
                // Reconnect automatically loop
                setTimeout(() => initConnection(conn), conn.custom ? 5000 : 3000);
            };
        } catch(e) {
            conn.status = "ERR";
            conn.ws = null;
            renderHubRows();
        }
    }

    // Interactive Custom Endpoint Setup Handler
    HTML.addSocketBtn.onclick = () => {
        const label_val = HTML.newSocketLabel.value.trim().toUpperCase();
        const url_val = HTML.newSocketUrl.value.trim();

        if (!label_val || !url_val) {
            alert("Please complete both parameters!");
            return;
        }

        const new_conn = { label: label_val, url: url_val, ws: null, status: "OFF", custom: true };
        active_connections.push(new_conn);
        saveSettings();
        renderHubRows();
        initConnection(new_conn);

        HTML.newSocketLabel.value = "";
        HTML.newSocketUrl.value = "";
    };


    // TANK DEFINITIONS
    const tankCategories = {
        "Essentials": {
            basic: "Basic", twin: "Twin", sniper: "Sniper", machinegun: "Machine Gun",
            flankguard: "Flank Guard", director: "Director", pounder: "Pounder",
            smasher: "Smasher", auto6: "Auto-4/6", mega3: "Mega-3", shotgun: "Shotgun", pursuer: "Pursuer"
        },
        "Advanced Tanks": {
            doubletwin: "Double Twin", tripleshot: "Triple Shot", sprayer: "Sprayer",
            redistributor: "Redistributor", hexatank: "Hexa Tank", octotank: "Octo Tank",
            booster: "Booster", fighter: "Fighter", tripletwin: "Triple Twin",
            overseer: "Overseer", underseer: "Underseer", manager: "Manager",
            destroyer: "Destroyer", anni: "Annihilator", rocketeer: "Rocketeer",
            gunner: "Gunner", auto3_single: { name: "Auto-3", tanks: "auto3" },
            auto4: "Auto-4", toppler: "Toppler", crack: "Crackshot", triplex: "Triplex",
            quadruplex: "Quadruplex", predator: "Predator", lorry: "Lorry", parapet: "Parapet"
        },
        "Arms Race / Special": {
            browser: "Browser", strider: "Strider", surfer: "Surfer", eagle: "Eagle",
            phoenix: "Phoenix", vulture: "Vulture", automingler: "Automingler",
            gale: "Gale", nona: "Nona", septamachine: "Septa Machine", jerker: "Jerker",
            limpet: "Limpet", firework: "Firework", coli: "Collision", levi: "Leviathan", rocket: "Rocket (ram)"
        },
        "Support & Utility": {
            engineer: "Engineer", assembler: "Assembler", architect: "Architect",
            factory: "Factory", spawner: "Spawner", foundry: "Foundry",
            topbanana: "Top Banana", healer: "Healer", physician: "Physician", chemist: "Chemist"
        },
        "Smashers & Rams": {
            megasmasher: "Mega Smasher", spike: "Spike", autosmasher: "Auto Smasher",
            landmine: "Landmine", thorn: "Thorn", megaspike: "Mega Spike", slammer: "Slammer", basher: "Basher"
        },
        "Branches": {
            triangle: { name: "Tri-Angle Path", tanks: ["fighter", "autotriangle", "surfer", "eagle", "bomber", "vulture", "phoenix"] },
            launchers: { name: "Launchers Path", tanks: ["skimmer", "twister", "swarmer", "sidewinder", "fieldgun"] },
            drones: { name: "Drones Path", tanks: ["overczar", "tyrant", "autooverlord", "megaautooverseer", "tripleautooverseer", "autooverdrive", "headman", "overcheese", "overstorm"] },
            auto3: { name: "Auto-3 Path", tanks: ["auto5", "mega3", "auto6"] },
            dps: { name: "DPS Path", tanks: ["penta", "spread", "octo", "autogunner", "triplet", "predator", "triplex", "quadruplex", "machinegunner"] },
            smashers_branch: { name: "Smashers Path", tanks: ["megasmasher", "spike", "autosmasher", "landmine"] }
        },
        "Arms Race Branches": {
            triangle_ar: { name: "Tri-Angle (AR)", tanks: ["browser", "strider", "autobomber", "tripleautotriangle", "surferdrive", "electrocutor", "kicker", "megaautotriangle", "roller", "autoeagle"] },
            launchers_ar: { name: "Launchers (AR)", tanks: ["hyperskimmer", "skidder", "gyro", "hypercluster", "coli", "molotov", "hypertwister", "ream"] },
            annies: { name: "Annihilators (AR)", tanks: ["obliterator", "compound", "wiper", "stomper", "autoanni", "shaver", "eradicator"] },
            necro: { name: "Underseer (AR)", tanks: ["diviner", "autonecro", "necrodrive", "megaautounderdrive", "tripleautounderdrive", "pentamancer", "pentadrive", "warlock", "autopentaseer"] },
            carriers: { name: "Carriers (AR)", tanks: ["warship", "battlerdrive", "bismarck", "proddrive", "manufacture", "dirigible", "autobattleship", "autoprod", "autocruiserdrive"] },
            auto3_ar: { name: "Auto-3 (AR)", tanks: ["auto6", "auto7", "mega5", "batter4", "hurler3", "autoauto4"] },
            dps_ar: { name: "DPS (AR)", tanks: ["toppler", "coli", "crack", "autooperator", "manufacture", "lorry"] },
            spikes_ar: { name: "Spikes (AR)", tanks: ["thorn", "megaspike", "claymore", "spear", "prick"] },
            crash: { name: "Crash (AR)", tanks: ["whirlwind", "tempest", "septamech", "doubleequalizer", "rigger", "lorry", "manufacture", "doublespread", "palisade"] }
        }
    };

    let currentTank = "basic";

    function populateTankOptions(filter = "") {
        const list = HTML.tankOptionsList;
        list.innerHTML = "";
        const query = filter.toLowerCase();

        for (const groupName in tankCategories) {
            const matches = [];
            for (const tankKey in tankCategories[groupName]) {
                const definition = tankCategories[groupName][tankKey];
                const tankName = typeof definition === "string" ? definition : definition.name;

                if (tankName.toLowerCase().includes(query)) {
                    matches.push({ key: tankKey, name: tankName });
                }
            }

            if (matches.length > 0) {
                const label = document.createElement("div");
                label.className = "drop-group";
                label.textContent = groupName;
                list.appendChild(label);

                matches.forEach(match => {
                    const item = document.createElement("div");
                    item.className = "drop-item" + (match.key === currentTank ? " selected" : "");
                    item.textContent = match.name;
                    item.onclick = (e) => {
                        e.stopPropagation();
                        selectTank(match.key, match.name);
                    };
                    list.appendChild(item);
                });
            }
        }
    }

    function selectTank(key, name) {
        if (key) currentTank = key;

        let definition;
        for (const group in tankCategories) {
            if (tankCategories[group][currentTank]) {
                definition = tankCategories[group][currentTank];
                break;
            }
        }

        if (definition) {
            const displayName = typeof definition === "string" ? definition : definition.name;
            if (HTML.selectedTankDisplay) HTML.selectedTankDisplay.textContent = displayName;
            packet("Z", definition.tanks || currentTank);
            saveSettings();
        }
        closeDropdown();
    }

    function toggleDropdown() {
        const isOpen = HTML.tankOptionsList.classList.contains("show");
        if (isOpen) closeDropdown();
        else openDropdown();
    }

    function openDropdown() {
        if (!HTML.tankOptionsList) return;
        HTML.tankOptionsList.classList.add("show");
        if (HTML.tankTrigger) HTML.tankTrigger.classList.add("active");
        if (HTML.selectedTankDisplay) HTML.selectedTankDisplay.style.display = "none";
        if (HTML.tankSearchInput) {
            HTML.tankSearchInput.style.display = "block";
            HTML.tankSearchInput.value = "";
            HTML.tankSearchInput.focus();
        }
        populateTankOptions();
    }

    function closeDropdown() {
        if (!HTML.tankOptionsList) return;
        HTML.tankOptionsList.classList.remove("show");
        if (HTML.tankTrigger) HTML.tankTrigger.classList.remove("active");
        if (HTML.selectedTankDisplay) HTML.selectedTankDisplay.style.display = "block";
        if (HTML.tankSearchInput) HTML.tankSearchInput.style.display = "none";
    }

    HTML.tankTrigger.onclick = (e) => {
        e.stopPropagation();
        toggleDropdown();
    };

    HTML.tankSearchInput.oninput = () => {
        populateTankOptions(HTML.tankSearchInput.value);
    };

    HTML.tankSearchInput.onkeydown = (e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
            e.preventDefault();
            const firstItem = HTML.tankOptionsList.querySelector(".drop-item");
            if (firstItem) {
                firstItem.click();
            }
        }
    };

    HTML.tankSearchInput.onclick = (e) => e.stopPropagation();

    window.addEventListener("click", (e) => {
        if (HTML.tankContainer && !HTML.tankContainer.contains(e.target)) {
            closeDropdown();
        }
    });

    // Initial load and connection loops ignition
    try {
        loadSettings();
        populateTankOptions();
        setTimeout(() => {
            selectTank(currentTank);
        }, 100);

        // Turn on connection infrastructure
        active_connections.forEach(conn => initConnection(conn));

        const inputElements = [HTML.serverHash, HTML.botName, HTML.botCount, HTML.manualX, HTML.manualY, HTML.mouseSensitivity, HTML.chatMessage];
        inputElements.forEach(el => {
            if (el) {
                el.addEventListener('input', () => {
                    if (el === HTML.mouseSensitivity && HTML.sensitivityValue) {
                        HTML.sensitivityValue.textContent = el.value;
                    }
                    saveSettings();
                });
            }
        });

        const toggleElements = [HTML.autofire, HTML.autospin, HTML.mbs, HTML.feeding, HTML.manualMode, HTML.repeatChat];
        toggleElements.forEach(el => {
            if (el) {
                el.addEventListener('change', saveSettings);
            }
        });
    } catch (e) {
        console.error("Initialization error:", e);
    }

    // KEYBOARD CONTROLS
    let keys = {};
    let menuVisible = false;
    document.addEventListener("keydown", e => {
        const code = e.code || "";
        if (keys[code]) return;
        keys[code] = true;
        if (e.key === "Escape" || e.keyCode === 27) {
            menuVisible = !menuVisible;
            if (menu) {
                menu.style.display = menuVisible ? "flex" : "none";
            }
            if (!menuVisible) hub_modal.style.display = "none";
            e.preventDefault();
            e.stopPropagation();
        }
    }, true);
    document.addEventListener("keyup", e => {
        const code = e.code || "";
        keys[code] = false;
    }, true);

    // MOUSE TRACKING
    let mouseX = 0, mouseY = 0, mouseDown = false, rMouseDown = false;
    window.addEventListener("mousedown", e => {
        if (e.button == 0) mouseDown = true;
        else if (e.button == 2) rMouseDown = true;
    });
    window.addEventListener("mouseup", e => {
        if (e.button == 0) mouseDown = false;
        else if (e.button == 2) rMouseDown = false;
    });
    window.addEventListener("mousemove", e => {
        mouseX = e.clientX - (window.innerWidth / 2);
        mouseY = e.clientY - (window.innerHeight / 2);
    });

    // Global Packet Broadcaster Engine
    function packet(...args) {
        const encoded_data = msgpack.encode(args);
        active_connections.forEach(conn => {
            if (conn.ws && conn.ws.readyState === WebSocket.OPEN) {
                conn.ws.send(encoded_data);
            }
        });
    }

    HTML.reconnectServer.addEventListener("click", () => {
        active_connections.forEach(conn => {
            if (conn.ws) {
                conn.status = "Reconnecting...";
                conn.ws.close();
            }
        });
        renderHubRows();
    });

    HTML.connectNoob.addEventListener("click", () => {
        let hash = HTML.serverHash.value.trim();
        if (hash) {
            if (hash.includes("#")) {
                hash = hash.split("#").pop();
            }
            hash = hash.trim().replace(/\/$/, "");
        } else {
            hash = window.location.hash.slice(1);
        }

        const count = parseInt(HTML.botCount.value) || 1;
        const botName = HTML.botName.value.trim() || "";
        
        if (!hash) {
            alert("Please paste a server hash or join a game first!");
            return;
        }

        packet("B");

        setTimeout(() => {
            packet("F", hash, count, botName);
        }, 100);
    });

    HTML.changeAllNames.addEventListener("click", () => {
        const newName = HTML.botName.value.trim();
        if (!newName) {
            alert("Please enter a name first!");
            return;
        }
        
        // Send name change command to server
        packet("N", newName);
        
        // Visual feedback
        const originalText = HTML.changeAllNames.textContent;
        const originalBg = HTML.changeAllNames.style.background;
        HTML.changeAllNames.textContent = "Names Changed!";
        HTML.changeAllNames.style.background = "#28a745";
        setTimeout(() => {
            HTML.changeAllNames.textContent = originalText;
            HTML.changeAllNames.style.background = originalBg;
        }, 1500);
    });

    HTML.deleteNoobs.addEventListener("click", () => { packet("B"); });

    // GAME COORDINATE INTERCEPTION
    let x = null, y = null, lastUpdate = 0;
    const oldStrokeText = CanvasRenderingContext2D.prototype.strokeText;
    CanvasRenderingContext2D.prototype.strokeText = function (text, ...args) {
        if (text.includes("Coordinates: (")) {
            const match = text.match(/Coordinates: \(([^)]+)\)/);
            if (match) {
                const parts = match[1].split(", ");
                x = parseFloat(parts[0]);
                y = parseFloat(parts[1]);
                lastUpdate = Date.now();
            }
        } else if (text.startsWith("You have been killed by") || text === "You have died a stupid death.") {
            x = y = null;
        }
        return oldStrokeText.call(this, text, ...args);
    };

    // BOT HEARTBEAT TICK
    setInterval(() => {
        const divisor = parseFloat(HTML.mouseSensitivity.value) || 20;

        packet("A",
            x, y,
            mouseX / divisor,
            mouseY / divisor,
            mouseDown, rMouseDown,
            HTML.mbs.checked,
            HTML.feeding.checked,
            keys["ShiftLeft"],
            HTML.autofire.checked,
            HTML.autospin.checked,
            HTML.manualMode.checked,
            parseFloat(HTML.manualX.value) || 0,
            parseFloat(HTML.manualY.value) || 0
        );
    }, 80);

})();