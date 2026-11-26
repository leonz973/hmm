import { spawn } from 'node:child_process';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const chrome=spawn(CHROME,['--headless=new','--disable-gpu','--no-first-run','--user-data-dir=L:/ai_projects/HMM/.shots/cdp4','--remote-debugging-port=9336','--window-size=390,844','http://127.0.0.1:5173/settings'],{stdio:'ignore'});
let wsUrl;
for(let i=0;i<40;i++){await sleep(300);try{const l=await(await fetch('http://127.0.0.1:9336/json/list')).json();const p=l.find(t=>t.type==='page');if(p){wsUrl=p.webSocketDebuggerUrl;break;}}catch{}}
const ws=new WebSocket(wsUrl);let id=0;const pend=new Map();
const send=(m,p={})=>new Promise((res,rej)=>{const i=++id;pend.set(i,{res,rej});ws.send(JSON.stringify({id:i,method:m,params:p}));});
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){const{res,rej}=pend.get(m.id);pend.delete(m.id);m.error?rej(new Error(JSON.stringify(m.error))):res(m.result);}});
await new Promise(r=>ws.addEventListener('open',r));
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
await sleep(2200);
const ev=async(e)=>(await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true})).result?.value;
console.log(JSON.stringify(await ev(`(()=>{
  const bar=document.querySelector('.tabbar').getBoundingClientRect();
  const tabs=[...document.querySelectorAll('.tab')].map(t=>{const r=t.getBoundingClientRect();return{t:t.innerText.trim(),x:Math.round(r.x),w:Math.round(r.width),bottom:Math.round(r.bottom),label:Math.round(t.querySelector('span').getBoundingClientRect().bottom)};});
  return {innerW:innerWidth,innerH:innerHeight,bar:{top:Math.round(bar.top),bottom:Math.round(bar.bottom),h:Math.round(bar.height)},tabs};
})()`),null,2));
ws.close();chrome.kill();
