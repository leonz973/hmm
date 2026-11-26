// 给 localStorage 塞演示数据后截图（用于目标/保险页等空态页）
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const [theme = 'light', w = '1440', h = '1000', out = '.shots/seed.png', path = '/goals'] = process.argv.slice(2);
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9400 + Math.floor(Math.random() * 40);

const chrome = spawn(CHROME, ['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',
  `--remote-debugging-port=${port}`,'--user-data-dir=L:/ai_projects/HMM/.shots/seed-profile',`--window-size=${w},${h}`,'about:blank'], { stdio: 'ignore' });
let wsUrl;
for (let i = 0; i < 40; i++) { await sleep(300); try { const r = await fetch(`http://127.0.0.1:${port}/json/list`); const p = (await r.json()).find(t => t.type === 'page'); if (p) { wsUrl = p.webSocketDebuggerUrl; break; } } catch {} }
if (!wsUrl) { console.log('no devtools'); chrome.kill(); process.exit(1); }
const ws = new WebSocket(wsUrl); let id = 0; const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => { const mid = ++id; pending.set(mid, { res, rej }); ws.send(JSON.stringify({ id: mid, method, params })); });
ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 1, mobile: +w < 600 });
await send('Page.navigate', { url: 'http://127.0.0.1:5173/' }); await sleep(900);
const seed = `
localStorage.setItem('hmm-theme','${theme}');
localStorage.setItem('hmm.savingGoals.v1', JSON.stringify([
 {id:'g1',name:'换车首付',targetFen:8000000,savedFen:2500000,targetDate:'2027-06-01',createdAt:'2026-01-01'},
 {id:'g2',name:'明年欧洲旅行',targetFen:4000000,savedFen:600000,targetDate:'2027-08-01',createdAt:'2026-03-01'}
]));
localStorage.setItem('hmm.insurance.v1', JSON.stringify([
 {id:'p1',name:'家庭财产险',kind:'家财险',company:'中国人保',coverageFen:100000000,premiumFen:68000,cycle:'每年',startDate:'2025-12-20',endDate:'2026-12-20',contact:'95518',createdAt:'2025-12-20'},
 {id:'p2',name:'全家医疗险',kind:'医疗险',company:'平安',coverageFen:60000000,premiumFen:420000,cycle:'每年',startDate:'2026-03-01',endDate:'2027-03-01',createdAt:'2026-03-01'}
]));
`;
await send('Runtime.evaluate', { expression: seed });
await send('Page.navigate', { url: 'http://127.0.0.1:5173' + path }); await sleep(1500);
const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
writeFileSync(out, Buffer.from(shot.data, 'base64')); console.log('saved', out);
ws.close(); chrome.kill();
