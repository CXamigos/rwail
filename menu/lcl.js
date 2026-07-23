const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');

const app = express();
const port = process.env.PORT || 3000;

const INITIAL_SERVER_PACKET = Buffer.from('00010001ffa47515f98112ce', 'hex');
const SERVER_PROTOCOLS = ['arras.io#v1.4+sls+et0', 'arras.io'];
const HANDSHAKE_B = Buffer.from(INITIAL_SERVER_PACKET.subarray(4)).reverse().toString('hex');

function normalizeCloseCode(code) {
  if (typeof code !== 'number' || !Number.isInteger(code)) return undefined;
  if (code === 1000) return 1000;
  if (code >= 1001 && code <= 1014 && ![1004, 1005, 1006].includes(code)) return code;
  if (code >= 3000 && code <= 4999) return code;
  return undefined;
}

function normalizeCloseReason(reason) {
  if (reason == null) return '';
  const text = Buffer.isBuffer(reason) ? reason.toString() : String(reason);
  return Buffer.byteLength(text) > 123 ? text.slice(0, 123) : text;
}

app.use('/wasm', express.static(path.join(__dirname, 'wasm')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'simulation.html'));
});

const server = http.createServer(app);

const proxyWss = new WebSocketServer({
  noServer: true,
  handleProtocols(protocols) {
    if (protocols.has('arras.io#v1.4+sls+et0')) return 'arras.io#v1.4+sls+et0';
    if (protocols.has('arras.io')) return 'arras.io';
    return false;
  },
});

function normalizeTargetUrl(rawTarget) {
  let targetUrl = rawTarget;
  try {
    targetUrl = decodeURIComponent(rawTarget);
  } catch (_) {}
  const parsed = new URL(targetUrl);
  parsed.searchParams.set('b', HANDSHAKE_B);
  parsed.searchParams.set('t', Math.floor(Date.now() / 1000).toString());
  targetUrl = parsed.toString();
  return targetUrl;
}

proxyWss.on('connection', (client, req, targetUrl) => {
  const clientUserAgent = req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';
  const clientLanguage = req.headers['accept-language'] || 'en-US,en;q=0.9';
  console.log(`Proxying game socket to ${targetUrl}`);

  const upstream = new WebSocket(targetUrl, SERVER_PROTOCOLS, {
    headers: {
      'User-Agent': clientUserAgent,
      'Origin': 'https://arras.io',
      'Pragma': 'no-cache',
      'Cache-Control': 'no-cache',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Accept-Language': clientLanguage,
    },
    perMessageDeflate: true,
  });

  let upstreamOpen = false;
  let firstServerPacketSent = false;
  const pendingPackets = [];

  function flushPendingPackets() {
    while (pendingPackets.length && upstream.readyState === WebSocket.OPEN) {
      const packet = pendingPackets.shift();
      if (!firstServerPacketSent) {
        firstServerPacketSent = true;
        upstream.send(INITIAL_SERVER_PACKET);
      } else {
        upstream.send(packet);
      }
    }
  }

  client.on('message', (packet, isBinary) => {
    const normalizedPacket = isBinary ? packet : Buffer.from(packet);
    pendingPackets.push(normalizedPacket);
    if (upstreamOpen) flushPendingPackets();
  });

  client.on('close', (code, reason) => {
    if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) {
      const safeCode = normalizeCloseCode(code);
      const safeReason = normalizeCloseReason(reason);
      if (safeCode === undefined) upstream.close();
      else upstream.close(safeCode, safeReason);
    }
  });

  client.on('error', () => {
    if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) {
      upstream.close();
    }
  });

  upstream.on('open', () => {
    upstreamOpen = true;
    console.log('Upstream game socket opened');
    flushPendingPackets();
  });

  upstream.on('message', (packet, isBinary) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(packet, { binary: isBinary });
    }
  });

  upstream.on('close', (code, reason) => {
    const safeCode = normalizeCloseCode(code);
    const closeReason = normalizeCloseReason(reason);
    console.log(`Upstream game socket closed with code ${code}${closeReason.length ? `: ${closeReason}` : ''}`);
    if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
      if (safeCode === undefined) client.close();
      else client.close(safeCode, closeReason);
    }
  });

  upstream.on('error', (error) => {
    console.log(`Upstream game socket error: ${error.message}`);
    if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
      client.close(1011, 'Upstream WebSocket error');
    }
  });
});

server.on('upgrade', (req, socket, head) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  if (requestUrl.pathname !== '/game-proxy') {
    socket.destroy();
    return;
  }

  const rawTarget = requestUrl.searchParams.get('target');
  if (!rawTarget) {
    socket.destroy();
    return;
  }

  const targetUrl = normalizeTargetUrl(rawTarget);
  if (!/^wss?:\/\//i.test(targetUrl)) {
    socket.destroy();
    return;
  }

  proxyWss.handleUpgrade(req, socket, head, (ws) => {
    proxyWss.emit('connection', ws, req, targetUrl);
  });
});

server.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
  console.log(`Game proxy listening at ws://localhost:${port}/game-proxy`);
});
