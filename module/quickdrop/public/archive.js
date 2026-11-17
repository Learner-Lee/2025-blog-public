// Small ZIP32 STORE writer. Blob parts retain file data without concatenating
// every received file into another large JavaScript ArrayBuffer.
const encoder = new TextEncoder();
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let value = n;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  crcTable[n] = value >>> 0;
}
export function updateCrc32(previous, bytes) {
  let crc = previous ^ 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function cleanName(value) {
  let name = String(value || '').normalize('NFC').replace(/[<>:"/\\|?*\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/g, '_').replace(/[. ]+$/g, '').trim();
  if (!name || name === '.' || name === '..') name = '未命名文件';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = `_${name}`;
  return name;
}
function uniqueName(value, names) {
  const original = cleanName(value);
  let name = original, index = 2;
  const dot = original.lastIndexOf('.');
  const stem = dot > 0 ? original.slice(0, dot) : original, extension = dot > 0 ? original.slice(dot) : '';
  while (names.has(name.toLowerCase())) name = `${stem} (${index++})${extension}`;
  names.add(name.toLowerCase()); return name;
}
export function createZip(files, folderName, date = new Date()) {
  if (!Array.isArray(files) || !files.length || files.length > 50) throw new Error('压缩包文件数量不正确。');
  const folder = cleanName(folderName), used = new Set();
  const entries = [{ path: `${folder}/`, blob: new Blob([]), crc32: 0, directory: true }];
  for (const file of files) {
    if (!(file.blob instanceof Blob) || !Number.isInteger(file.crc32) || file.crc32 < 0 || file.crc32 > 0xffffffff) throw new Error('文件尚未准备好，无法打包。');
    entries.push({ path: `${folder}/${uniqueName(file.name, used)}`, blob: file.blob, crc32: file.crc32, directory: false });
  }
  const year = Math.max(1980, Math.min(2107, date.getFullYear()));
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const parts = [], directory = [];
  let offset = 0, directorySize = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.path), size = entry.blob.size;
    if (name.length > 65535 || size > 0xffffffff || offset + 30 + name.length + size > 0xffffffff) throw new Error('文件超过压缩包大小限制。');
    const local = new Uint8Array(30), header = new DataView(local.buffer);
    header.setUint32(0, 0x04034b50, true); header.setUint16(4, 20, true); header.setUint16(6, 0x0800, true);
    header.setUint16(10, dosTime, true); header.setUint16(12, dosDate, true); header.setUint32(14, entry.crc32, true);
    header.setUint32(18, size, true); header.setUint32(22, size, true); header.setUint16(26, name.length, true);
    parts.push(local, name, entry.blob);
    const central = new Uint8Array(46), record = new DataView(central.buffer);
    record.setUint32(0, 0x02014b50, true); record.setUint16(4, 20, true); record.setUint16(6, 20, true); record.setUint16(8, 0x0800, true);
    record.setUint16(12, dosTime, true); record.setUint16(14, dosDate, true); record.setUint32(16, entry.crc32, true);
    record.setUint32(20, size, true); record.setUint32(24, size, true); record.setUint16(28, name.length, true);
    record.setUint32(38, entry.directory ? 0x10 : 0, true); record.setUint32(42, offset, true);
    directory.push(central, name); directorySize += central.length + name.length; offset += local.length + name.length + size;
  }
  const end = new Uint8Array(22), footer = new DataView(end.buffer);
  footer.setUint32(0, 0x06054b50, true); footer.setUint16(8, entries.length, true); footer.setUint16(10, entries.length, true);
  footer.setUint32(12, directorySize, true); footer.setUint32(16, offset, true);
  return new Blob([...parts, ...directory, end], { type: 'application/zip' });
}
