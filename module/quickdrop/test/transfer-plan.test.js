import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MIB, MAX_FILE_SIZE, MAX_BATCH_SIZE, planTransfers } from '../public/transfer-plan.js';

const file = (name, size) => ({ name, size });
test('512 MiB files and exactly 1024 MiB groups are accepted without reading file data', () => {
  assert.equal(MAX_FILE_SIZE, 512 * MIB); assert.equal(MAX_BATCH_SIZE, 1024 * MIB);
  const groups = planTransfers([file('2.bin', 512 * MIB), file('1.bin', 512 * MIB)]);
  assert.equal(groups.length, 1); assert.equal(groups[0].total, 1024 * MIB);
  assert.deepEqual(groups[0].files.map(entry => entry.name), ['1.bin', '2.bin']);
});
test('oversize selections are split consecutively in natural filename order', () => {
  const groups = planTransfers([file('10.bin', 400 * MIB), file('2.bin', 512 * MIB), file('1.bin', 512 * MIB), file('20.bin', 512 * MIB), file('21.bin', 1)]);
  assert.deepEqual(groups.map(group => group.files.map(entry => entry.name)), [['1.bin', '2.bin'], ['10.bin', '20.bin', '21.bin']]);
  const boundary = planTransfers([file('1', 512 * MIB), file('2', 512 * MIB), file('3', 1)]);
  assert.deepEqual(boundary.map(group => group.total), [1024 * MIB, 1]);
  assert.ok(boundary.every(group => group.total <= 1024 * MIB));
});
test('sorting never moves a later file backwards to fill spare capacity', () => {
  const groups = planTransfers([file('4', 100 * MIB), file('3', 200 * MIB), file('2', 450 * MIB), file('1', 450 * MIB)]);
  assert.deepEqual(groups.map(group => group.files.map(entry => entry.name)), [['1', '2'], ['3', '4']]);
  const tie = planTransfers([file('a2.txt', 2), file('A2.txt', 3), file('a10.txt', 4)]);
  assert.deepEqual(tie[0].files.map(entry => entry.size), [2, 3, 4]);
});
test('more than 50 files automatically becomes multiple groups, including one-file tails', () => {
  const input = Array.from({ length: 101 }, (_, index) => file(`文档${101 - index}.txt`, 0));
  const groups = planTransfers(input);
  assert.deepEqual(groups.map(group => group.files.length), [50, 50, 1]);
  assert.equal(groups[0].files[0].name, '文档1.txt'); assert.equal(groups[2].files[0].name, '文档101.txt');
});
test('long UTF-8 manifests split into groups that fit the control channel', () => {
  const groups = planTransfers(Array.from({ length: 50 }, (_, index) => file(`${index}-${'汉'.repeat(500)}`, 1)));
  assert.ok(groups.length > 1);
  for (const group of groups) {
    const meta = { type: 'batch-meta', id: '0'.repeat(36), total: group.total, part: { id: '0'.repeat(36), index: 999999, total: 999999 }, files: group.files.map(entry => ({ ...entry, id: '0'.repeat(36) })) };
    assert.ok(new TextEncoder().encode(JSON.stringify(meta)).length < 48000);
  }
});
test('any file over 512 MiB rejects the entire selection instead of silently dropping it', () => {
  assert.throws(() => planTransfers([file('small', 1), file('large', 512 * MIB + 1)]), /512 MiB/);
  assert.throws(() => planTransfers([file('bad', -1)])); assert.throws(() => planTransfers([file('', 1)]));
  assert.deepEqual(planTransfers([]), []);
});
