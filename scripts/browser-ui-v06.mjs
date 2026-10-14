import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const mode=process.argv[2]??'visual',output=process.env.UI_OUTPUT??'test-results/v06-approved';
fs.mkdirSync(output,{recursive:true});fs.mkdirSync('.local',{recursive:true});
process.env.SMOKE_URL??='http://127.0.0.1:4196';process.env.SMOKE_OUTPUT=`${output}/gameplay`;
if(mode==='gameplay'||mode==='ux'){
 let source=fs.readFileSync(`scripts/${mode==='gameplay'?'browser-smoke':'browser-v032'}.mjs`,'utf8');
 if(mode==='ux')source=source.replaceAll('test-results/v032-',`${output}/ux-`);
 const target=`.local/browser-ui-v06-${mode}.mjs`;fs.writeFileSync(target,source);await import(pathToFileURL(path.resolve(target)));
}else if(mode==='visual'){
 const {chromium,expect}=await import('@playwright/test');const assert=(await import('node:assert/strict')).default;
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 try{
  await page.goto(`${process.env.SMOKE_URL}/?debug=1`);await page.waitForFunction(()=>window.__fishing?.ui);await page.keyboard.press('F2');
  await page.evaluate(()=>{const f=window.__fishing;f.engine.paused=true;f.scene.stopGuidance();f.ui.render()});
  await expect(page.locator('#metal-stat')).toBeHidden();
  await page.waitForTimeout(100);await page.screenshot({path:`${output}/desktop.png`});
  const initial=await page.evaluate(()=>structuredClone(window.__fishing.engine.state));
  for(const [width,height] of [[320,740],[360,800],[390,844],[700,900],[820,900],[1024,768],[1440,900],[844,390]]){
   await page.setViewportSize({width,height});
   for(const unlocked of [false,true]){
    await page.evaluate(({initial,unlocked})=>{const f=window.__fishing;f.engine.state=structuredClone(initial);const s=f.engine.state;s.flags.storage=unlocked;s.metal=13;s.coins=123456;f.ui.render()}, {initial,unlocked});
    await page.waitForTimeout(80);
    const layout=await page.evaluate(()=>{const selectors=['.hud','.brand','.currency','.utility','#cargo-stat','#workers',...window.__fishing.engine.state.flags.storage?['#metal-stat']:[]];return {width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,buttons:[...document.querySelectorAll('.navigation button:not([hidden]),.shop-toggle')].map(e=>e.getBoundingClientRect().toJSON()),boxes:selectors.map(selector=>{const e=document.querySelector(selector),r=e.getBoundingClientRect();return {selector,x:r.x,y:r.y,right:r.right,bottom:r.bottom,scroll:e.scrollWidth,client:e.clientWidth}}),hud:document.querySelector('.hud').getBoundingClientRect().toJSON(),quest:document.querySelector('.quest-card').getBoundingClientRect().toJSON()}});
    assert.equal(layout.overflow,false,`${width}: page overflow`);
    for(const b of layout.boxes){assert.ok(b.x>=layout.hud.x-1&&b.right<=layout.hud.right+1,`${width} ${unlocked} ${b.selector} outside HUD ${JSON.stringify(b)}`)}
    for(const b of layout.buttons){assert.ok(b.x>=0&&b.right<=width&&b.y>=layout.quest.bottom&&b.bottom<=height,`${width}: action outside usable viewport ${JSON.stringify(b)}`);assert.ok(b.width>=44&&b.height>=44,`${width}: touch target too small`);}
    for(const b of layout.boxes.filter(b=>['#cargo-stat','#workers','#metal-stat'].includes(b.selector)))assert.ok(b.scroll<=b.client+1,`${width}: counter text overflow ${JSON.stringify(b)}`);
    assert.ok(layout.quest.y>=layout.hud.bottom+6,`${width}: quest overlaps HUD`);
   }
  }
  checks.push('8 viewport sizes, locked/unlocked metal, six-digit currency; HUD containment and quest separation');
  await page.setViewportSize({width:390,height:844});
  for(let index=0;index<34;index++){
   await page.evaluate(index=>{const f=window.__fishing;f.engine.state.questIndex=index;f.engine.state.questStatus='active';f.ui.render()},index);
   assert.equal(await page.locator('.quest-card').evaluate(e=>e.scrollWidth<=e.clientWidth),true,`quest ${index+1} overflow`);
  }
  checks.push('all 34 objective/reward cards fit portrait width');
  await page.evaluate(initial=>{const f=window.__fishing;f.engine.state=structuredClone(initial);f.engine.state.coins=1234;f.ui.render()},initial);
  await page.screenshot({path:`${output}/mobile.png`});
  await page.evaluate(()=>{const f=window.__fishing;f.engine.state.stats.catch_sardine=1;f.engine.state.questStatus='completed_unclaimed';f.ui.render()});
  await page.screenshot({path:`${output}/completed-mobile.png`});await page.setViewportSize({width:1440,height:900});await page.screenshot({path:`${output}/completed.png`});await page.locator('.quest-card').focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>window.__fishing.engine.state.questIndex),1);
  checks.push('completed appearance and keyboard claim through original hook');
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{const f=window.__fishing;f.engine.state.questIndex=5;f.ui.render();document.querySelector('#toast').classList.remove('visible')});await page.locator('.shop-toggle').click();await expect(page.locator('.shop-toggle')).toHaveAttribute('aria-expanded','true');await page.screenshot({path:`${output}/objects.png`});await page.locator('.mobile-close').click();await expect(page.locator('.shop-toggle')).toHaveAttribute('aria-expanded','false');
  await page.evaluate(()=>{const f=window.__fishing,s=f.engine.state;s.questIndex=5;s.questStatus='active';s.coins=150;Object.assign(s.boats[0],{x:830,y:1420});f.ui.render();f.scene.stopGuidance()});await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(150);
  await page.screenshot({path:`${output}/buy-zones.png`});
  const labelHit=await page.evaluate(()=>{const f=window.__fishing,l=f.scene.purchaseLabels.get('worker:0'),c=f.scene.cameras.main;return {x:(l.x-c.scrollX)*c.zoom,y:(l.y-c.scrollY)*c.zoom,width:l.width,height:l.height}});
  await page.mouse.move(labelHit.x,labelHit.y);await page.mouse.down();await page.mouse.up();assert.notEqual(await page.evaluate(()=>window.__fishing.scene.waypoint),null);assert.equal(await page.evaluate(()=>window.__fishing.ui.joystick.active),false);
  for(const offset of [-labelHit.height/2+5,labelHit.height/2-5]){await page.evaluate(()=>window.__fishing.scene.cancelControl());await page.mouse.click(labelHit.x,labelHit.y+offset);assert.notEqual(await page.evaluate(()=>window.__fishing.scene.waypoint),null);assert.equal(await page.evaluate(()=>window.__fishing.ui.joystick.active),false);}
  checks.push('purchase label center and both vertical edges preserve map navigation and exclude joystick');
  await page.evaluate(()=>{document.querySelector('#toast').classList.remove('visible');const f=window.__fishing,s=f.engine.state;f.scene.cancelControl();s.area=2;s.flags.storage=true;s.flags.cutter=true;s.questIndex=23;s.metal=13;for(const n of Object.values(s.nodes))n.unlocked=true;Object.assign(s.boats[0],{x:2250,y:1270});f.ui.render()});await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);await page.screenshot({path:`${output}/mobile-sea.png`});
  await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(150);await page.screenshot({path:`${output}/zone2.png`});
  // Exercise popups through the original engine methods, in an isolated browser state.
  await page.evaluate(initial=>{const f=window.__fishing;f.engine.state=structuredClone(initial);const s=f.engine.state;s.questIndex=8;s.coins=50000;s.golden.nextAt=s.time;f.engine.paused=false;f.scene.stopGuidance();f.scene.cancelControl()},initial);
  await page.waitForFunction(()=>window.__fishing.engine.state.golden.expires!==null);
  await page.evaluate(()=>{window.__fishing.engine.paused=true;window.__fishing.ui.showMerchant()});
  await expect(page.locator('#golden-grab')).toBeVisible();await page.screenshot({path:`${output}/golden.png`});
  await page.locator('#golden-grab').click();await expect(page.locator('#confirm-ad')).toBeDisabled();await page.screenshot({path:`${output}/rewarded.png`});await page.locator('#cancel-ad').click();
  await page.evaluate(()=>{const f=window.__fishing;f.engine.purchase('speedboat');f.engine.state.orders.speedboat.readyAt=f.engine.state.time+120;f.ui.showSkip('speedboat')});
  await expect(page.locator('#skip-now')).toContainText('Rewarded');await page.screenshot({path:`${output}/building-skip.png`});await page.locator('#skip-cancel').click();
  await page.evaluate(()=>{const f=window.__fishing;f.engine.state.orders.speedboat.readyAt=f.engine.state.time+1;f.ui.showSkip('speedboat')});
  await expect(page.locator('#skip-now')).toContainText('Free');await page.screenshot({path:`${output}/free-skip.png`});await page.locator('#skip-now').click();
  assert.equal(await page.evaluate(()=>window.__fishing.engine.state.orders.speedboat.complete),true);
  checks.push('Golden offer, mock rewarded disabled/cancel state, Rewarded Skip, Free Skip via real engine hooks');
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-action="help"]').click();await page.screenshot({path:`${output}/help.png`});await page.locator('#dismiss').click();
  assert.deepEqual(errors,[]);checks.push('object drawer active state, second-zone resource/warehouse labels and help modal; no console errors');
  const report={result:'passed',checks,consoleErrors:errors};fs.writeFileSync(`${output}/visual-report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }catch(e){await page.screenshot({path:`${output}/visual-diagnostic.png`});throw e}finally{await browser.close()}
}else throw new Error('Unknown mode '+mode);
