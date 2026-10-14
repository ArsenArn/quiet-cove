import {initializeLanguage,t} from './ui/i18n';
import Phaser from 'phaser';
import { loadBalance, loadSelection, profiles } from './config/load';
import { Engine } from './game/engine';
import { BayScene } from './game/scenes/BayScene';
import { UI } from './ui/UI';
import { loadGame, saveGame, saveKey } from './game/systems/save';
import { VisibilityLifecycle } from './game/systems/timing';
import { PlaytestAnalytics,analyticsKey } from './analytics/playtest';
import { loadAnalyticsStorage } from './analytics/storage';
import { getLanguage } from './ui/i18n';
import './ui/style.css';
import {BackgroundMusic} from './audio/BackgroundMusic';
async function boot() {
  initializeLanguage();
  const selection=await loadSelection(),params=new URLSearchParams(location.search),override=params.get('balance');
  const debug=params.get('debug')==='1';
  const profile=debug && selection.query_override && selection.allow_debug_profile_switch && profiles.includes(override as any)?override as 'fast'|'reference':selection.default_profile;
  const config=await loadBalance(profile);let loaded=null,error='';
  try {loaded=loadGame(localStorage,config);}catch(e){error=t('error.loadSave',{error:(e as Error).message});}
  let musicStorage:Storage|null=null;try{musicStorage=localStorage;}catch{/* Music still works without persistence. */}
  const music=new BackgroundMusic(new Audio(`${import.meta.env.BASE_URL}audio/sunny-harbor-afternoon.mp3`),musicStorage);
  const engine=new Engine(config,loaded?.state);
  const analyticsStorage=await loadAnalyticsStorage(analyticsKey(profile),localStorage);
  const analytics=new PlaytestAnalytics(engine,analyticsStorage,()=>Date.now(),getLanguage,!document.hidden);
  if(loaded)engine.settleOffline(loaded.offline);
  let saveEnabled=!error;
  let ui:UI|undefined;const scene=new BayScene(engine,()=>ui?.touch??{x:0,y:0});
  scene.onReady=()=>{ui=new UI(engine,scene,selection.allow_debug_profile_switch && selection.query_override,()=>{analytics.stop('new_game');saveEnabled=false;localStorage.removeItem(saveKey(profile));location.reload();},analytics,music);ui.onPersist=()=>persist();if(error)ui.toast(error);};
  scene.onMerchant=()=>ui?.showMerchant();
  scene.onSkip=id=>ui?.showSkip(id);
  // CSS touch-action:none and Joystick's native PointerEvent capture own gestures.
  // Phaser still receives touch input; avoid preventDefault on non-cancelable touchcancel.
  const game=new Phaser.Game({type:Phaser.AUTO,parent:'game',backgroundColor:'#1b7182',scale:{mode:Phaser.Scale.RESIZE,width:window.innerWidth,height:window.innerHeight},scene:[scene],render:{antialias:true,roundPixels:false},input:{activePointers:3,touch:{capture:false}},audio:{noAudio:true}});
  game.events.once(Phaser.Core.Events.DESTROY,()=>music.destroy());
  const persist=()=>{if(!saveEnabled)return;try{saveGame(localStorage,engine.state);}catch{ui?.toast(()=>t('error.save'));}analytics.persist();};
  if(ui)ui.onPersist=persist;
  setInterval(()=>{analytics.sample();ui?.render();},200);setInterval(persist,config.save.autosave_s*1000);
  const lifecycle=new VisibilityLifecycle(engine,scene.frameClock);
  window.addEventListener('pagehide',()=>{analytics.setVisible(false,'pagehide');persist();});
  window.addEventListener('blur',()=>analytics.setVisible(false,'blur'));
  window.addEventListener('focus',()=>analytics.setVisible(!document.hidden,'focus'));
  document.addEventListener('visibilitychange',()=>{if(document.hidden){analytics.setVisible(false);scene.stopGuidance();scene.cancelControl();lifecycle.suspend(Date.now());ui?.joystick.reset();scene.input.keyboard?.resetKeys();persist();}else {lifecycle.resume(Date.now());analytics.setVisible(document.hasFocus());}});
  window.addEventListener('pageshow',()=>analytics.setVisible(!document.hidden&&document.hasFocus(),'pageshow'));
  if(document.hidden)lifecycle.suspend(Date.now());
  if(debug) (window as any).__fishing={engine,game,get ui(){return ui;},scene,persist,lifecycle,analytics,music};
}
boot().catch(error=>{console.error(error);const root=document.querySelector('#ui')!;const panel=document.createElement('div');panel.className='modal-layer';const text=document.createElement('div');text.className='modal';const title=document.createElement('h2');title.textContent=t('error.open');const p=document.createElement('p');p.textContent=String(error);const button=document.createElement('button');button.textContent=t('error.retry');button.onclick=()=>location.reload();text.append(title,p,button);panel.append(text);root.append(panel);});
