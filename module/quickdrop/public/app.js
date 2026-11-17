/* QuickDrop: all file and text payloads travel over the encrypted DataChannel. */
'use strict';
import { MAX_FILE_SIZE as MAX_FILE, MAX_BATCH_SIZE as MAX_BATCH, MAX_BATCH_FILES, MIB, planTransfers } from './transfer-plan.js';
const $ = id => document.getElementById(id);
const CHUNK = 16384;
const state = { ws: null, pc: null, dc: null, room: new URL(location.href).searchParams.get('room'),
  candidates: [], ice: [], outgoing: null, receiving: null, sending: false, verified: false,
  peerVerified: false, sasReady: false, connected: false, generation: 0, retries: 0, reconnect: null,
  signalQueue: Promise.resolve(), messageQueue: Promise.resolve(), urls: new Set(), receivedBytes: 0,
  peerBatch: false, peerLargeFiles: false, incomingBatch: null, outgoingBatch: null };
let archiveImport;
function archiveAPI() {
  if (!archiveImport) archiveImport = import('./archive.js').catch(error => { archiveImport = null; throw error; });
  return archiveImport;
}
let noticeTimer;
function notify(message, permanent = false) {
  clearTimeout(noticeTimer); $('notice').textContent = message; $('notice').hidden = false;
  if (!permanent) noticeTimer = setTimeout(() => { $('notice').hidden = true; }, 12000);
}
function status(message, ready = false) { $('status').textContent = message; $('status').classList.toggle('ready', ready); }
function formatSize(n) { return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KiB` : `${(n / 1048576).toFixed(1)} MiB`; }
function setReady() {
  const ready = state.dc?.readyState === 'open' && state.verified && state.peerVerified;
  state.connected = ready; $('files').disabled = !ready || state.sending;
  $('dropzone').classList.toggle('disabled', !ready || state.sending);
  $('text').disabled = !ready; $('send-text').disabled = !ready;
  $('file-hint').textContent = ready ? '点击选择 · 支持一次选择多个文件' : '连接并确认配对后即可发送';
  $('verification').hidden = !state.sasReady || ready;
  $('pair-content').hidden = ready || state.sasReady;
  $('connected-info').hidden = !ready;
  $('connection-dot').classList.toggle('ready', ready);
  if (ready) { status('已连接', true); $('peer-status').textContent = '已连接'; }
}
function sendControl(message) {
  if (state.dc?.readyState !== 'open') throw new Error('连接已断开，请重新配对。');
  state.dc.send(JSON.stringify(message));
}
function signal(data) {
  if (state.ws?.readyState !== WebSocket.OPEN) throw new Error('信令连接已断开。');
  state.ws.send(JSON.stringify({ type: 'signal', data }));
}
function setItemResult(item, message, kind = '') {
  item.result.textContent = message; item.result.className = `result ${kind}`;
}
function item(title, subtitle, target = 'inbox') {
  if (target === 'inbox') $('empty-inbox').hidden = true;
  const root = document.createElement('div'); root.className = 'item';
  const name = document.createElement('strong'); name.textContent = title;
  const detail = document.createElement('p'); detail.textContent = subtitle;
  const result = document.createElement('span'); result.className = 'result';
  const actions = document.createElement('div'); actions.className = 'actions';
  root.append(name, detail, result, actions); $(target).prepend(root);
  return { root, detail, result, actions };
}
function progress(item) {
  if (!item.progress) { item.progress = document.createElement('progress'); item.progress.max = 1; item.progress.value = 0; item.root.insertBefore(item.progress, item.actions); }
  return item.progress;
}
function button(text, action, kind = 'secondary') {
  const node = document.createElement('button'); node.textContent = text; node.className = kind;
  node.addEventListener('click', action); return node;
}
function retainedHint() {
  $('retained-hint').textContent = state.receivedBytes ? `本页缓存 ${formatSize(state.receivedBytes)} · 保存后可释放` : '仅保留在当前页面';
}
function attachDownload(entry, blob, filename, label, bytes) {
  const url = URL.createObjectURL(blob); state.urls.add(url); state.receivedBytes += bytes; retainedHint();
  const link = document.createElement('a'); link.href = url; link.download = filename; link.className = 'download'; link.textContent = label;
  const release = button('释放缓存', () => {
    if (!state.urls.has(url) || !confirm(`请确认“${filename}”已经下载保存。释放缓存后，本页将不能再次下载这个任务，是否继续？`)) return;
    URL.revokeObjectURL(url); state.urls.delete(url); state.receivedBytes = Math.max(0, state.receivedBytes - bytes); retainedHint();
    const note = document.createElement('span'); note.className = 'muted small'; note.textContent = '本任务缓存已释放，如需再次下载请重新发送。';
    entry.actions.replaceChildren(note);
  });
  entry.actions.replaceChildren(link, release);
}
function batchItem(files, target, part = null) {
  const total = files.reduce((sum, file) => sum + file.size, 0);
  const prefix = target === 'inbox' ? '收到' : '发送';
  const title = part?.total > 1 ? `${prefix}第 ${part.index}/${part.total} 组（${files.length} 个文件）` : `${prefix}一组文件（${files.length} 个）`;
  const entry = item(title, `共 ${formatSize(total)} · 一次确认，整组传输`, target);
  entry.root.classList.add('batch-task');
  if (part) {
    entry.root.dataset.selectionId = part.id; entry.root.dataset.partIndex = part.index; entry.root.dataset.partTotal = part.total;
    const siblings = [...$(target).querySelectorAll('.batch-task')].filter(node => node !== entry.root && node.dataset.selectionId === part.id);
    if (siblings.length) siblings[siblings.length - 1].after(entry.root);
  }
  entry.details = document.createElement('details'); entry.details.className = 'batch-files';
  const summary = document.createElement('summary'); summary.textContent = `文件明细（${files.length} 个）`;
  const list = document.createElement('ol');
  entry.rows = files.map(file => {
    const row = document.createElement('li'), name = document.createElement('span'), label = document.createElement('span');
    name.className = 'batch-file-name'; name.textContent = file.name;
    label.className = 'batch-file-state'; label.textContent = `${formatSize(file.size)} · 等待传输`;
    row.append(name, label); list.append(row); return label;
  });
  entry.current = document.createElement('p'); entry.current.className = 'batch-current';
  entry.details.append(summary, list); entry.root.append(entry.current, entry.details);
  return entry;
}
function batchProgress(batch, currentBytes = 0) {
  progress(batch.item).value = batch.total ? Math.min(1, (batch.completedBytes + currentBytes) / batch.total) : batch.completed / batch.files.length;
}
function stopBatchRows(batch) {
  for (let index = batch.completed; index < batch.files.length; index++) batch.item.rows[index].textContent = '未完成';
  batch.item.details.open = false;
}
function finishBatchReceive(message, kind = 'error') {
  const batch = state.incomingBatch;
  if (!batch) return;
  clearTimeout(batch.timer);
  if (state.receiving?.batch === batch) { clearTimeout(state.receiving.timer); state.receiving.chunks = []; state.receiving = null; }
  batch.blobs = []; batch.item.actions.replaceChildren(); batch.item.current.textContent = '';
  stopBatchRows(batch); setItemResult(batch.item, message, kind); state.incomingBatch = null;
}
function batchWait(batch, timeout = 180000) {
  clearTimeout(batch.timer);
  batch.timer = setTimeout(() => {
    if (state.incomingBatch !== batch) return;
    try { sendControl({ type: 'batch-error', id: batch.id }); } catch {}
    finishBatchReceive('这组文件接收超时，请重新发送。');
  }, timeout);
}
function cancelOutgoing(message) {
  if (state.outgoingBatch) { state.outgoingBatch.abort.abort(new Error(message)); state.outgoingBatch = null; }
  if (state.outgoing) { state.outgoing.abort.abort(new Error(message)); state.outgoing = null; }
}
function finishReceive(message, kind = 'error') {
  if (state.incomingBatch) { finishBatchReceive(message, kind); return; }
  const receiver = state.receiving;
  if (!receiver) return;
  clearTimeout(receiver.timer); receiver.chunks = []; receiver.item.actions.replaceChildren();
  setItemResult(receiver.item, message, kind); state.receiving = null;
}
function resetPeer(message = '连接已断开，请重新配对。') {
  state.generation++;
  clearTimeout(state.iceTimer); clearTimeout(state.disconnectTimer);
  cancelOutgoing(message); finishReceive(message);
  if (state.dc) { state.dc.onclose = null; state.dc.close(); }
  if (state.pc) { state.pc.onconnectionstatechange = null; state.pc.close(); }
  state.pc = state.dc = null; state.candidates = [];
  state.verified = state.peerVerified = state.sasReady = state.peerBatch = state.peerLargeFiles = false;
  $('verify').disabled = false; $('verify').textContent = '配对码一致，确认连接';
  $('peer-status').textContent = '等待加入'; setReady();
}
function ensurePeer() {
  if (state.pc) return state.pc;
  const pc = new RTCPeerConnection({ iceServers: state.ice,
    iceTransportPolicy: new URL(location.href).searchParams.get('relay') === '1' ? 'relay' : 'all' });
  state.pc = pc;
  state.iceTimer = setTimeout(() => { if (state.pc === pc && pc.connectionState !== 'connected') { resetPeer('连接超时，请新建房间重试。'); status('连接超时'); notify('两台设备未能建立连接，请新建房间重试。', true); } }, 45000);
  pc.onicecandidate = event => { if (event.candidate && state.pc === pc) { try { signal({ type: 'candidate', candidate: event.candidate }); } catch {} } };
  pc.ondatachannel = event => configureChannel(event.channel, pc);
  pc.onconnectionstatechange = () => {
    if (state.pc !== pc) return;
    if (pc.connectionState === 'connected') { clearTimeout(state.iceTimer); clearTimeout(state.disconnectTimer); }
    if (pc.connectionState === 'disconnected') state.disconnectTimer = setTimeout(() => {
      if (state.pc === pc && pc.connectionState === 'disconnected') { resetPeer(); status('连接中断'); notify('网络连接中断，请新建房间重新连接。', true); }
    }, 12000);
    if (pc.connectionState === 'failed') { resetPeer(); status('连接失败'); notify('连接失败，请检查网络后新建房间。', true); }
  };
  return pc;
}
async function offer() {
  resetPeer('正在重新连接。'); status('正在连接'); $('peer-status').textContent = '正在连接';
  const pc = ensurePeer(); configureChannel(pc.createDataChannel('quickdrop', { ordered: true }), pc);
  await pc.setLocalDescription(await pc.createOffer());
  if (state.pc === pc) signal({ type: 'offer', sdp: pc.localDescription });
}
async function handleSignal(data) {
  const pc = ensurePeer();
  if (data.type === 'offer') {
    status('正在连接'); await pc.setRemoteDescription(data.sdp);
    for (const candidate of state.candidates.splice(0)) await pc.addIceCandidate(candidate);
    await pc.setLocalDescription(await pc.createAnswer());
    if (state.pc === pc) signal({ type: 'answer', sdp: pc.localDescription });
  } else if (data.type === 'answer') {
    await pc.setRemoteDescription(data.sdp);
    for (const candidate of state.candidates.splice(0)) await pc.addIceCandidate(candidate);
  } else if (data.type === 'candidate') {
    if (pc.remoteDescription) await pc.addIceCandidate(data.candidate); else state.candidates.push(data.candidate);
  }
}
async function showSAS(pc) {
  // Bind the short code to the negotiated DTLS certificate fingerprints, not a server-selected value.
  const fingerprints = [pc.localDescription.sdp, pc.remoteDescription.sdp].map(sdp => {
    const matches = [...sdp.matchAll(/^a=fingerprint:sha-256 (.+)$/gmi)].map(match => match[1].trim().toUpperCase());
    if (!matches.length) throw new Error('无法核对设备身份，请重新连接。');
    return [...new Set(matches)].sort().join('|');
  }).sort();
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprints.join('|'))));
  if (state.pc !== pc) return;
  const code = (new DataView(bytes.buffer).getUint32(0) % 1000000).toString().padStart(6, '0');
  $('sas').textContent = `${code.slice(0, 3)} ${code.slice(3)}`; state.sasReady = true;
  status('请核对配对码'); $('peer-status').textContent = '等待确认'; setReady();
  const stats = await pc.getStats();
  let pair;
  stats.forEach(report => { if (report.type === 'transport' && report.selectedCandidatePairId) pair = stats.get(report.selectedCandidatePairId); });
  if (!pair) stats.forEach(report => { if (report.type === 'candidate-pair' && report.nominated && report.state === 'succeeded') pair = report; });
  const relay = pair && [stats.get(pair.localCandidateId), stats.get(pair.remoteCandidateId)].some(candidate => candidate?.candidateType === 'relay');
  $('network-path').textContent = relay ? '正在通过中继加密传输' : '设备之间加密直连';
}
function configureChannel(dc, pc) {
  if (state.pc !== pc) return;
  state.dc = dc; dc.binaryType = 'arraybuffer'; dc.bufferedAmountLowThreshold = 262144;
  dc.onopen = () => { sendControl({ type: 'hello', features: ['batch-v1', 'limits-v2'] }); showSAS(pc).catch(err => { notify(err.message, true); resetPeer(); }); };
  dc.onclose = () => { if (state.dc === dc) { resetPeer(); status('连接中断'); notify('对方已断开连接。双方保持页面打开，并重新配对。', true); } };
  dc.onerror = () => { if (state.dc === dc) notify('传输通道发生错误，请重试。'); };
  dc.onmessage = event => {
    state.messageQueue = state.messageQueue.then(async () => {
      if (state.dc !== dc) return;
      if (typeof event.data === 'string') {
        if (event.data.length > 65536) return;
        let message; try { message = JSON.parse(event.data); } catch { return; }
        if (message && typeof message === 'object') await control(message);
      } else await binary(event.data);
    }).catch(err => {
      try { if (state.incomingBatch) sendControl({ type: 'batch-error', id: state.incomingBatch.id }); else if (state.receiving) sendControl({ type: 'file-error', id: state.receiving.id }); } catch {}
      notify(err.message || '接收失败，请重试。'); finishReceive('接收失败，请重新发送。');
    });
  };
}
function touchReceive(receiver) {
  clearTimeout(receiver.timer);
  receiver.timer = setTimeout(() => {
    if (state.receiving !== receiver) return;
    try { sendControl({ type: 'file-error', id: receiver.id }); } catch {}
    finishReceive('接收超时，请重新发送。');
  }, 90000);
}
async function control(message) {
  if (message.type === 'hello') {
    state.peerBatch = Array.isArray(message.features) && message.features.includes('batch-v1');
    state.peerLargeFiles = Array.isArray(message.features) && message.features.includes('limits-v2'); return;
  }
  if (message.type === 'verify') { state.peerVerified = true; setReady(); return; }
  if (!state.connected) return;
  if (typeof message.type === 'string' && message.type.startsWith('batch-')) { await batchControl(message); return; }
  const current = state.outgoing;
  if (message.type === 'file-accept' && current?.id === message.id) current.accept.resolve();
  else if (message.type === 'file-reject' && current?.id === message.id) current.abort.abort(new Error('对方拒绝了文件。'));
  else if (message.type === 'file-ok' && current?.id === message.id) current.done.resolve();
  else if (message.type === 'file-error' && current?.id === message.id) current.abort.abort(new Error('对方接收失败，请重新发送。'));
  else if (message.type === 'file-cancel' && state.receiving?.id === message.id) finishReceive('发送方取消了传输。');
  else if (message.type === 'text') {
    if (typeof message.text !== 'string' || new TextEncoder().encode(message.text).length > 32768) return;
    const entry = item('收到一段文字', message.text);
    entry.actions.append(button('复制文字', () => copy(message.text)));
  } else if (message.type === 'file-meta') {
    if (typeof message.id !== 'string' || message.id.length > 80 || typeof message.name !== 'string' || message.name.length > 512 ||
      !Number.isSafeInteger(message.size) || message.size < 0 || message.size > MAX_FILE || !/^[a-f0-9]{64}$/.test(message.hash || '')) return;
    if (state.incomingBatch || message.batch) {
      const batch = state.incomingBatch, expected = batch?.files[batch.completed];
      if (!batch?.accepted || message.batch !== batch.id || state.receiving || !expected || expected.id !== message.id || expected.name !== message.name || expected.size !== message.size) {
        sendControl({ type: 'file-reject', id: message.id });
        if (batch) { sendControl({ type: 'batch-error', id: batch.id }); finishBatchReceive('这组文件的内容与确认清单不一致，已停止接收。'); }
        return;
      }
      clearTimeout(batch.timer);
      const receiver = { ...message, item: batch.item, chunks: [], bytes: 0, accepted: true, batch, crc32: 0 };
      state.receiving = receiver;
      batch.item.rows[batch.completed].textContent = '正在接收…';
      batch.item.current.textContent = `正在接收 ${batch.completed + 1}/${batch.files.length}：${message.name}`;
      sendControl({ type: 'file-accept', id: message.id }); touchReceive(receiver); return;
    }
    if (state.receiving) {
      sendControl({ type: 'file-reject', id: message.id }); notify('请先完成当前接收，再发送下一个任务。'); return;
    }
    const entry = item(message.name || '未命名文件', `${formatSize(message.size)} · 来自另一台设备`);
    const receiver = { ...message, item: entry, chunks: [], bytes: 0, accepted: false };
    state.receiving = receiver; setItemResult(entry, '是否接收这个文件？请仅接收你信任的内容。');
    const accept = button('接收文件', () => {
      if (state.receiving !== receiver) return;
      receiver.accepted = true; accept.disabled = reject.disabled = true;
      progress(entry); setItemResult(entry, '正在接收…'); sendControl({ type: 'file-accept', id: receiver.id }); touchReceive(receiver);
    }, 'primary');
    const reject = button('拒绝', () => {
      if (state.receiving !== receiver) return;
      sendControl({ type: 'file-reject', id: receiver.id }); finishReceive('已拒绝接收。', '');
    });
    receiver.actions = [accept, reject]; entry.actions.append(accept, reject); touchReceive(receiver);
  } else if (message.type === 'file-done' && state.receiving?.id === message.id) {
    const receiver = state.receiving;
    if (!receiver.accepted || receiver.bytes !== receiver.size) {
      sendControl({ type: 'file-error', id: receiver.id }); finishReceive('文件长度不一致，请重新发送。'); return;
    }
    clearTimeout(receiver.timer); setItemResult(receiver.item, '正在校验文件…');
    const blob = new Blob(receiver.chunks, { type: 'application/octet-stream' }); receiver.chunks = [];
    const hash = await sha256(await blob.arrayBuffer());
    if (state.receiving !== receiver) return;
    if (hash !== receiver.hash) {
      sendControl({ type: 'file-error', id: receiver.id }); finishReceive('文件校验失败，请重新发送。'); return;
    }
    if (receiver.batch) {
      const batch = receiver.batch;
      batch.blobs.push({ name: receiver.name, blob, crc32: receiver.crc32 });
      batch.item.rows[batch.completed].textContent = `${formatSize(receiver.size)} · 校验通过`;
      batch.completed++; batch.completedBytes += receiver.size; state.receiving = null;
      batchProgress(batch); setItemResult(batch.item, `已校验 ${batch.completed}/${batch.files.length} 个文件`);
      sendControl({ type: 'file-ok', id: receiver.id }); batchWait(batch); return;
    }
    attachDownload(receiver.item, blob, receiver.name.replace(/[\/\\\x00-\x1f]/g, '_') || 'download', '下载保存 ↓', receiver.size);
    progress(receiver.item).value = 1; setItemResult(receiver.item, '已接收 · SHA-256 校验通过，请点击下载保存。', 'success');
    sendControl({ type: 'file-ok', id: receiver.id }); state.receiving = null;
  }
}
async function batchControl(message) {
  const outgoing = state.outgoingBatch;
  if (outgoing?.id === message.id) {
    if (message.type === 'batch-accept') outgoing.accept.resolve();
    else if (message.type === 'batch-ok') outgoing.done.resolve();
    else if (message.type === 'batch-reject') outgoing.abort.abort(new Error('对方拒绝了这组文件。'));
    else if (message.type === 'batch-error' || message.type === 'batch-cancel') outgoing.abort.abort(new Error('这组文件未能完整接收，请重新发送。'));
    return;
  }
  if (message.type === 'batch-meta') {
    const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 80;
    const files = message.files;
    if (!validId(message.id) || !Array.isArray(files) || files.length < 1 || files.length > MAX_BATCH_FILES ||
      new TextEncoder().encode(JSON.stringify(message)).length > 48000 ||
      !files.every(file => file && validId(file.id) && typeof file.name === 'string' && file.name.length > 0 && file.name.length <= 512 && Number.isSafeInteger(file.size) && file.size >= 0 && file.size <= MAX_FILE) ||
      new Set(files.map(file => file.id)).size !== files.length || !Number.isSafeInteger(message.total) ||
      message.total !== files.reduce((sum, file) => sum + file.size, 0) || message.total > MAX_BATCH ||
      (message.part && (!validId(message.part.id) || !Number.isSafeInteger(message.part.index) || !Number.isSafeInteger(message.part.total) || message.part.index < 1 || message.part.index > message.part.total))) {
      if (validId(message.id)) sendControl({ type: 'batch-reject', id: message.id });
      notify('这组文件的清单或大小不符合要求，已拒绝接收。'); return;
    }
    if (state.receiving || state.incomingBatch) {
      sendControl({ type: 'batch-reject', id: message.id }); notify('请先完成当前接收，再发送下一组文件。'); return;
    }
    const entry = batchItem(files, 'inbox', message.part); entry.root.dataset.batchId = message.id;
    const batch = { id: message.id, files, total: message.total, part: message.part, item: entry, blobs: [], completed: 0, completedBytes: 0, accepted: false };
    state.incomingBatch = batch; batchWait(batch, 90000); setItemResult(entry, '正在准备整组接收…');
    try { batch.archive = await archiveAPI(); }
    catch {
      if (state.incomingBatch === batch) { sendControl({ type: 'batch-reject', id: batch.id }); finishBatchReceive('打包组件加载失败，请刷新页面后重试。'); }
      return;
    }
    if (state.incomingBatch !== batch) return;
    setItemResult(entry, '是否接收这组文件？确认一次即可接收整组，请仅接收你信任的内容。');
    entry.actions.append(button(`接收这组文件（${files.length} 个）`, () => {
      if (state.incomingBatch !== batch || batch.accepted) return;
      batch.accepted = true; entry.details.open = false; progress(entry);
      entry.actions.replaceChildren(button('取消接收', () => {
        if (state.incomingBatch !== batch) return;
        sendControl({ type: 'batch-cancel', id: batch.id }); finishBatchReceive('已取消接收这组文件。', '');
      }));
      setItemResult(entry, '已确认接收整组，等待发送…'); sendControl({ type: 'batch-accept', id: batch.id }); batchWait(batch);
    }, 'primary'), button('拒绝', () => {
      if (state.incomingBatch !== batch || batch.accepted) return;
      sendControl({ type: 'batch-reject', id: batch.id }); finishBatchReceive('已拒绝接收这组文件。', '');
    }));
  } else if (state.incomingBatch?.id === message.id) {
    const batch = state.incomingBatch;
    if (message.type === 'batch-cancel' || message.type === 'batch-error') { finishBatchReceive('这组传输已停止，没有生成下载压缩包。'); return; }
    if (message.type !== 'batch-done') return;
    if (!batch.accepted || state.receiving || batch.completed !== batch.files.length || batch.completedBytes !== batch.total) {
      sendControl({ type: 'batch-error', id: batch.id }); finishBatchReceive('这组文件未接收完整，没有生成下载压缩包。'); return;
    }
    clearTimeout(batch.timer); setItemResult(batch.item, '全部校验通过，正在生成压缩包…');
    const partName = batch.part?.total > 1 ? `-第${String(batch.part.index).padStart(String(batch.part.total).length, '0')}组` : '';
    const folder = `QuickDrop-${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15).replace('T', '-')}${partName}-${batch.id.slice(0, 6)}`;
    const zip = batch.archive.createZip(batch.blobs, folder);
    attachDownload(batch.item, zip, `${folder}.zip`, '打包下载 ZIP ↓', batch.total);
    progress(batch.item).value = 1; batch.item.details.open = false;
    batch.item.current.textContent = '解压后是一个文件夹，内含这次传输的全部文件。';
    setItemResult(batch.item, `${batch.files.length} 个文件全部接收并校验通过，请统一下载保存。`, 'success');
    batch.blobs = []; state.incomingBatch = null;
    // A lost acknowledgement must not remove an already verified ZIP download.
    try { sendControl({ type: 'batch-ok', id: batch.id }); } catch {}
  }
}
async function binary(data) {
  const receiver = state.receiving;
  if (!receiver?.accepted || !(data instanceof ArrayBuffer)) return;
  if (data.byteLength > CHUNK || receiver.bytes + data.byteLength > receiver.size) {
    sendControl({ type: 'file-error', id: receiver.id }); finishReceive('收到异常文件数据，已停止接收。'); return;
  }
  receiver.chunks.push(data); receiver.bytes += data.byteLength;
  if (receiver.batch) {
    receiver.crc32 = receiver.batch.archive.updateCrc32(receiver.crc32, new Uint8Array(data));
    batchProgress(receiver.batch, receiver.bytes);
    setItemResult(receiver.item, `${formatSize(receiver.batch.completedBytes + receiver.bytes)} / ${formatSize(receiver.batch.total)} · 已校验 ${receiver.batch.completed}/${receiver.batch.files.length} 个`);
  } else {
    progress(receiver.item).value = receiver.size ? receiver.bytes / receiver.size : 1;
    setItemResult(receiver.item, `${formatSize(receiver.bytes)} / ${formatSize(receiver.size)}`);
  }
  touchReceive(receiver);
}
async function sha256(data) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(value => value.toString(16).padStart(2, '0')).join(''); }
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
function waitFor(promise, signal, timeout, message) {
  return new Promise((resolve, reject) => {
    let timer;
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); };
    const abort = () => { cleanup(); reject(signal.reason || new Error('已取消。')); };
    if (signal.aborted) return abort();
    signal.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => { cleanup(); reject(new Error(message)); }, timeout);
    promise.then(value => { cleanup(); resolve(value); }, err => { cleanup(); reject(err); });
  });
}
function waitBuffer(dc, signal) {
  if (signal.aborted) return Promise.reject(signal.reason);
  if (dc.readyState !== 'open') return Promise.reject(new Error('连接已断开。'));
  if (dc.bufferedAmount < 1048576) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); dc.removeEventListener('bufferedamountlow', low); dc.removeEventListener('close', closed); signal.removeEventListener('abort', aborted); };
    const low = () => { cleanup(); resolve(); };
    const closed = () => { cleanup(); reject(new Error('连接已断开。')); };
    const aborted = () => { cleanup(); reject(signal.reason); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('网络发送超时。')); }, 60000);
    dc.addEventListener('bufferedamountlow', low, { once: true }); dc.addEventListener('close', closed, { once: true }); signal.addEventListener('abort', aborted, { once: true });
    if (dc.bufferedAmount <= dc.bufferedAmountLowThreshold) low();
  });
}
async function sendOne(file, batch = null) {
  const entry = batch ? batch.item : item(file.name, formatSize(file.size), 'outgoing');
  if (file.size > MAX_FILE) { setItemResult(entry, '超过单文件 512 MiB 上限。', 'error'); return false; }
  const transfer = { id: batch ? batch.files[batch.completed].id : crypto.randomUUID(), abort: batch ? batch.abort : new AbortController(), accept: deferred(), done: deferred() };
  state.outgoing = transfer;
  const dc = state.dc, generation = state.generation;
  const cancel = batch ? null : button('取消', () => transfer.abort.abort(new Error('已取消发送。')));
  if (cancel) entry.actions.append(cancel);
  try {
    if (batch) { entry.current.textContent = `正在发送 ${batch.completed + 1}/${batch.files.length}：${file.name}`; entry.rows[batch.completed].textContent = '准备发送…'; }
    setItemResult(entry, '正在计算文件校验值…');
    const hash = await waitFor(file.arrayBuffer().then(sha256), transfer.abort.signal, 90000, '文件读取超时。');
    if (generation !== state.generation) throw new Error('连接已改变，请重新发送。');
    sendControl({ type: 'file-meta', id: transfer.id, name: file.name, size: file.size, hash, ...(batch ? { batch: batch.id } : {}) });
    setItemResult(entry, batch ? '整组已获接收确认，正在传输…' : '等待对方接收…');
    await waitFor(transfer.accept.promise, transfer.abort.signal, 90000, '对方未确认接收，请重试。');
    const started = performance.now();
    for (let offset = 0; offset < file.size; offset += CHUNK) {
      await waitBuffer(dc, transfer.abort.signal);
      const chunk = await file.slice(offset, offset + CHUNK).arrayBuffer();
      if (transfer.abort.signal.aborted) throw transfer.abort.signal.reason;
      if (state.dc !== dc || dc.readyState !== 'open') throw new Error('连接已断开。');
      dc.send(chunk);
      const sent = Math.min(file.size, offset + chunk.byteLength);
      if (batch) {
        batchProgress(batch, sent); entry.rows[batch.completed].textContent = `${formatSize(sent)} / ${formatSize(file.size)}`;
        setItemResult(entry, `${formatSize(batch.completedBytes + sent)} / ${formatSize(batch.total)} · 已校验 ${batch.completed}/${batch.files.length} 个`);
      } else {
        progress(entry).value = Math.min(1, sent / file.size);
        setItemResult(entry, `${formatSize(sent)} / ${formatSize(file.size)} · 发送中`);
      }
    }
    sendControl({ type: 'file-done', id: transfer.id }); setItemResult(entry, '数据已发送，等待对方校验…');
    await waitFor(transfer.done.promise, transfer.abort.signal, 180000, '等待对方完成超时，请重试。');
    if (batch) {
      entry.rows[batch.completed].textContent = `${formatSize(file.size)} · 对方校验通过`;
      batch.completed++; batch.completedBytes += file.size; batchProgress(batch);
    } else {
      progress(entry).value = 1;
      setItemResult(entry, `对方已接收并通过校验 · ${((performance.now() - started) / 1000).toFixed(1)} 秒 · 等待对方自行下载保存`, 'success');
    }
    return true;
  } catch (err) {
    if (batch) throw err;
    setItemResult(entry, err.message || '发送失败。', 'error');
    if (state.dc === dc && dc?.readyState === 'open') { try { sendControl({ type: 'file-cancel', id: transfer.id }); } catch {} }
    return false;
  } finally { cancel?.remove(); if (state.outgoing === transfer) state.outgoing = null; }
}
async function sendBatch(files, part) {
  const entry = batchItem(files, 'outgoing', part);
  const batch = { id: crypto.randomUUID(), files: files.map(file => ({ id: crypto.randomUUID(), name: file.name, size: file.size })),
    total: files.reduce((sum, file) => sum + file.size, 0), item: entry, completed: 0, completedBytes: 0,
    abort: new AbortController(), accept: deferred(), done: deferred() };
  entry.root.dataset.batchId = batch.id;
  if (files.some(file => file.size > MAX_FILE)) { setItemResult(entry, '这组包含超过 512 MiB 的文件，整组未发送。', 'error'); return false; }
  if (batch.total > MAX_BATCH || files.length > MAX_BATCH_FILES) { setItemResult(entry, '这组文件超过 1024 MiB 或 50 个文件，未发送。', 'error'); return false; }
  const meta = { type: 'batch-meta', id: batch.id, total: batch.total, files: batch.files, part };
  if (new TextEncoder().encode(JSON.stringify(meta)).length > 48000) { setItemResult(entry, '文件名清单过长，请减少文件数量后重试。', 'error'); return false; }
  state.outgoingBatch = batch;
  const dc = state.dc;
  const cancel = button('取消整组发送', () => batch.abort.abort(new Error('已取消这组文件的发送。'))); entry.actions.append(cancel);
  try {
    sendControl(meta); setItemResult(entry, '等待对方一次确认接收整组…');
    await waitFor(batch.accept.promise, batch.abort.signal, 90000, '对方未确认接收这组文件，请重试。');
    for (const file of files) await sendOne(file, batch);
    sendControl({ type: 'batch-done', id: batch.id }); setItemResult(entry, '全部文件已发送，等待对方生成压缩包…');
    await waitFor(batch.done.promise, batch.abort.signal, 180000, '等待整组完成确认超时，请重试。');
    entry.current.textContent = ''; entry.details.open = false;
    setItemResult(entry, `对方已接收 ${files.length} 个文件并通过全部校验，可统一下载压缩包。`, 'success');
    return true;
  } catch (err) {
    stopBatchRows(batch); entry.current.textContent = ''; setItemResult(entry, err.message || '这组文件发送失败。', 'error');
    if (state.dc === dc && dc?.readyState === 'open') { try { sendControl({ type: 'batch-cancel', id: batch.id }); } catch {} }
    return false;
  } finally { cancel.remove(); if (state.outgoingBatch === batch) state.outgoingBatch = null; }
}
async function sendFiles(files) {
  if (!files.length || !state.connected || state.sending) return;
  if (files.length > 1 && !state.peerBatch) { notify('对方仍在使用旧版页面，请双方刷新并重新配对后使用整组传输。'); return; }
  let groups;
  try { groups = planTransfers(files); }
  catch (error) { const entry = item('这次选择未发送', '', 'outgoing'); setItemResult(entry, error.message, 'error'); $('files').value = ''; return; }
  if (!state.peerLargeFiles && (files.some(file => file.size > 100 * MIB) || groups.some(group => group.total > 300 * MIB) || groups.length > 1)) {
    notify('对方仍使用旧版大小限制，请双方刷新页面并重新配对。'); return;
  }
  const selection = crypto.randomUUID();
  if (groups.length > 1) notify(`已按文件名自然排序，自动拆成 ${groups.length} 组；每组最多 1024 MiB、50 个文件。`);
  state.sending = true; setReady();
  try {
    for (let index = 0; index < groups.length; index++) {
      if (!state.connected) break;
      const ok = files.length > 1 ? await sendBatch(groups[index].files, { id: selection, index: index + 1, total: groups.length }) : await sendOne(groups[index].files[0]);
      if (!ok) { if (index + 1 < groups.length) notify(`本组未完成，后续 ${groups.length - index - 1} 组已停止发送。`); break; }
    }
  }
  finally { state.sending = false; $('files').value = ''; setReady(); }
}
async function copy(value) {
  try { await navigator.clipboard.writeText(value); notify('已复制。'); }
  catch { notify('浏览器未允许自动复制，请长按或选中后手动复制。'); $('pair-link').select(); }
}
function connect() {
  clearTimeout(state.reconnect); status('连接中');
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/quickdrop/ws`);
  state.ws = ws;
  ws.onopen = () => { state.retries = 0; ws.send(JSON.stringify(state.room ? { type: 'join', room: state.room } : { type: 'create' })); };
  ws.onmessage = event => {
    if (state.ws !== ws) return;
    let message; try { message = JSON.parse(event.data); } catch { return; }
    state.signalQueue = state.signalQueue.then(async () => {
      if (state.ws !== ws) return;
      if (message.type === 'joined') {
        state.room = message.room; state.ice = message.iceServers;
        const url = new URL(location.href); url.searchParams.set('room', state.room); history.replaceState(null, '', url);
        // Deliberately omit diagnostics options from shared pairing links.
        const link = `${location.origin}/quickdrop/?room=${state.room}`;
        $('pair-link').value = link; $('copy-link').disabled = false;
        $('qr').src = `/quickdrop/qr?room=${state.room}`; $('qr').hidden = false; $('qr-loading').hidden = true;
        $('room-expiry').textContent = `房间有效至 ${new Date(message.expires).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        status('等待加入'); $('notice').hidden = true;
      } else if (message.type === 'peer-joined') await offer();
      else if (message.type === 'signal') await handleSignal(message.data);
      else if (message.type === 'peer-left') { resetPeer('对方已离开，传输已中止。'); status('等待加入'); }
      else if (message.type === 'error') { notify(message.message, true); status('无法加入'); }
    }).catch(err => { notify(err.message || '连接异常，请新建房间重试。', true); resetPeer(); status('连接异常'); });
  };
  ws.onclose = event => {
    if (state.ws !== ws) return;
    resetPeer('信令连接中断，当前传输已停止。'); status('连接中断');
    if (event.code === 1000) { notify('房间已过期，请点击“新建房间”。', true); return; }
    const delay = Math.min(30000, 1000 * 2 ** state.retries++);
    notify('连接中断，正在尝试重新连接…', true); state.reconnect = setTimeout(connect, delay);
  };
  ws.onerror = () => { if (state.ws === ws) notify('无法连接服务，正在重试…', true); };
}
$('verify').addEventListener('click', () => {
  if (!state.sasReady || state.dc?.readyState !== 'open') return;
  state.verified = true; sendControl({ type: 'verify' });
  $('verify').disabled = true; $('verify').textContent = '已确认，等待另一台设备确认…'; setReady();
});
$('new-room').addEventListener('click', () => {
  if ((state.sending || state.receiving || state.incomingBatch) && !confirm('新建房间会中止当前传输，确定继续？')) return;
  resetPeer('已新建房间，当前传输已中止。');
  if (state.ws?.readyState === WebSocket.OPEN) state.ws.send(JSON.stringify({ type: 'create' }));
  else { if (state.ws) { state.ws.onclose = null; state.ws.close(); } state.room = null; connect(); }
});
$('copy-link').addEventListener('click', () => copy($('pair-link').value));
$('files').addEventListener('change', event => sendFiles([...event.target.files]));
for (const name of ['dragenter', 'dragover']) $('dropzone').addEventListener(name, event => { event.preventDefault(); if (state.connected && !state.sending) $('dropzone').classList.add('drag'); });
for (const name of ['dragleave', 'drop']) $('dropzone').addEventListener(name, event => { event.preventDefault(); $('dropzone').classList.remove('drag'); });
$('dropzone').addEventListener('drop', event => sendFiles([...event.dataTransfer.files]));
window.addEventListener('dragover', event => event.preventDefault()); window.addEventListener('drop', event => event.preventDefault());
$('text').addEventListener('input', () => { $('text-count').textContent = `${(new TextEncoder().encode($('text').value).length / 1024).toFixed(1)} / 32 KiB`; });
$('send-text').addEventListener('click', () => {
  const text = $('text').value;
  if (!text.trim() || !state.connected) return;
  if (new TextEncoder().encode(text).length > 32768) return notify('文字超过 32 KiB，请缩短后发送。');
  sendControl({ type: 'text', text }); $('text').value = ''; $('text-count').textContent = '0 / 32 KiB'; notify('文字已发送。');
});
window.addEventListener('beforeunload', event => { if (state.sending || state.receiving || state.incomingBatch) { event.preventDefault(); event.returnValue = ''; } });
if (!window.RTCPeerConnection || !window.crypto?.subtle || !window.isSecureContext) {
  status('浏览器不支持'); notify('请使用最新版 Safari、Chrome 或 Edge，并通过 HTTPS 打开本页。', true); $('new-room').disabled = true;
} else connect();
