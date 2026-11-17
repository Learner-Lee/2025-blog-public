const { chromium } = await import('playwright').catch(() => import('/tmp/quickdrop-test-tools/node_modules/playwright/index.mjs'));
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const context = await browser.newContext(); const page = await context.newPage();
await page.addInitScript(() => {
  const Native = window.WebSocket;
  window.WebSocket = class extends Native {
    constructor(...args) {
      super(...args);
      this.addEventListener('message', event => {
        try { const message = JSON.parse(event.data); if (message.type === 'joined') window.__probeIce = message.iceServers; } catch {}
      });
    }
  };
});
try {
  await page.goto('https://web.alenli.cn/quickdrop/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => document.getElementById('pair-link').value.includes('room='));
  const result = await page.evaluate(async () => {
    const turn = window.__probeIce.find(server => server.username);
    if (!turn) return { error: 'No TURN configuration' };
    const output = [];
    for (const url of turn.urls) {
      const pc = new RTCPeerConnection({ iceServers: [{ ...turn, urls: [url] }], iceTransportPolicy: 'relay' });
      const candidates = [], errors = [];
      pc.createDataChannel('probe');
      pc.onicecandidate = event => { if (event.candidate) candidates.push({ type: event.candidate.type, protocol: event.candidate.protocol }); };
      pc.onicecandidateerror = event => errors.push({ code: event.errorCode, text: event.errorText });
      await pc.setLocalDescription(await pc.createOffer());
      await new Promise(resolve => { const timer = setTimeout(resolve, 20000); pc.onicegatheringstatechange = () => { if (pc.iceGatheringState === 'complete') { clearTimeout(timer); resolve(); } }; });
      output.push({ url, candidates, errors }); pc.close();
    }
    return output;
  });
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
