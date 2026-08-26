require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const Token = process.env.DISCORD_TOKEN || "MTUzOTAzMzkyMDQyNTY5NzQzMg.Ge4Cqv.1lNoaSFQuvYIzJY6MCoQOvzA71NUDcX8q9B1hc";
const GeminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
const Model = "gemini-2.5-flash-lite";
const ApiBase = "https://generativelanguage.googleapis.com/v1beta/models";

const SystemPrompt = `You are the HARRAS support bot. HARRAS is a private arras.io bot-farm toolkit sold to a few friends. Answer ONLY questions about HARRAS using the knowledge base below. If asked anything unrelated, briefly refuse and steer back. Be short, casual, helpful. Never invent features.

=== KNOWLEDGE BASE ===

WHAT IT IS
- arras.io multi-bot controller. Two modes: headless ('run me.bat', heavier DOM-based workers) and farm/websocket ('run ws.bat', light pure-protocol bots ~10-20MB each). Windows/macOS/Linux releases exist.

FIRST RUN (WINDOWS)
1. Unzip windows-release, install Node.js 24.x ONLY (bytecode .jsc is locked to Node 24; other versions crash).
2. Run detector.exe -> tells you if your PC supports the local IP rotator (needs native ISP IPv6 with a global /64 subnet).
3. Run launcher.exe -> enter your license key -> pick proxy (1 = local ISP rotator, 2 = your own datacentre/residential proxy URL http://...) -> pick mode (1 headless, 2 farm).
4. Install tampermonkey.user.js as a Tampermonkey userscript, open arras.io, it auto-connects to localhost:8082. Press F in the panel to spawn bots, B to kill all.

FIRST RUN (MAC/LINUX)
1. Node.js 24.x required too.
2. cd into folder, then: chmod +x launcher bin/run*.sh bin/iprotator-*
3. macOS only, clear Gatekeeper once: xattr -cr bin/iprotator-mac-arm64 (or -amd64, and xattr -cr launcher)
4. IMPORTANT: node_modules is NOT included to keep the zip small -> cd bin && npm install   (skip on Windows release, it ships with node_modules)
5. ./launcher (mac asks admin password via popup for the rotator; linux uses pkexec/sudo)
6. Same Tampermonkey step as Windows.

LICENSE KEYS
- Keys come from us. Each key works 5 hours from the moment WE create it.
- A key permanently binds to the FIRST machine that uses it (HWID lock). 'key is bound to another machine' means exactly that - we must reset it.
- 'key expired' = 5h window over, ask for a fresh one.
- Enter the key when the rotator window asks, BEFORE any admin prompt.

IPV6 / ROTATOR
- The built-in rotator claims ~100 free IPv6 addresses from YOUR OWN internet's /64 block and rotates them per bot connection. Free, residential IPs, resets on reboot.
- No native IPv6 /64? (common on laptop hotspots, CGNAT, some ISPs): detector.exe will say NOT SUPPORTED. On Windows press Y when offered so it tries enabling IPv6 locally. If still unsupported -> use proxy option 2 in the launcher (any http proxy URL you own) or option 3 no-proxy. Bots work fine either way, just share one IP.

CONTROLLER / USAGE
- The browser userscript panel spawns/kills bots and streams your position so bots follow you.
- Farm mode also has a cursor bridge (port 3456) and an invisible 'eye' bot that locks onto YOUR in-game name so bots follow your real tank even if your HUD lies. Set your exact in-game name in bin/config.json ("username") before spawning.
- Party links: both normal #ea-style codes and the new long 64-char links work; long links resolve automatically on first join then get cached.
- Dead WS bots respawn after 3 seconds. There is no movement jitter anymore, bots beeline exactly to the target.

COMMON ERRORS
- 'Cannot find module ws' -> you skipped npm install inside bin (mac/linux only).
- bytenode / NODE_MODULE_VERSION mismatch -> wrong Node version, install 24.x.
- 'FATAL: no global IPv6 /64 connection found' -> see IPV6 section above.
- Nothing connects -> make sure the rotator window stays open the whole session.
- IDA/x64dbg warning on iprotator.exe -> expected, it is obfuscated on purpose; do not open release binaries in analysis tools, the watchdog kills the session.
=====================`;

