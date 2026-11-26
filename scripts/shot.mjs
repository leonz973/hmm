// 截图：指定主题/宽度/路径，用于视觉核对
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const [theme = 'light', w = '1440', h = '900', out = '.shots/shot.png', path = '/'] = process.argv.slice(2);
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9340 + Math.floor(Math.random() * 30);

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${port}`, '--user-data-dir=L:/ai_projects/HMM/.shots/shot-profile',
  `--window-size=${w},${h}`, 'about:blank',
], { stdio: 'ignore' });

let wsUrl;
for (let i = 0; i < 40; i++) {
  await sleep(300);
  try {
    const r = await fetch(`http://127.0.0.1:${port}/json/list`);
    const page = (await r.json()).find((t) => t.type === 'page');
    if (page) { wsUrl = page.webSocketDebuggerUrl; break; }
  } catch {}
}
if (!wsUrl) { console.log('no devtools'); chrome.kill(); process.exit(1); }

const ws = new WebSocket(wsUrl);
let id = 0; const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => {
  const mid = ++id; pending.set(mid, { res, rej });
  ws.send(JSON.stringify({ id: mid, method, params }));
});
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id); pending.delete(m.id);
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
  }
});
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 1, mobile: +w < 600 });
await send('Page.navigate', { url: 'http://127.0.0.1:5173/' });
await sleep(900);
await send('Runtime.evaluate', { expression: `localStorage.setItem('hmm-theme','${theme}')` });
await send('Page.navigate', { url: 'http://127.0.0.1:5173' + path });
await sleep(1500);
const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
writeFileSync(out, Buffer.from(shot.data, 'base64'));
console.log('saved', out);
ws.close(); chrome.kill();
