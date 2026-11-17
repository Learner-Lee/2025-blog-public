import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createZip, updateCrc32 } from '../public/archive.js';

test('CRC32 matches the standard check vector across multiple chunks', () => {
  const data = new TextEncoder().encode('123456789');
  assert.equal(updateCrc32(0, data), 0xcbf43926);
  assert.equal(updateCrc32(updateCrc32(0, data.slice(0, 3)), data.slice(3)), 0xcbf43926);
  assert.equal(updateCrc32(0, new Uint8Array()), 0);
});
test('Python zipfile reads UTF-8, duplicate, unsafe and empty filenames without content loss', async () => {
  const names = ['中文😀.txt', 'report.txt', 'REPORT.txt', '../escape.txt', 'CON', '空文件.txt'];
  const payloads = names.map((_, index) => index === 5 ? Buffer.alloc(0) : Buffer.from(`file-${index}: 中文\0binary`));
  const entries = names.map((name, index) => ({ name, blob: new Blob([payloads[index]]), crc32: updateCrc32(0, payloads[index]) }));
  const zip = createZip(entries, '接收文件夹', new Date('2026-11-15T00:00:00Z'));
  const result = spawnSync('python3', ['-c', `import sys,io,zipfile,json,base64,pathlib
z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()))
assert z.testzip() is None
assert all('..' not in pathlib.PurePosixPath(n).parts and not n.startswith('/') for n in z.namelist())
print(json.dumps([{'name':i.filename,'data':base64.b64encode(z.read(i)).decode(),'directory':i.is_dir()} for i in z.infolist()]))`], { input: Buffer.from(await zip.arrayBuffer()) });
  assert.equal(result.status, 0, result.stderr.toString());
  const files = JSON.parse(result.stdout);
  assert.equal(files[0].name, '接收文件夹/'); assert.equal(files[0].directory, true);
  assert.equal(files[2].name, '接收文件夹/report.txt');
  assert.equal(files[3].name, '接收文件夹/REPORT (2).txt');
  assert.equal(files[5].name, '接收文件夹/_CON');
  files.slice(1).forEach((file, index) => assert.deepEqual(Buffer.from(file.data, 'base64'), payloads[index]));
});
test('ZIP refuses invalid entries and supports the full 50-file batch limit', async () => {
  assert.throws(() => createZip([], 'batch'));
  assert.throws(() => createZip([{ name: 'bad', blob: new Blob([]), crc32: -1 }], 'batch'));
  assert.throws(() => createZip(Array(51).fill({ blob: new Blob([]), crc32: 0 }), 'batch'));
  const zip = createZip(Array.from({ length: 50 }, () => ({ name: 'empty.txt', blob: new Blob([]), crc32: 0 })), 'batch');
  const result = spawnSync('python3', ['-c', 'import io,sys,zipfile;z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()));assert len(z.namelist())==51;assert z.testzip() is None'], { input: Buffer.from(await zip.arrayBuffer()) });
  assert.equal(result.status, 0, result.stderr.toString());
});
