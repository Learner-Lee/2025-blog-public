import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes, createHmac } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import QRCode from 'qrcode';

const base = '/quickdrop';
const origin = process.env.PUBLIC_URL || 'http://localhost:3031';
const rooms = new Map(), limits = new Map(), connections = new Map();
const roomPattern = /^[A-Za-z0-9_-]{24}$/;
const ttl = Number(process.env.ROOM_TTL_MS) || 3600000;
const send = (ws, data) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)); };
const error = (ws, message) => send(ws, { type: 'error', message });
function iceServers() {
  const servers = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];
  if (process.env.TURN_SECRET && process.env.TURN_URLS) {
    const username = `${Math.floor(Date.now() / 1000) + 7200}:quickdrop`;
    servers.push({ urls: process.env.TURN_URLS.split(','), username,
      credential: createHmac('sha1', process.env.TURN_SECRET).update(username).digest('base64') });
  }
  return servers;
}
function allowed(ip, action, max) {
  const key = `${ip}:${action}`, now = Date.now();
  let entry = limits.get(key);
  if (!entry || entry.until < now) { entry = { count: 0, until: now + 60000 }; limits.set(key, entry); }
  return ++entry.count <= max;
}
function leave(ws) {
  const room = rooms.get(ws.room);
  if (room) {
    room.clients.delete(ws);
    for (const peer of room.clients) send(peer, { type: 'peer-left' });
    if (!room.clients.size) rooms.delete(ws.room);
  }
  ws.room = null;
}
function join(ws, id) {
  const room = rooms.get(id);
  if (!room || Date.now() - room.created > ttl) return error(ws, '房间不存在或已过期，请让对方新建房间。');
  if (ws.room === id) return;
  if (room.clients.size >= 2) return error(ws, '房间已满，最多连接两台设备。');
  leave(ws);
  const peers = [...room.clients];
  room.clients.add(ws); ws.room = id;
  send(ws, { type: 'joined', room: id, iceServers: iceServers(), expires: room.created + ttl });
  // The existing member always initiates, even if the original host disconnected.
  for (const peer of peers) send(peer, { type: 'peer-joined' });
}
const headers = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self' ws: wss:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, origin);
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, headers); return res.end(); }
    if (url.pathname === `${base}/healthz`) {
      res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true }));
    }
    if (url.pathname === base) { res.writeHead(308, { ...headers, Location: `${base}/` }); return res.end(); }
    if (url.pathname === `${base}/qr`) {
      const room = url.searchParams.get('room');
      if (!roomPattern.test(room || '') || !rooms.has(room)) { res.writeHead(400, headers); return res.end('Invalid room'); }
      const svg = await QRCode.toString(`${origin}${base}/?room=${room}`, { type: 'svg', margin: 2, width: 220 });
      res.writeHead(200, { ...headers, 'Content-Type': 'image/svg+xml' }); return res.end(req.method === 'HEAD' ? '' : svg);
    }
    const files = { [`${base}/`]: ['index.html', 'text/html; charset=utf-8'],
      [`${base}/app.js`]: ['app.js', 'text/javascript; charset=utf-8'],
      [`${base}/archive.js`]: ['archive.js', 'text/javascript; charset=utf-8'],
      [`${base}/transfer-plan.js`]: ['transfer-plan.js', 'text/javascript; charset=utf-8'],
      [`${base}/style.css`]: ['style.css', 'text/css; charset=utf-8'],
      [`${base}/cover.svg`]: ['cover.svg', 'image/svg+xml'] };
    const file = files[url.pathname];
    if (!file) { res.writeHead(404, headers); return res.end('Not found'); }
    const data = await readFile(fileURLToPath(new URL(`./public/${file[0]}`, import.meta.url)));
    res.writeHead(200, { ...headers, 'Content-Type': file[1] }); res.end(req.method === 'HEAD' ? '' : data);
  } catch { res.writeHead(500, headers); res.end('Server error'); }
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 65536, perMessageDeflate: false });
server.on('upgrade', (req, socket, head) => {
  let valid = false;
  try { valid = new URL(req.url, origin).pathname === `${base}/ws` && req.headers.origin === new URL(origin).origin; } catch {}
  const remote = req.socket.remoteAddress;
  // Only trust Nginx's overwritten client address when connected over loopback.
  const ip = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote) ? String(req.headers['x-real-ip'] || remote) : remote;
  if (!valid || !allowed(ip, 'connect', 60) || (connections.get(ip) || 0) >= 12) {
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return;
  }
  wss.handleUpgrade(req, socket, head, ws => { ws.ip = ip; wss.emit('connection', ws); });
});
wss.on('connection', ws => {
  connections.set(ws.ip, (connections.get(ws.ip) || 0) + 1); ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });
  ws.on('error', () => {});
  ws.on('close', () => { leave(ws); const count = (connections.get(ws.ip) || 1) - 1; if (count) connections.set(ws.ip, count); else connections.delete(ws.ip); });
  ws.on('message', (raw, binary) => {
    if (binary || !allowed(ws.ip, 'message', 600)) return ws.close(1008, 'Rate limited');
    let message;
    try { message = JSON.parse(raw); } catch { return error(ws, '无效消息。'); }
    if (!message || typeof message !== 'object') return;
    if (message.type === 'create') {
      if (!allowed(ws.ip, 'create', 20)) return error(ws, '操作太频繁，请稍后再试。');
      if (rooms.size >= 500) return error(ws, '服务繁忙，请稍后再试。');
      leave(ws); const id = randomBytes(18).toString('base64url');
      rooms.set(id, { clients: new Set(), created: Date.now() }); join(ws, id);
    } else if (message.type === 'join') {
      if (!allowed(ws.ip, 'join', 30)) return error(ws, '加入太频繁，请一分钟后再试。');
      if (!roomPattern.test(message.room || '')) return error(ws, '配对链接格式不正确。');
      join(ws, message.room);
    } else if (message.type === 'signal' && ['offer', 'answer', 'candidate'].includes(message.data?.type)) {
      const room = rooms.get(ws.room);
      if (JSON.stringify(message.data).length > 32000) return;
      if (room) for (const peer of room.clients) if (peer !== ws) send(peer, { type: 'signal', data: message.data });
    }
  });
});
const sweep = setInterval(() => {
  for (const [id, room] of rooms) if (Date.now() - room.created > ttl) {
    rooms.delete(id);
    for (const client of room.clients) { error(client, '房间已过期，请新建房间重新配对。'); client.close(1000, 'Room expired'); }
  }
  for (const ws of wss.clients) { if (!ws.alive) ws.terminate(); else { ws.alive = false; ws.ping(); } }
  for (const [key, entry] of limits) if (entry.until < Date.now()) limits.delete(key);
}, 30000);
server.listen(Number(process.env.PORT) || 3031, process.env.HOST || '127.0.0.1', () => console.log('QuickDrop listening'));
function shutdown() { clearInterval(sweep); for (const ws of wss.clients) ws.close(1001, 'Service restarting'); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); }
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
