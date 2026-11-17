import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, mkdtemp, open, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const { chromium } = await import('playwright').catch(() => import('/tmp/quickdrop-test-tools/node_modules/playwright/index.mjs'));
const origin = process.argv[2] || 'http://localhost:3031';
const size = 512 * 1048576, folder = await mkdtemp('/tmp/quickdrop-512MiB-');
const path = `${folder}/01-512MiB.bin`, empty = `${folder}/02-empty.txt`;
const handle = await open(path, 'w'); await handle.truncate(size);
for (const offset of [0, size / 2, size - 64]) await handle.write(Buffer.from(`QuickDrop boundary ${offset}`), 0, undefined, offset);
await handle.close(); await writeFile(empty, '');
const hash = createHash('sha256'); for await (const chunk of createReadStream(path)) hash.update(chunk);
const expected = hash.digest('hex');
console.log('Prepared a real 512 MiB sparse fixture with nonzero markers and an independent SHA-256.');
await mkdir(new URL('../test-results/', import.meta.url), { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] });
const errors = [];
try {
  const sender = await browser.newContext(), receiver = await browser.newContext({ acceptDownloads: true });
  const a = await sender.newPage(), b = await receiver.newPage();
  for (const page of [a, b]) page.on('pageerror', error => errors.push(error.message));
  await a.goto(`${origin}/quickdrop/`); await a.waitForFunction(() => document.getElementById('pair-link').value.includes('room='));
  await b.goto(await a.locator('#pair-link').inputValue());
  await Promise.all([a.locator('#sas').waitFor({ timeout: 60000 }), b.locator('#sas').waitFor({ timeout: 60000 })]);
  assert.equal(await a.locator('#sas').innerText(), await b.locator('#sas').innerText());
  await a.locator('#verify').click(); await b.locator('#verify').click();
  await Promise.all([a.locator('#connected-info').waitFor(), b.locator('#connected-info').waitFor()]);
  await a.locator('#files').setInputFiles([path, empty]);
  const task = b.locator('#inbox > .batch-task').first();
  await task.getByRole('button', { name: '接收这组文件（2 个）' }).click({ timeout: 30000 });
  console.log('PASS Exactly 512 MiB accepted in one batch confirmation.');
  const link = task.getByRole('link', { name: '打包下载 ZIP ↓' }); await link.waitFor({ timeout: 300000 });
  const nextDownload = b.waitForEvent('download'); await link.click(); const download = await nextDownload;
  const result = spawnSync('python3', ['-c', `import sys,zipfile,json,hashlib
z=zipfile.ZipFile(sys.argv[1]);result=[]
for item in z.infolist():
 h=hashlib.sha256()
 with z.open(item) as f:
  for chunk in iter(lambda:f.read(1048576),b''):h.update(chunk)
 result.append({'name':item.filename,'size':item.file_size,'hash':h.hexdigest(),'directory':item.is_dir()})
print(json.dumps(result))`, await download.path()], { timeout: 120000 });
  assert.equal(result.status, 0, result.stderr.toString());
  const contents = JSON.parse(result.stdout); assert.equal(contents.length, 3); assert.equal(contents[0].directory, true);
  assert.equal(contents[1].size, size); assert.equal(contents[1].hash, expected); assert.equal(contents[2].size, 0);
  await a.waitForFunction(() => !document.getElementById('files').disabled);
  b.once('dialog', dialog => dialog.accept()); await task.getByRole('button', { name: '释放缓存', exact: true }).click();
  assert.equal(await task.locator('a.download').count(), 0);
  await b.getByText('仅保留在当前页面', { exact: true }).waitFor(); assert.deepEqual(errors, []);
  await writeFile(new URL('../test-results/large-file-report.json', import.meta.url), JSON.stringify({ ok: true, origin, size, expected, contents, errors }, null, 2));
  console.log('PASS Real 512 MiB transfer, ZIP CRC/content SHA-256, empty file and memory-cache release.');
} catch (error) {
  console.log(error.stack);
  await writeFile(new URL('../test-results/large-file-report.json', import.meta.url), JSON.stringify({ ok: false, origin, error: error.stack, errors }, null, 2));
  process.exitCode = 1;
} finally { await browser.close(); }
