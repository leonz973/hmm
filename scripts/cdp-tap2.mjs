import { spawn } from 'node:child_process';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const url = process.argv[2] ?? 'http://127.0.0.1:4173/';
const taps = (process.argv[3] ?? '资产,账目,日历,我的').split(',');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, ['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',
  '--remote-debugging-port=9334','--user-data-dir=L:/ai_projects/HMM/.shots/cdp2','--window-size=390,844', url], { stdio: 'ignore' });
let wsUrl;
for (let i=0;i<40;i++){ await sleep(300); try { const l = await (await fetch('http://127.0.0.1:9334/json/list')).json(); const p=l.find(t=>t.type==='page'); if(p){wsUrl=p.webSocketDebuggerUrl;break;} } catch {} }
const ws = new WebSocket(wsUrl); let id=0; const pend=new Map(); const logs=[];
const send=(method,params={})=>new Promise((res,rej)=>{const mid=++id;pend.set(mid,{res,rej});ws.send(JSON.stringify({id:mid,method,params}));});
ws.addEventListener('message',(ev)=>{const m=JSON.parse(ev.data);
  if(m.method==='Runtime.exceptionThrown') logs.push('EXC '+(m.params.exceptionDetails?.exception?.description||m.params.exceptionDetails?.text));
  if(m.method==='Runtime.consoleAPICalled' && ['error','warning'].includes(m.params.type)) logs.push(m.params.type.toUpperCase()+' '+m.params.args.map(a=>a.value??a.description).join(' ').slice(0,200));
  if(m.id&&pend.has(m.id)){const{res,rej}=pend.get(m.id);pend.delete(m.id);m.error?rej(new Error(JSON.stringify(m.error))):res(m.result);}});
await new Promise(r=>ws.addEventListener('open',r));
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
const ev=async(e)=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});return r.result?.value;};
await sleep(2000);
await send('Page.reload',{ignoreCache:false}); await sleep(2500);
const sw = await ev(`!!navigator.serviceWorker?.controller`);
const start = await ev(`location.pathname`);
const out=[{start, swControlled: sw}];
for (const label of taps) {
  const rect = await ev(`(()=>{const el=[...document.querySelectorAll('.tab')].find(e=>e.innerText.trim()==='${label}');if(!el)return null;const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  if(!rect){ out.push({label, err:'no tab'}); continue; }
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect.x,y:rect.y}]});
  await sleep(60);
  await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await sleep(900);
  out.push({ label, path: await ev('location.pathname'), head: (await ev(`document.querySelector('main')?.innerText.slice(0,18)`)||'').replace(/\n/g,'|') });
}
console.log(JSON.stringify({out, logs: logs.slice(0,12)},null,2));
ws.close(); chrome.kill();
