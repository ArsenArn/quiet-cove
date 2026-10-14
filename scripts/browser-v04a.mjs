import {chromium,expect} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const url=process.env.SMOKE_URL??'http://127.0.0.1:4184',output='test-results/v04a/browser';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:process.env.BROWSER_CHANNEL??'msedge'}:{})});
const errors=[],checks=[];
try{
 for(const profile of ['fast','reference']){
  const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`${url}/?debug=1&balance=${profile}`);await page.waitForFunction(()=>window.__fishing?.ui);
  const config=await page.evaluate(()=>window.__fishing.engine.config);assert.equal(config.profile,profile);assert.equal(config.resources.sardine.value,profile==='fast'?2:1);assert.equal(config.special.combat.cost,profile==='fast'?2200:12000);assert.equal(config.expansion.route.cost,profile==='fast'?14000:60000);if(profile==='reference')assert.deepEqual(config.salvage.worker.timers_s,[120,300]);
  await page.keyboard.press('F2');await expect(page.locator('#profile')).toHaveValue(profile);
  // Technical fixture, no pacing measurements: old saved contract and pending money.
  await page.evaluate(()=>{
   const f=window.__fishing,s=f.engine.state;f.scene.waypoint=null;s.questIndex=15;s.questStatus='completed_unclaimed';s.area=2;s.coins=7;s.metal=12;s.flags.den=true;
   s.orders.defender={id:'defender',cost:12000,paid:1200,metalCost:0,metalPaid:0,duration:120,readyAt:null,complete:false};
   s.orders['resource:tuna']={id:'resource:tuna',cost:1800,paid:1800,metalCost:0,metalPaid:0,duration:96,readyAt:s.time+90,complete:false};
   const p=s.boats[0];Object.assign(p,{x:1400,y:1750});s.coinStacks.push({id:s.nextId++,value:83,source:'fish_sale',x:1500,y:1750,availableAt:s.time+.1,attracting:false});f.persist();
  });
  await page.reload();await page.waitForFunction(()=>window.__fishing?.ui);
  let state=await page.evaluate(()=>window.__fishing.engine.state);assert.equal(state.orders.defender.cost,12000);assert.equal(state.orders.defender.paid,1200);assert.equal(state.orders.defender.duration,120);assert.equal(state.questStatus,'completed_unclaimed');assert.equal(state.coins,7);assert.equal(state.coinStacks[0].value,83);
  await page.evaluate(()=>window.__fishing.scene.navigate(1500,1750));await page.waitForFunction(()=>window.__fishing.engine.state.coinStacks.length===0);assert.equal(await page.evaluate(()=>window.__fishing.engine.state.coins),90);
  await page.waitForTimeout(300);await page.screenshot({path:`${output}/${profile}-pending.png`});
  await page.locator('#quest-title').click();await page.waitForFunction(()=>window.__fishing.engine.state.questIndex===16);const wallet=await page.evaluate(()=>window.__fishing.engine.state.coins);assert.equal(wallet,90+config.quests[15].reward_coins);await page.reload();await page.waitForFunction(()=>window.__fishing?.ui);assert.equal(await page.evaluate(()=>window.__fishing.engine.state.coins),wallet);
  checks.push(`${profile}: production JSON / F2 / old partial contract / construction deadline / pending physical cash / claim once through reload`);
  await context.close();
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(`${output}/smoke.json`,JSON.stringify({result:'passed',checks,consoleErrors:errors,limit:'Technical browser fixtures, not natural pacing; independent contexts leave user saves untouched.'},null,2)+'\n');console.log(JSON.stringify({result:'passed',checks,consoleErrors:errors},null,2));
}finally{await browser.close();}
