import { spawn } from 'node:child_process';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
for (const w of [360, 390]) {
  const port = 9340 + w;
  const chrome=spawn(CHROME,['--headless=new','--disable-gpu','--no-first-run',`--user-data-dir=L:/ai_projects/HMM/.shots/cdp-${w}`,`--remote-debugging-port=${port}`,`--window-size=${w},780`,'http://127.0.0.1:5173/settings'],{stdio:'ignore'});
  let wsUrl;
  for(let i=0;i<40;i++){await sleep(300);try{const l=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();const p=l.find(t=>t.type==='page');if(p){wsUrl=p.webSocketDebuggerUrl;break;}}catch{}}
  const ws=new WebSocket(wsUrl);let id=0;const pend=new Map();
  const send=(m,p={})=>new Promise((res,rej)=>{const i=++id;pend.set(i,{res,rej});ws.send(JSON.stringify({id:i,method:m,params:p}));});
  ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){const{res,rej}=pend.get(m.id);pend.delete(m.id);m.error?rej(new Error(JSON.stringify(m.error))):res(m.result);}});
  await new Promise(r=>ws.addEventListener('open',r));
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:w,height:780,deviceScaleFactor:2,mobile:true});
  await sleep(1800);
  const ev=async(e)=>(await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true})).result?.value;
  console.log(w, JSON.stringify(await ev(`({innerW:innerWidth, scrollW:document.documentElement.scrollWidth, barBottom: Math.round(document.querySelector('.tabbar').getBoundingClientRect().bottom), lastLabel: Math.round([...document.querySelectorAll('.tab span')].pop().getBoundingClientRect().bottom)})`)));
  ws.close(); chrome.kill(); await sleep(400);
}
