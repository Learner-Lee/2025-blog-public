export const MIB = 1024 * 1024;
export const MAX_FILE_SIZE = 512 * MIB;
export const MAX_BATCH_SIZE = 1024 * MIB;
export const MAX_BATCH_FILES = 50;
const MANIFEST_BUDGET = 47000; // Leave room for IDs and group numbering below the 48 KiB control limit.
const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' });

// Preserve the natural filename order; never move later files backwards to fill
// spare space in an earlier group. File data is not read while planning.
export function planTransfers(files) {
  const ordered = Array.from(files, (file, index) => {
    if (!file || typeof file.name !== 'string' || !file.name || file.name.length > 512 || !Number.isSafeInteger(file.size) || file.size < 0) {
      throw new Error('文件名称或大小无效，请重新选择。');
    }
    if (file.size > MAX_FILE_SIZE) throw new Error(`“${file.name}”超过单文件 512 MiB 上限，请移除后重试。`);
    return { file, index };
  }).sort((left, right) => collator.compare(left.file.name.normalize('NFC'), right.file.name.normalize('NFC')) || left.index - right.index);
  const groups = [];
  let current = [], total = 0, metadata = 0;
  for (const { file } of ordered) {
    const bytes = new TextEncoder().encode(JSON.stringify({ id: '0'.repeat(36), name: file.name, size: file.size })).length + 1;
    if (current.length && (total + file.size > MAX_BATCH_SIZE || current.length >= MAX_BATCH_FILES || metadata + bytes > MANIFEST_BUDGET)) {
      groups.push({ files: current, total }); current = []; total = 0; metadata = 0;
    }
    current.push(file); total += file.size; metadata += bytes;
  }
  if (current.length) groups.push({ files: current, total });
  return groups;
}
