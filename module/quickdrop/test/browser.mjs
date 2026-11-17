import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, open, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const { chromium } = await import('playwright').catch(() => import('/tmp/quickdrop-test-tools/node_modules/playwright/index.mjs'));

const origin = process.argv[2] || 'http://localhost:3031';
const relay = process.argv.includes('--relay');
const prefix = relay ? 'relay' : origin.startsWith('https') ? 'production' : 'local';
await mkdir(new URL('../test-results/', import.meta.url), { recursive: true });
const report = [], errors = [];
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] });
const contexts = [], pages = [];
async function page(viewport = { width: 1365, height: 1100 }) {
  const context = await browser.newContext({ acceptDownloads: true, viewport }); contexts.push(context);
  await context.addInitScript(() => {
    window.__rtcLog = [];
    const Native = window.RTCPeerConnection;
    window.RTCPeerConnection = class extends Native {
      constructor(...args) {
        super(...args);
        this.addEventListener('icecandidate', event => window.__rtcLog.push({ event: 'candidate', type: event.candidate?.type, protocol: event.candidate?.protocol }));
        this.addEventListener('connectionstatechange', () => window.__rtcLog.push({ event: 'connection', state: this.connectionState }));
        this.addEventListener('iceconnectionstatechange', () => window.__rtcLog.push({ event: 'ice', state: this.iceConnectionState }));
      }
    };
  });
  const tab = await context.newPage(); pages.push(tab);
  tab.on('pageerror', error => errors.push(error.message)); return tab;
}
async function run(name, fn) { const time = Date.now(); await fn(); report.push({ name, ok: true, milliseconds: Date.now() - time }); console.log('PASS', name); }
const a = await page(), b = await page();
const aUrl = `${origin}/quickdrop/${relay ? '?relay=1' : ''}`;
let pairUrl;
async function pair() {
  await a.goto(aUrl);
  await a.locator('#pair-link').filter({ visible: true }).waitFor();
  await a.waitForFunction(() => document.getElementById('pair-link').value.includes('room='));
  pairUrl = await a.locator('#pair-link').inputValue();
  if (relay) pairUrl += '&relay=1';
  await b.goto(pairUrl);
  await Promise.all([a.locator('#sas').waitFor({ state: 'visible', timeout: 60000 }), b.locator('#sas').waitFor({ state: 'visible', timeout: 60000 })]);
  assert.equal(await a.locator('#sas').innerText(), await b.locator('#sas').innerText());
  assert.equal(await a.locator('#files').isDisabled(), true);
  await a.locator('#verify').click(); await b.locator('#verify').click();
  await Promise.all([a.locator('#connected-info').waitFor(), b.locator('#connected-info').waitFor()]);
}
const sha = data => createHash('sha256').update(data).digest('hex');
function sample(size) { const data = Buffer.alloc(size); for (let i = 0; i < size; i++) data[i] = i % 251; return data; }
async function transfer(from, to, name, data) {
  if (data.length >= 50000000) {
    const fixture = `/tmp/quickdrop-${name}`;
    await writeFile(fixture, data); await from.locator('#files').setInputFiles(fixture);
  } else await from.locator('#files').setInputFiles({ name, mimeType: 'application/octet-stream', buffer: data });
  const entry = to.locator('#inbox .item').filter({ has: to.locator('strong', { hasText: name }) }).first();
  await entry.getByRole('button', { name: '接收文件' }).click({ timeout: 30000 });
  const link = entry.getByRole('link', { name: '下载保存 ↓' });
  await link.waitFor({ timeout: 180000 });
  const downloadPromise = to.waitForEvent('download'); await link.click();
  const download = await downloadPromise;
  const output = await readFile(await download.path());
  assert.equal(sha(output), sha(data)); assert.equal(output.length, data.length);
  await from.waitForFunction(() => !document.getElementById('files').disabled, { timeout: 30000 });
}
async function selectBatch(from, files) {
  const folder = await mkdtemp('/tmp/quickdrop-batch-'), paths = [];
  for (let index = 0; index < files.length; index++) {
    const dir = `${folder}/${index}`; await mkdir(dir);
    const path = `${dir}/${files[index].name}`; await writeFile(path, files[index].data); paths.push(path);
  }
  await from.locator('#files').setInputFiles(paths);
}
async function checkZip(entry, files) {
  const link = entry.getByRole('link', { name: '打包下载 ZIP ↓' }); await link.waitFor({ timeout: 180000 });
  const downloadPromise = b.waitForEvent('download'); await link.click(); const download = await downloadPromise;
  const result = spawnSync('python3', ['-c', `import sys,zipfile,json,hashlib,pathlib
z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None
assert all('..' not in pathlib.PurePosixPath(n).parts and not n.startswith('/') for n in z.namelist())
print(json.dumps([{'name':i.filename,'directory':i.is_dir(),'size':i.file_size,'hash':hashlib.sha256(z.read(i)).hexdigest()} for i in z.infolist()]))`, await download.path()]);
  assert.equal(result.status, 0, result.stderr.toString());
  const entries = JSON.parse(result.stdout); assert.equal(entries.length, files.length + 1); assert.equal(entries[0].directory, true);
  entries.slice(1).forEach((file, index) => { assert.equal(file.hash, sha(files[index].data)); assert.equal(file.size, files[index].data.length); assert.ok(file.name.startsWith(entries[0].name)); });
  return entries;
}
async function groupedTransfer() {
  const files = [{ name: '中文报告.txt', data: Buffer.from('first 中文') }, { name: '中文报告.txt', data: Buffer.from('second 😀') }, { name: '空文件.txt', data: Buffer.alloc(0) },
    { name: '视频样本.bin', data: sample(relay ? 1048576 : 50 * 1048576) }];
  const beforeIn = await b.locator('#inbox > .item').count(), beforeOut = await a.locator('#outgoing > .item').count();
  await selectBatch(a, files);
  const entry = b.locator('#inbox > .batch-task').first();
  await entry.getByRole('button', { name: '接收这组文件（4 个）' }).waitFor();
  assert.equal(await entry.locator('button.primary').count(), 1); assert.equal(await entry.getByRole('button', { name: '接收文件', exact: true }).count(), 0);
  await entry.locator('summary').click(); assert.equal(await entry.locator('details').getAttribute('open'), '');
  await entry.getByRole('button', { name: '接收这组文件（4 个）' }).click();
  assert.equal(await entry.locator('details').getAttribute('open'), null);
  const zip = await checkZip(entry, [files[2], files[3], files[0], files[1]]);
  assert.ok(zip[4].name.endsWith('/中文报告 (2).txt'));
  assert.equal(await entry.locator('details').getAttribute('open'), null);
  assert.equal(await b.locator('#inbox > .item').count(), beforeIn + 1); assert.equal(await a.locator('#outgoing > .item').count(), beforeOut + 1);
  await a.waitForFunction(() => !document.getElementById('files').disabled);
  await entry.locator('summary').click(); assert.equal(await entry.locator('li').count(), 4);
  await entry.locator('summary').click();
  await b.screenshot({ path: new URL(`../test-results/${prefix}-batch.png`, import.meta.url).pathname, fullPage: true });
}
try {
  await run('Pairing and matching DTLS authentication codes', pair);
  await run('Selected connection route', async () => {
    const path = await a.locator('#network-path').innerText();
    if (relay) assert.match(path, /中继/); report.push({ route: path });
  });
  await run('Unicode text and URL in both directions', async () => {
    await a.locator('#text').fill('微信 QQ 中文测试 😀 https://example.com/?a=1&b=2'); await a.locator('#send-text').click();
    await b.getByText('微信 QQ 中文测试 😀 https://example.com/?a=1&b=2', { exact: true }).waitFor();
    await b.locator('#text').fill('<script>alert("hello")</script>'); await b.locator('#send-text').click();
    await a.getByText('<script>alert("hello")</script>', { exact: true }).waitFor();
  });
  await run('1 MiB binary transfer with downloaded hash verification', () => transfer(a, b, '微信-文件-1MiB.bin', sample(1048576)));
  await run('Reverse direction empty file', () => transfer(b, a, 'QQ-空文件.txt', Buffer.alloc(0)));
  await run('Explicit file rejection', async () => {
    await a.locator('#files').setInputFiles({ name: '拒收.bin', mimeType: 'application/octet-stream', buffer: Buffer.from('reject') });
    await b.getByRole('button', { name: '拒绝', exact: true }).click();
    await a.getByText('对方拒绝了文件。', { exact: true }).waitFor();
    await a.waitForFunction(() => !document.getElementById('files').disabled);
  });
  await run('One batch confirmation, collapsed task, ZIP folder and independent downloaded hashes', groupedTransfer);
  if (!relay) {
    await run('Corrupted payload fails SHA-256 verification', async () => {
      await a.evaluate(() => {
        window.__originalSend = RTCDataChannel.prototype.send;
        window.__corruptNext = true;
        RTCDataChannel.prototype.send = function(data) {
          if (window.__corruptNext && data instanceof ArrayBuffer && data.byteLength) {
            window.__corruptNext = false; const altered = data.slice(0); new Uint8Array(altered)[0] ^= 1;
            return window.__originalSend.call(this, altered);
          }
          return window.__originalSend.call(this, data);
        };
      });
      await a.locator('#files').setInputFiles({ name: 'corruption.bin', mimeType: 'application/octet-stream', buffer: sample(1024) });
      await b.locator('#inbox .item').filter({ has: b.locator('strong', { hasText: 'corruption.bin' }) }).getByRole('button', { name: '接收文件' }).click();
      await b.getByText('文件校验失败，请重新发送。', { exact: true }).waitFor();
      await a.getByText('对方接收失败，请重新发送。', { exact: true }).waitFor();
      await a.evaluate(() => { RTCDataChannel.prototype.send = window.__originalSend; });
      await a.waitForFunction(() => !document.getElementById('files').disabled);
    });
    await run('Whole-batch rejection and sender cancellation before consent', async () => {
      const files = [{ name: 'reject-1.txt', data: Buffer.from('one') }, { name: 'reject-2.txt', data: Buffer.from('two') }];
      await selectBatch(a, files);
      let entry = b.locator('#inbox > .batch-task').first();
      await entry.getByRole('button', { name: '拒绝', exact: true }).click();
      await a.getByText('对方拒绝了这组文件。', { exact: true }).waitFor();
      await a.waitForFunction(() => !document.getElementById('files').disabled);
      assert.equal(await entry.locator('a.download').count(), 0);
      await selectBatch(a, files); entry = b.locator('#inbox > .batch-task').first();
      await entry.getByRole('button', { name: '接收这组文件（2 个）' }).waitFor();
      await a.locator('#outgoing > .batch-task').first().getByRole('button', { name: '取消整组发送' }).click();
      await entry.getByText('这组传输已停止，没有生成下载压缩包。', { exact: true }).waitFor();
      assert.equal(await entry.locator('a.download').count(), 0);
      await a.waitForFunction(() => !document.getElementById('files').disabled);
    });
    await run('Corruption in a later file prevents the entire ZIP download', async () => {
      await a.evaluate(() => {
        window.__originalBatchSend = RTCDataChannel.prototype.send; window.__corruptBatch = false;
        RTCDataChannel.prototype.send = function(data) {
          if (typeof data === 'string') { const message = JSON.parse(data); if (message.type === 'file-meta' && message.name === '02-corrupt-batch.bin') window.__corruptBatch = true; }
          if (window.__corruptBatch && data instanceof ArrayBuffer && data.byteLength) { window.__corruptBatch = false; const bytes = data.slice(0); new Uint8Array(bytes)[0] ^= 1; return window.__originalBatchSend.call(this, bytes); }
          return window.__originalBatchSend.call(this, data);
        };
      });
      await selectBatch(a, [{ name: '01-valid.txt', data: Buffer.from('valid') }, { name: '02-corrupt-batch.bin', data: sample(65536) }]);
      const entry = b.locator('#inbox > .batch-task').first();
      await entry.getByRole('button', { name: '接收这组文件（2 个）' }).click();
      await entry.getByText('文件校验失败，请重新发送。', { exact: true }).waitFor();
      assert.equal(await entry.locator('a.download').count(), 0);
      await a.waitForFunction(() => !document.getElementById('files').disabled);
      await a.evaluate(() => { RTCDataChannel.prototype.send = window.__originalBatchSend; });
    });
    await run('Receiver cancels after one file; no partial archive is offered', async () => {
      await a.evaluate(() => {
        window.__beforeHoldSend = RTCDataChannel.prototype.send;
        RTCDataChannel.prototype.send = function(data) {
          if (typeof data === 'string') { const message = JSON.parse(data); if (message.type === 'file-meta' && message.name === 'held-second.txt') return; }
          return window.__beforeHoldSend.call(this, data);
        };
      });
      await selectBatch(a, [{ name: 'first-complete.txt', data: Buffer.from('completed') }, { name: 'held-second.txt', data: Buffer.from('held') }]);
      const entry = b.locator('#inbox > .batch-task').first();
      await entry.getByRole('button', { name: '接收这组文件（2 个）' }).click();
      await entry.getByText('已校验 1/2 个文件', { exact: true }).waitFor();
      await entry.getByRole('button', { name: '取消接收', exact: true }).click();
      await entry.getByText('已取消接收这组文件。', { exact: true }).waitFor(); assert.equal(await entry.locator('a.download').count(), 0);
      await a.waitForFunction(() => !document.getElementById('files').disabled);
      await a.evaluate(() => { RTCDataChannel.prototype.send = window.__beforeHoldSend; });
    });
    await run('File metadata cannot exceed the list that was accepted', async () => {
      await a.evaluate(() => {
        window.__beforeMismatchSend = RTCDataChannel.prototype.send;
        RTCDataChannel.prototype.send = function(data) {
          if (typeof data === 'string') { const message = JSON.parse(data); if (message.type === 'file-meta' && message.name === 'mismatched.txt') return window.__beforeMismatchSend.call(this, JSON.stringify({ ...message, size: message.size + 1 })); }
          return window.__beforeMismatchSend.call(this, data);
        };
      });
      await selectBatch(a, [{ name: 'manifest-first.txt', data: Buffer.from('first') }, { name: 'mismatched.txt', data: Buffer.from('mismatch') }]);
      const entry = b.locator('#inbox > .batch-task').first();
      await entry.getByRole('button', { name: '接收这组文件（2 个）' }).click();
      await entry.getByText('这组文件的内容与确认清单不一致，已停止接收。', { exact: true }).waitFor();
      assert.equal(await entry.locator('a.download').count(), 0);
      await a.waitForFunction(() => !document.getElementById('files').disabled);
      await a.evaluate(() => { RTCDataChannel.prototype.send = window.__beforeMismatchSend; });
    });
    await run('50 MiB binary transfer and downloaded hash verification', () => transfer(a, b, '视频样本-50MiB.bin', sample(50 * 1048576)));
    await run('Automatic natural-name groups continue into a one-file final group', async () => {
      const files = Array.from({ length: 51 }, (_, index) => ({ name: `自动分组${51 - index}.txt`, data: Buffer.from(`payload-${51 - index}`) }));
      const before = await b.locator('#inbox > .batch-task').count();
      await selectBatch(a, files);
      const first = b.locator('#inbox > .batch-task[data-part-index="1"][data-part-total="2"]').last();
      await first.getByRole('button', { name: '接收这组文件（50 个）' }).click();
      const zip1 = await checkZip(first, files.slice(1).reverse());
      assert.ok(zip1[1].name.endsWith('/自动分组1.txt')); assert.ok(zip1[50].name.endsWith('/自动分组50.txt'));
      assert.match(zip1[0].name, /-第1组-/);
      const second = b.locator('#inbox > .batch-task[data-part-index="2"][data-part-total="2"]').last();
      await second.getByRole('button', { name: '接收这组文件（1 个）' }).click();
      const zip2 = await checkZip(second, [files[0]]); assert.ok(zip2[1].name.endsWith('/自动分组51.txt'));
      assert.match(zip2[0].name, /-第2组-/);
      assert.equal(await b.locator('#inbox > .batch-task').count(), before + 2);
      const titles = await b.locator('#inbox > .batch-task[data-part-total="2"] > strong').allTextContents();
      assert.match(titles[0], /第 1\/2 组/); assert.match(titles[1], /第 2\/2 组/);
      await a.waitForFunction(() => !document.getElementById('files').disabled);
      b.once('dialog', dialog => dialog.accept()); await first.getByRole('button', { name: '释放缓存', exact: true }).click();
      assert.equal(await first.locator('a.download').count(), 0);
      await first.getByText('本任务缓存已释放，如需再次下载请重新发送。', { exact: true }).waitFor();
      assert.equal(await second.locator('a.download').count(), 1);
    });
    await run('Rejecting an automatic group stops the remaining groups', async () => {
      const before = await b.locator('#inbox > .batch-task').count();
      await selectBatch(a, Array.from({ length: 51 }, (_, index) => ({ name: `停止${index + 1}.txt`, data: Buffer.from('stop') })));
      const first = b.locator('#inbox > .batch-task').first();
      await first.getByRole('button', { name: '拒绝', exact: true }).click();
      await a.waitForFunction(() => !document.getElementById('files').disabled);
      await a.getByText('本组未完成，后续 1 组已停止发送。', { exact: true }).waitFor();
      assert.equal(await b.locator('#inbox > .batch-task').count(), before + 1);
    });
    await run('Oversize file refused before sending', async () => {
      const folder = await mkdtemp('/tmp/quickdrop-limit-'), path = `${folder}/too-large.bin`;
      const handle = await open(path, 'w'); await handle.truncate(512 * 1048576 + 1); await handle.close();
      await a.locator('#files').setInputFiles(path);
      await a.getByText(/超过单文件 512 MiB 上限/).waitFor();
    });
    await run('Third device rejected and invalid room explained', async () => {
      const third = await page(); await third.goto(pairUrl); await third.getByText('房间已满，最多连接两台设备。', { exact: true }).waitFor();
      await third.goto(`${origin}/quickdrop/?room=${'x'.repeat(24)}`);
      await third.getByText('房间不存在或已过期，请让对方新建房间。', { exact: true }).waitFor();
      await third.close();
    });
    await run('Mobile layout fits 390px viewport', async () => {
      await b.setViewportSize({ width: 390, height: 844 });
      await b.screenshot({ path: new URL(`../test-results/${prefix}-mobile.png`, import.meta.url).pathname, fullPage: true });
      assert.equal(await b.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await b.setViewportSize({ width: 1365, height: 1100 });
    });
  }
  await a.screenshot({ path: new URL(`../test-results/${prefix}-desktop.png`, import.meta.url).pathname, fullPage: true });
  await run('Disconnect aborts pending file and room can be reused', async () => {
    await a.locator('#files').setInputFiles({ name: '断线.bin', mimeType: 'application/octet-stream', buffer: Buffer.from('disconnect') });
    await b.locator('#inbox .item').filter({ has: b.locator('strong', { hasText: '断线.bin' }) }).getByRole('button', { name: '接收文件' }).waitFor();
    await b.close({ runBeforeUnload: false });
    await a.locator('#connected-info').waitFor({ state: 'hidden', timeout: 15000 });
    await a.getByText('对方已离开，传输已中止。', { exact: true }).waitFor();
    const replacement = await page(); await replacement.goto(pairUrl);
    await replacement.locator('#sas').waitFor({ timeout: 60000 });
    assert.equal(await a.locator('#sas').innerText(), await replacement.locator('#sas').innerText());
  });
  assert.deepEqual(errors, []);
} catch (error) {
  report.push({ ok: false, error: error.stack });
  for (let i = 0; i < pages.length; i++) if (!pages[i].isClosed()) {
    console.log('PAGE', i, await pages[i].locator('body').innerText());
    console.log('RTC', i, await pages[i].evaluate(() => window.__rtcLog));
    await pages[i].screenshot({ path: new URL(`../test-results/${prefix}-failure-${i}.png`, import.meta.url).pathname, fullPage: true }).catch(() => {});
  }
  process.exitCode = 1;
} finally {
  await writeFile(new URL(`../test-results/${prefix}-report.json`, import.meta.url), JSON.stringify({ origin, relay, report, errors }, null, 2));
  await browser.close();
}
