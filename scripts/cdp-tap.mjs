// 用 CDP 在移动端模拟下真实点一下底部 tab，检查路由是否真的切换
import { spawn } from 'node:child_process';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const url = process.argv[2] ?? 'http://127.0.0.1:5173/';
const tapLabel = process.argv[3] ?? '资产';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=9333', '--user-data-dir=L:/ai_projects/HMM/.shots/cdp',
  '--window-size=390,844', url,
], { stdio: 'ignore' });

let wsUrl;
for (let i = 0; i < 40; i++) {
  await sleep(300);
  try {
    const r = await fetch('http://127.0.0.1:9333/json/list');
    const list = await r.json();
    const page = list.find((t) => t.type === 'page');
    if (page) { wsUrl = page.webSocketDebuggerUrl; break; }
  } catch {}
}
if (!wsUrl) { console.log('no devtools'); chrome.kill(); process.exit(1); }

const ws = new WebSocket(wsUrl);
let id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => {
  const mid = ++id;
  pending.set(mid, { res, rej });
  ws.send(JSON.stringify({ id: mid, method, params }));
});
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
  }
});
await new Promise((r) => ws.addEventListener('open', r));
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await sleep(2500);

const evalJs = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  return r.result?.value;
};

const before = await evalJs(`({ path: location.pathname, head: document.querySelector('main')?.innerText.slice(0, 24) })`);
const rect = await evalJs(`(() => {
  const el = [...document.querySelectorAll('.tab')].find(e => e.innerText.trim() === '${tapLabel}');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
})()`);
if (!rect) { console.log('tab not found'); chrome.kill(); process.exit(1); }

await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: rect.x, y: rect.y }] });
await sleep(60);
await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await sleep(1200);

const after = await evalJs(`({ path: location.pathname, head: document.querySelector('main')?.innerText.slice(0, 24) })`);
console.log(JSON.stringify({ before, tap: tapLabel, after }, null, 2));
ws.close();
chrome.kill();
