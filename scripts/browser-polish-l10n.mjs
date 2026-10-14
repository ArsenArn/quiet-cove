import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const url=process.env.SMOKE_URL??'http://127.0.0.1:4199',out='test-results/polish-l10n';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,...process.platform==='win32'?{channel:'msedge'}:{}}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
const ready=()=>page.waitForFunction(()=>window.__fishing?.ui);
const language=async lang=>{await page.locator('[data-action="settings"]').click();await page.locator('#language').selectOption(lang);await expect(page.locator('.settings h2')).toHaveText(lang==='en'?'Settings':'Настройки');await page.screenshot({path:`${out}/settings-${lang}.png`});await page.locator('[data-action="settings-close"]').click();await page.waitForTimeout(130)};
const bounds=async()=>page.evaluate(()=>{
 const selectors=['.hud','.brand strong','.currency','#cargo-stat','#metal-stat','#workers','.quest-card','#quest-title','.navigation button:not([hidden])','.shop-toggle'];
 const elements=selectors.flatMap(selector=>[...document.querySelectorAll(selector)].map(el=>{const r=el.getBoundingClientRect();return {selector,left:r.left,right:r.right,top:r.top,bottom:r.bottom,scroll:el.scrollWidth,client:el.clientWidth}}));
 const hud=document.querySelector('.hud').getBoundingClientRect(),quest=document.querySelector('.quest-card').getBoundingClientRect(),nav=document.querySelector('.navigation').getBoundingClientRect(),shop=document.querySelector('.shop-toggle').getBoundingClientRect();
 return {elements,hudBottom:hud.bottom,questTop:quest.top,questBottom:quest.bottom,navTop:nav.top,navRight:nav.right,shopLeft:shop.left,overflow:document.documentElement.scrollWidth>innerWidth};
});
try{
 await page.goto(`${url}/?debug=1`);await ready();await page.keyboard.press('F2');await page.evaluate(()=>{const f=window.__fishing;f.engine.paused=true;f.scene.stopGuidance();f.scene.cancelControl()});
 await expect(page.locator('.brand strong')).toHaveText('Quiet Cove');await expect(page.locator('#quest-title')).toHaveText('Catch your first sardine');assert.equal(await page.evaluate(()=>document.documentElement.lang),'en');checks.push('fresh launch defaults to English');
 const before=await page.evaluate(()=>JSON.stringify(window.__fishing.engine.state));await language('ru');assert.equal(await page.evaluate(()=>JSON.stringify(window.__fishing.engine.state)),before);await expect(page.locator('#quest-title')).toHaveText('Поймать первую сардину');await expect.poll(()=>page.evaluate(()=>window.__fishing.scene.labels.get('sardine').text)).toBe('Сардины');
 await page.reload();await ready();await expect(page.locator('.brand strong')).toHaveText('Тихая бухта');await page.keyboard.press('F2');await page.evaluate(()=>{window.__fishing.engine.paused=true;window.__fishing.scene.stopGuidance()});await language('en');checks.push('Settings switches DOM/world text immediately, remembers Russian on reload, does not alter game state');
 await page.keyboard.press('F2');await page.locator('[data-action="unlock"]').click();await page.keyboard.press('F2');await page.waitForFunction(()=>['worker:0','speedboat','cargo:1'].every(id=>window.__fishing.scene.purchaseLabels.has(id)));
 assert.equal(await page.evaluate(()=>window.__fishing.engine.state.questIndex),0);
 const unlocked=await page.evaluate(()=>JSON.stringify(window.__fishing.engine.state));await language('ru');assert.equal(await page.evaluate(()=>JSON.stringify(window.__fishing.engine.state)),unlocked);await language('en');
 await page.evaluate(()=>window.__fishing.persist());await page.reload();await ready();await page.keyboard.press('F2');await page.evaluate(()=>{const f=window.__fishing;f.engine.paused=true;f.scene.stopGuidance();f.engine.state.coins=123456;f.ui.render()});await page.waitForFunction(()=>['worker:0','speedboat','cargo:1'].every(id=>window.__fishing.scene.purchaseLabels.has(id)));
 checks.push('early debug Open zones reveals all three purchase labels, keeps quest unchanged, persists across reload');
 await page.locator('[data-action="settings"]').click();await page.locator('[data-action="open-debug"]').click();await expect(page.locator('#debug')).toBeVisible();await page.keyboard.press('F2');checks.push('Settings Balance Lab entry and F2 both work');
 for(const lang of ['en','ru']){
  await language(lang);
  if(lang==='en'){
   assert.equal(/[А-Яа-яЁё]/.test(await page.locator('#ui').innerText()),false,'English DOM has untranslated Russian text');
   assert.equal(await page.evaluate(()=>[...window.__fishing.scene.labels.values(),...window.__fishing.scene.purchaseLabels.values()].some(label=>/[А-Яа-яЁё]/.test(label.text))),false,'English world has untranslated Russian text');
  }
  for(const [width,height] of [[320,740],[360,800],[390,844],[700,900],[820,900],[1024,768],[1440,900],[844,390]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(100);const l=await bounds();assert.equal(l.overflow,false,`${lang} ${width}: page overflow`);assert.ok(l.questTop>=l.hudBottom+6,`${lang} ${width}: quest/HUD overlap`);assert.ok(l.navRight<l.shopLeft,`${lang} ${width}: bottom actions overlap`);
   for(const b of l.elements){assert.ok(b.left>=-1&&b.right<=width+1&&b.top>=0&&b.bottom<=height+1,`${lang} ${width}: bounds ${JSON.stringify(b)}`);assert.ok(b.scroll<=b.client+1,`${lang} ${width}: clipping ${JSON.stringify(b)}`)}
   for(let index=0;index<34;index++){await page.evaluate(index=>{const f=window.__fishing;f.engine.state.questIndex=index;f.engine.state.questStatus='active';f.ui.render()},index);const q=await page.locator('.quest-card').evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth,bottom:el.getBoundingClientRect().bottom}));assert.ok(q.scroll<=q.client+1&&q.bottom<l.navTop,`${lang} ${width} quest ${index+1}: overflow`)}
   await page.evaluate(()=>{const f=window.__fishing;f.engine.state.questIndex=0;f.ui.render()});
   if(width===1440){
    const overlap=await page.evaluate(()=>{const f=window.__fishing,c=f.scene.cameras.main,q=document.querySelector('.quest-card').getBoundingClientRect();return ['worker:0','speedboat','cargo:1'].filter(id=>{const l=f.scene.purchaseLabels.get(id);if(!l)return false;const x=(l.x-c.scrollX)*c.zoom,y=(l.y-c.scrollY)*c.zoom,w=l.width*c.zoom,h=l.height*c.zoom;return x+w/2>q.left&&x-w/2<q.right&&y+h/2>q.top&&y-h/2<q.bottom})});assert.deepEqual(overlap,[],`${lang}: purchase badge overlaps quest card`);
   }
   if(width===390||width===1440)await page.screenshot({path:`${out}/${width===390?'mobile':'desktop'}-${lang}.png`});
  }
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{window.__fishing.engine.state.questStatus='completed_unclaimed';window.__fishing.ui.render()});await page.screenshot({path:`${out}/completed-${lang}.png`});await expect(page.locator('#quest-title')).toContainText(lang==='en'?'TASK COMPLETE':'ЗАДАНИЕ ВЫПОЛНЕНО');
  await page.evaluate(()=>{window.__fishing.engine.state.questStatus='active';window.__fishing.ui.render()});
  await page.locator('[data-action="help"]').click();await page.screenshot({path:`${out}/help-${lang}.png`});await page.locator('#dismiss').click();await page.locator('.shop-toggle').click();await page.screenshot({path:`${out}/objects-${lang}.png`});await page.locator('.mobile-close').click();
  await page.setViewportSize({width:1440,height:900});
  await page.evaluate(()=>{const f=window.__fishing;f.engine.purchase('speedboat');f.engine.state.orders.speedboat.readyAt=f.engine.state.time+120;f.ui.showSkip('speedboat')});await page.screenshot({path:`${out}/skip-${lang}.png`});await page.locator('#skip-cancel').click();
  await page.evaluate(()=>{const f=window.__fishing;delete f.engine.state.orders.speedboat;f.engine.state.golden.expires=null;f.engine.state.golden.nextAt=f.engine.state.time;f.engine.paused=false});await page.waitForFunction(()=>window.__fishing.engine.state.golden.expires!==null);await page.evaluate(()=>{window.__fishing.engine.paused=true;window.__fishing.ui.showMerchant()});await page.screenshot({path:`${out}/golden-${lang}.png`});await page.locator('#golden-grab').click();await page.screenshot({path:`${out}/rewarded-${lang}.png`});await page.locator('#cancel-ad').click();
 }
 checks.push('both languages: 8 viewports, six-digit wallet, unlocked metal, all 34 quests, completed/help/guide/SKIP/Golden/rewarded screenshots');
 await page.evaluate(()=>{const f=window.__fishing,s=f.engine.state,r=f.engine.config.resources.sardine;s.golden.expires=s.time+f.engine.config.monetization.golden_lifetime_s;s.golden.x=r.x-90;s.golden.y=r.y+178;Object.assign(s.boats[0],f.engine.config.world.spawn)});
 for(const lang of ['en','ru']){await language(lang);await page.waitForTimeout(150);const overlap=await page.evaluate(()=>{const f=window.__fishing,a=f.scene.labels.get('sardine'),b=f.scene.merchantLabel;return Math.abs(a.x-b.x)<(a.width+b.width)/2 && Math.abs(a.y-b.y)<(a.height+b.height)/2});assert.equal(overlap,false,`${lang}: Golden/resource label overlap`);await page.screenshot({path:`${out}/world-labels-${lang}.png`})}
 checks.push('Golden/resource labels stay separated in both languages when the moving boat passes a fishing label');
 await language('en');await page.evaluate(()=>{const f=window.__fishing,s=f.engine.state;s.questIndex=0;s.questStatus='active';s.orders['cargo:1']={id:'cargo:1',cost:100,paid:50,metalCost:0,metalPaid:0,duration:1,readyAt:null,complete:false};Object.assign(s.boats[0],f.engine.config.world.spawn);f.scene.stopGuidance();f.ui.render()});await page.waitForTimeout(150);await page.screenshot({path:`${out}/unload-purchase-progress.png`});
 const ids=['worker:0','speedboat','cargo:1'];
 for(const id of ids){const hit=await page.evaluate(id=>{const f=window.__fishing,label=f.scene.purchaseLabels.get(id),c=f.scene.cameras.main;return {x:(label.x-c.scrollX)*c.zoom,y:(label.y-c.scrollY)*c.zoom}},id);await page.mouse.click(hit.x,hit.y);assert.equal(await page.evaluate(()=>window.__fishing.ui.joystick.active),false);assert.notEqual(await page.evaluate(()=>window.__fishing.scene.waypoint),null)}
 assert.deepEqual(errors,[]);checks.push('three revealed purchase badge hitboxes retain navigation and exclude joystick; no console errors');
 fs.writeFileSync(`${out}/report.json`,JSON.stringify({result:'passed',checks,consoleErrors:errors},null,2));console.log(JSON.stringify({result:'passed',checks,consoleErrors:errors},null,2));
}catch(e){await page.screenshot({path:`${out}/diagnostic.png`});throw e}finally{await browser.close()}
