import {chromium} from '@playwright/test';
import fs from 'node:fs';
const label=process.argv[2]??'before',url=process.argv[3]??'http://127.0.0.1:4198',seconds=Number(process.env.PROFILE_SECONDS??1200);
const out=`test-results/v07f/${label}`;fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--enable-precise-memory-info','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
const errors=[],cases=[];
try {
 for(const analytics of [false,true]){
  const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(`${url}/?debug=1&balance=fast`);await page.waitForFunction(()=>window.__fishing?.ui);
  const fresh=await page.evaluate(()=>({objects:window.__fishing.scene.children.length,heap:performance.memory?.usedJSHeapSize}));
  await page.evaluate(async analytics=>{
   const f=window.__fishing,e=f.engine,s=e.state,c=e.config,{makeBoat}=await import('/src/game/state.ts');
   s.area=2;s.questIndex=33;s.flags.storage=true;s.flags.cutter=true;s.flags.storageUpgrade=true;s.flags.secondPort=true;s.golden.nextAt=1e9;s.cargoLevel=4;
   for(const n of Object.values(s.nodes))n.unlocked=true;
   for(let i=0;i<6;i++)s.boats.push(makeBoat(`worker:${i}`,'worker',{x:2380+i*40,y:1500}));
   s.boats.push(makeBoat('speedboat','speedboat',{x:2400,y:1500}));for(let i=0;i<2;i++)s.boats.push(makeBoat(`salvage:${i}`,'salvage',{x:2520+i*42,y:1560}));
   s.defender=makeBoat('defender','player',c.combat.defender_spawn,c.combat.defender_hp);Object.assign(s.boats[0],{x:2590,y:1450});
   f.scene.guidance.cancel();f.scene.cancelControl();f.scene.cameras.main.setZoom(.65);
   if(analytics){f.analytics.setVisible(true);f.analytics.start();}
   window.__profile={frames:[],cpu:[],draw:[],events:[],samples:[],since:performance.now(),last:performance.now()};
   const measure=(obj,key,list)=>{const fn=obj[key].bind(obj);obj[key]=(...args)=>{const start=performance.now(),r=fn(...args);list.push(performance.now()-start);return r;};};
   measure(e,'update',window.__profile.cpu);measure(f.scene,'drawWorld',window.__profile.draw);measure(f.scene,'drawEvents',window.__profile.events);
   // Test-only collection circuit and metal spending sink keep logistics active, with no grants.
   window.__circuit=setInterval(()=>{if(s.metal>=80)s.metal-=80;const target=s.coinStacks[0];if(target)f.scene.navigate(target.x,target.y);},1000);
   requestAnimationFrame(function frame(now){window.__profile.frames.push(now-window.__profile.last);window.__profile.last=now;requestAnimationFrame(frame);});
  },analytics);
  const cdp=await context.newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.start');cases.push({analytics,page,context,cdp,fresh,samples:[]});
 }
 for(let elapsed=0;elapsed<=seconds;elapsed+=30){
  if(elapsed)await new Promise(r=>setTimeout(r,30000));
  for(const item of cases){
   if(elapsed===seconds-30)await item.cdp.send('Profiler.start');
   if(elapsed===seconds){const {profile}=await item.cdp.send('Profiler.stop');fs.writeFileSync(`${out}/cpu-final-${item.analytics?'on':'off'}.json`,JSON.stringify(profile));}
   if(elapsed===30){const {profile}=await item.cdp.send('Profiler.stop');fs.writeFileSync(`${out}/cpu-${item.analytics?'on':'off'}.json`,JSON.stringify(profile));}
   const sample=await item.page.evaluate(async()=>{
    const f=window.__fishing,p=window.__profile,s=f.engine.state,{trafficMetrics}=await import('/src/game/systems/traffic.ts');
    const stats=a=>{const sorted=a.sort((a,b)=>a-b);return {n:a.length,mean:a.reduce((a,b)=>a+b,0)/Math.max(1,a.length),p95:sorted[Math.floor(sorted.length*.95)]??0,max:sorted.at(-1)??0};};
    const r={elapsed:(performance.now()-p.since)/1000,game:s.time,frame:stats(p.frames),engine:stats(p.cpu),draw:stats(p.draw),events:stats(p.events),heap:performance.memory?.usedJSHeapSize,objects:f.scene.children.length,crates:s.crates.length,coins:s.coinStacks.length,coinValue:s.coinStacks.reduce((a,b)=>a+b.value,0),views:f.scene.crateViews.size,flights:f.scene.effects.flights.length,feedback:f.scene.effects.feedback.length,particles:f.scene.effects.particles.filter(p=>p.active).length,eventHistory:s.events.length,deliveries:s.stats.deliver_fish??0,earned:s.stats.fish_sales_earned??0,traffic:trafficMetrics(s),analytics:f.analytics.status,analyticsEvents:f.analytics.eventCount,crateAttribution:Object.keys(f.analytics.recording?.checkpoint.crate_resources??{}).length,coinAttribution:Object.keys(f.analytics.recording?.checkpoint.coin_origins??{}).length,analyticsWarning:f.analytics.warning};
    p.frames.length=0;p.cpu.length=0;p.draw.length=0;p.events.length=0;return r;
   });item.samples.push(sample);
  }
  fs.writeFileSync(`${out}/performance.json`,JSON.stringify({label,seconds,errors,cases:cases.map(({analytics,fresh,samples})=>({analytics,fresh,samples}))},null,2));
  if(elapsed%120===0)console.log(label,elapsed,cases.map(c=>({on:c.analytics,...c.samples.at(-1)})));
 }
 for(const c of cases){await c.cdp.send('HeapProfiler.collectGarbage');const heap=await c.cdp.send('Runtime.getHeapUsage');c.samples.at(-1).gcHeap=heap;await c.page.screenshot({path:`${out}/final-${c.analytics?'on':'off'}.png`});}
 fs.writeFileSync(`${out}/performance.json`,JSON.stringify({label,seconds,errors,cases:cases.map(({analytics,fresh,samples})=>({analytics,fresh,samples}))},null,2));
}finally{await browser.close();}
