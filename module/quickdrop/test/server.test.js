import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { WebSocket } from 'ws';

const port = 19381, origin = `http://127.0.0.1:${port}`, sockets = [];
let child;
before(async () => {
  child = spawn(process.execPath, ['server.js'], { cwd: new URL('../', import.meta.url), env: { ...process.env, PORT: String(port), PUBLIC_URL: origin } });
  await Promise.race([once(child.stdout, 'data'), once(child, 'exit').then(() => { throw new Error('server exited'); }), new Promise((_, reject) => setTimeout(() => reject(new Error('startup timeout')), 5000).unref())]);
});
after(async () => { for (const ws of sockets) ws.close(); child?.kill(); if (child?.exitCode === null) await once(child, 'exit'); });
function next(ws, type) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { ws.off('message', listener); reject(new Error(`timed out: ${type}`)); }, 4000);
    const listener = raw => { const message = JSON.parse(raw); if (message.type === type) { clearTimeout(timer); ws.off('message', listener); resolve(message); } };
    ws.on('message', listener);
  });
}
async function client() { const ws = new WebSocket(`${origin.replace('http:', 'ws:')}/quickdrop/ws`, { origin }); sockets.push(ws); await once(ws, 'open'); return ws; }
async function create(ws) { const joined = next(ws, 'joined'); ws.send(JSON.stringify({ type: 'create' })); return joined; }

test('HTTP routes, CSP, QR validation, and method restrictions', async () => {
  const page = await fetch(`${origin}/quickdrop/`); assert.equal(page.status, 200); assert.match(await page.text(), /微信 \/ QQ/);
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal((await fetch(`${origin}/quickdrop/healthz`)).status, 200);
  const archive = await fetch(`${origin}/quickdrop/archive.js`); assert.equal(archive.status, 200); assert.match(archive.headers.get('content-type'), /javascript/);
  const policy = await fetch(`${origin}/quickdrop/transfer-plan.js`); assert.equal(policy.status, 200); assert.match(policy.headers.get('content-type'), /javascript/);
  assert.equal((await fetch(`${origin}/quickdrop/qr?room=bad`)).status, 400);
  assert.equal((await fetch(`${origin}/quickdrop/../server.js`)).status, 404);
  assert.equal((await fetch(`${origin}/quickdrop/`, { method: 'POST' })).status, 405);
});
test('room pairing, signaling, full-room rejection, leaving and rejoining', async () => {
  const a = await client(), b = await client(), c = await client(); const room = await create(a);
  assert.match(room.room, /^[A-Za-z0-9_-]{24}$/); assert.ok(room.iceServers.length);
  const qr = await fetch(`${origin}/quickdrop/qr?room=${room.room}`); assert.equal(qr.status, 200); assert.match(await qr.text(), /<svg/);
  const peerJoined = next(a, 'peer-joined'), bJoined = next(b, 'joined');
  b.send(JSON.stringify({ type: 'join', room: room.room })); await peerJoined; assert.equal((await bJoined).room, room.room);
  const forwarded = next(b, 'signal'); a.send(JSON.stringify({ type: 'signal', data: { type: 'offer', sdp: { type: 'offer', sdp: 'sample' } } }));
  assert.equal((await forwarded).data.sdp.sdp, 'sample');
  const rejected = next(c, 'error'); c.send(JSON.stringify({ type: 'join', room: room.room })); assert.match((await rejected).message, /房间已满/);
  const left = next(a, 'peer-left'); b.close(); await left;
  const cJoined = next(c, 'joined'); c.send(JSON.stringify({ type: 'join', room: room.room })); assert.equal((await cJoined).room, room.room);
  const invalid = next(c, 'error'); c.send(JSON.stringify({ type: 'join', room: 'x'.repeat(24) })); assert.match((await invalid).message, /不存在/);
  const malformed = next(c, 'error'); c.send('{'); assert.match((await malformed).message, /无效/);
});
test('cross-origin WebSocket connections are rejected before upgrade', async () => {
  const ws = new WebSocket(`${origin.replace('http:', 'ws:')}/quickdrop/ws`, { origin: 'https://untrusted.example' });
  const [err] = await once(ws, 'error'); assert.match(err.message, /403/);
});