const History = new Map();

function KeywordFallback(Question) {
  const Q = Question.toLowerCase();
  const Checks = [
    [["node"], "Install Node.js **24.x** from nodejs.org - bytecode is locked to 24."],
    [["expired", "key"], "Keys last 5h from creation and bind to your first machine. Ask us for a fresh one."],
    [["bound"], "The key locked to its first machine. We can reset it on our side."],
    [["ipv6", "/64", "not supported", "detector"], "Run detector.exe. If NOT SUPPORTED after pressing Y, use proxy option 2 in the launcher."],
    [["module", "npm"], "cd bin && npm install (needed on mac/linux; windows ships node_modules)."],
  ];
  for (const [Words, Answer] of Checks) {
    if (Words.some(W => Q.includes(W))) return Answer;
  }
  return null;
}

async function AskGemini(Question, ChannelId) {
  if (!GeminiKey) throw new Error("GEMINI_API_KEY not set");
  let Messages = History.get(ChannelId);
  if (!Messages) { Messages = []; History.set(ChannelId, Messages); }
  Messages.push({ role: "user", parts: [{ text: Question }] });
  if (Messages.length > 12) Messages.splice(0, 2);
  const Body = {
    systemInstruction: { parts: [{ text: SystemPrompt }] },
    contents: Messages,
    generationConfig: { temperature: 0.4, maxOutputTokens: 700, thinkingConfig: { thinkingBudget: 0 } },
  };
  const IsAq = GeminiKey.startsWith("AQ.");
  const Url = IsAq ? `${ApiBase}/${Model}:generateContent` : `${ApiBase}/${Model}:generateContent?key=${GeminiKey}`;
  const Headers = IsAq ? { "Content-Type": "application/json", "Authorization": `Bearer ${GeminiKey}` } : { "Content-Type": "application/json" };
  const Res = await fetch(Url, { method: "POST", headers: Headers, body: JSON.stringify(Body) });
  const Data = await Res.json();
  if (!Res.ok) throw new Error(`${Res.status}: ${JSON.stringify(Data).slice(0, 300)}`);
  const Text = Data.candidates[0].content.parts[0].text;
  Messages.push({ role: "model", parts: [{ text: Text }] });
  return Text;
}

const Intents = GatewayIntentBits;
const Bot = new Client({ intents: [Intents.Guilds, Intents.GuildMessages, Intents.MessageContent] });

Bot.once("ready", () => {
  console.log(`[+] harras support online as ${Bot.user.tag}  (model: ${Model})`);
});

Bot.on("messageCreate", async (Message) => {
  if (Message.author.bot) return;
  const Name = Message.channel.name || "";
  if (!Name.toLowerCase().startsWith("ticket-")) return;
  let Question = Message.content.trim().replace(`<@${Bot.user.id}>`, "").trim();
  if (!Question) {
    await Message.reply("ask me anything about harras - setup, keys, ipv6, proxies, errors.");
    return;
  }
  await Message.channel.sendTyping();
  let Answer;
  try {
    Answer = await AskGemini(Question, Message.channel.id);
  } catch (E) {
    console.log("[!] gemini failed:", String(E).slice(0, 200));
    Answer = KeywordFallback(Question) || "gemini is unreachable rn. quick answers: Node 24 required, detector.exe checks ipv6 support, keys last 5h + bind to first machine, 'Cannot find module ws' = npm install inside bin.";
  }
  for (let i = 0; i < Answer.length; i += 1900) {
    await Message.reply(Answer.slice(i, i + 1900));
  }
});

Bot.login(Token);
