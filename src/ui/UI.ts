import {t,label,applyTranslations,onLanguageChange,getLanguage,setLanguage,number as num,questText,offerName,blockedText,type TranslationKey} from './i18n';
import {openDebugZones} from '../debug/openZones';
import {icon} from './icons';
import type { Engine } from '../game/engine';
import type { BayScene } from '../game/scenes/BayScene';
import { offers, allOffers, visibility, skipKind, purchasePoint, type Offer } from '../game/systems/construction';
import { capacity, actualEarnRate, estimatedEarnRate, goldenReward, storageCapacity, creditIncome } from '../game/systems/economy';
import { Joystick } from './Joystick';
import {questOfferId} from '../game/systems/guidance';
import {fishUnload} from '../game/systems/delivery';
import { activateQuest, questProgress, questTarget } from '../game/systems/quests';
import { validateConfig, profiles } from '../config/load';
import { download, eventsCSV, log } from '../debug/events';
import type {BackgroundMusic} from '../audio/BackgroundMusic';
import type { PlaytestAnalytics } from '../analytics/playtest';
const analyticsLabel=(en:string,ru:string)=>getLanguage()==='ru'?ru:en;
const balanceValue=(config:unknown,path:string)=>path.split('.').reduce<any>((value,key)=>value?.[key],config);
const escape=(s:unknown)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export class UI {
  touch={x:0,y:0};
  readonly joystick:Joystick;
  private root=document.querySelector<HTMLDivElement>('#ui')!;
  private signature='';private tab='port';private debug=false;private overrides=false;
  onPersist?:()=>void;
  private modalSkip:string|null=null;
  private modalOpen=false;private toastTimer: ReturnType<typeof setTimeout> | undefined;
  private toastSource:string|(()=>string)='';private goldenAmount=0;
  constructor(public engine: Engine,private scene: BayScene,private allowSwitch: boolean,private resetProfile: ()=>void,public analytics?:PlaytestAnalytics,public music?:BackgroundMusic) {
    this.debug=new URLSearchParams(location.search).get('debug')==='1';
    this.root.innerHTML=`
      <header class="hud"><div class="hud-top"><div class="brand"><span class="brand-mark">${icon('waves')}</span><div><strong>${label('brand.title')}</strong><small>${label('brand.subtitle')}</small></div></div><div class="hud-stat currency" title="${t('hud.coins')}" data-i18n-title="hud.coins">${icon('coin')}<div><small class="stat-label">${label('hud.coins')}</small><span class="stat-value" id="coins">0</span></div></div><div class="utility"><button class="icon-button" data-action="help" aria-label="${t('help.control')}" data-i18n-aria-label="help.control" title="${t('help.control')}" data-i18n-title="help.control">?</button><button class="icon-button" data-action="settings" aria-label="${t('settings.title')}" data-i18n-aria-label="settings.title" title="${t('settings.title')}" data-i18n-title="settings.title">${icon('settings')}</button></div></div><div class="wallet"><div class="hud-stat" id="cargo-stat">${icon('cargo')}<div><small class="stat-label">${label('hud.cargo')}</small><span class="stat-value" id="cargo"></span><div class="cargo-meter"><i id="cargo-bar"></i></div></div></div><div class="hud-stat" id="metal-stat" hidden>${icon('metal')}<div><small class="stat-label">${label('hud.metal')}</small><span class="stat-value" id="metal"></span></div></div><div class="hud-stat">${icon('crew')}<div><small class="stat-label" hidden>${label('world.worker')}</small><span class="stat-value" id="workers"></span></div></div></div></header>
      <section class="quest-card"><div class="quest-art" id="quest-art" aria-hidden="true">${icon('fish')}</div><div class="quest-heading">${icon('compass')}<span id="quest-state">${label('quest.active')}</span><span id="quest-number"></span></div><h1 id="quest-title"></h1><div class="quest-track" role="progressbar" aria-label="${t('quest.progress')}" data-i18n-aria-label="quest.progress"><i id="quest-bar"></i></div><div class="quest-footer"><span id="quest-progress"></span><span class="reward-chip"><small>${label('quest.reward')}</small><span id="quest-reward"></span>${icon('coin')}</span></div><span class="quest-claim">${label('quest.claim')}</span></section>
      <div class="area-tag" id="area-tag"></div>
      <aside class="shop" id="shop"><div class="shop-heading"><div><small>${label('shop.eyebrow')}</small><h2>${label('shop.title')}</h2></div><button class="icon-button mobile-close" data-action="shop">×</button></div><div class="tabs"><button data-tab="port" class="selected">${label('shop.port')}</button><button data-tab="fish">${label('shop.fish')}</button><button data-tab="sea">${label('shop.sea')}</button></div><p class="shop-note">${label('shop.note')}</p><div id="offers"></div><div id="timers"></div></aside>
      <button class="shop-toggle" data-action="shop" aria-expanded="false" aria-controls="shop">${icon('map')} ${label('nav.objects')}</button>
      <nav class="navigation"><button data-action="port">${icon('anchor')} ${label('nav.port')}</button><button id="storage-nav" data-action="storage" hidden>${icon('metal')} ${label('nav.storage')}</button></nav>
      <div class="joystick" id="joystick" hidden aria-hidden="true"><div id="stick"></div></div><div class="control-note">${label('controls.note')}</div>

      <div id="toast" role="status"></div><div id="modal" class="modal-layer" hidden></div>
      <section id="debug" class="debug" hidden><div class="debug-heading"><h2>${label('debug.title')}</h2><button data-action="debug">×</button></div><p id="debug-profile"></p><div class="debug-row"><select id="profile" aria-label="${t('debug.profile')}" data-i18n-aria-label="debug.profile">${profiles.map(p=>`<option>${p}</option>`).join('')}</select><button data-action="profile">${label('debug.switch')}</button><select id="speed" aria-label="${t('debug.speed')}" data-i18n-aria-label="debug.speed">${[1,2,5,10].map(n=>`<option value="${n}">x${n}</option>`).join('')}</select></div><div class="debug-row"><button data-action="coins">${label('debug.coins')}</button><button data-action="metal">${label('debug.metal')}</button><button data-action="unlock">${label('debug.unlock')}</button></div><div class="debug-row"><input id="quest-jump" type="number" min="1" max="34" value="1" aria-label="${t('debug.questNumber')}" data-i18n-aria-label="debug.questNumber"><button data-action="jump">${label('debug.jump')}</button><button data-action="reset">${label('debug.reset')}</button></div><label>${label('debug.parameter')} <select id="config-path"></select></label><div class="debug-row"><input id="config-value" type="number" step="any" aria-label="${t('debug.value')}" data-i18n-aria-label="debug.value"><button data-action="edit">${label('debug.apply')}</button></div><div class="debug-row"><button data-action="config-export">${label('debug.config')}</button><button data-action="events-json">${label('debug.eventsJson')}</button><button data-action="events-csv">${label('debug.eventsCsv')}</button></div><pre id="diagnostics"></pre></section>`;
    const analyticsSection=document.createElement('section');analyticsSection.id='playtest-analytics';
    analyticsSection.innerHTML='<h3>PLAYTEST ANALYTICS</h3><div class="debug-row"><button data-action="analytics-start">Start Recording</button><button data-action="analytics-stop">Stop Recording</button></div><div class="debug-row"><button data-action="analytics-export">Export JSON</button><button data-action="analytics-export-full">Export Full JSON</button><button data-action="analytics-clear">Clear Recording</button></div><p id="analytics-status" role="status"></p><p id="analytics-time"></p><p id="analytics-count"></p><p id="analytics-warning" role="alert"></p>';
    this.root.querySelector('#debug-profile')!.after(analyticsSection);
    this.root.addEventListener('click',e=>{const target=(e.target as HTMLElement).closest<HTMLButtonElement>('button');if(!target) return; if(target.dataset.tab){this.tab=target.dataset.tab;this.signature='';this.root.querySelectorAll('[data-tab]').forEach(el=>el.classList.toggle('selected',(el as HTMLElement).dataset.tab===this.tab));this.render();}else this.action(target.dataset.action??'',target.dataset.id);});
    // Browsers synthesize click only for the primary touch. The joystick owns that touch,
    // so activate genuine second-finger UI taps explicitly on release, with drag rejection.
    const secondaryTaps=new Map<number,{target:HTMLElement;x:number;y:number}>();
    this.root.addEventListener('pointerdown',e=>{
      if(e.pointerType!=='touch' || e.isPrimary)return;
      const target=(e.target as HTMLElement).closest<HTMLElement>('button,.quest-card');
      if(target)secondaryTaps.set(e.pointerId,{target,x:e.clientX,y:e.clientY});
    });
    this.root.addEventListener('pointerup',e=>{
      const tap=secondaryTaps.get(e.pointerId);secondaryTaps.delete(e.pointerId);
      if(tap && tap.target===(e.target as HTMLElement).closest('button,.quest-card') && Math.hypot(e.clientX-tap.x,e.clientY-tap.y)<=this.engine.config.interaction.ui_tap_slop){e.preventDefault();tap.target.click();}
    });
    this.root.addEventListener('pointercancel',e=>secondaryTaps.delete(e.pointerId));
    window.addEventListener('blur',()=>secondaryTaps.clear());
    const card=this.root.querySelector<HTMLElement>('.quest-card')!;
    card.tabIndex=0; card.setAttribute('role','button');
    const claim=()=>{const id=Number(card.dataset.questId);if(this.engine.claimQuest(id)){this.onPersist?.();this.scene.showQuestHint();this.toast(()=>t('notice.reward'));card.classList.remove('reward-pop');void card.offsetWidth;card.classList.add('reward-pop');this.render();}};
    card.addEventListener('click',e=>{if(!(e.target as HTMLElement).closest('button') && e.detail<=1)claim();});
    card.addEventListener('keydown',e=>{if(e.target===card && !e.repeat && ['Enter',' '].includes(e.key)){e.preventDefault();claim();}});
    window.addEventListener('keydown',e=>{if(e.key==='F2'){e.preventDefault();this.toggleDebug();}});
    const pad=this.root.querySelector<HTMLDivElement>('#joystick')!,stick=this.root.querySelector<HTMLDivElement>('#stick')!;
    this.joystick=new Joystick(this.scene.game.canvas,pad,stick,()=>this.engine.config.interaction,point=>{this.touch=this.engine.controlsLocked?{x:0,y:0}:point;},()=>{this.scene.waypoint=null;},(x,y)=>this.scene.canStartJoystick(x,y));
    this.scene.events.once('shutdown',()=>this.joystick.destroy());
    this.scene.manualInputActive=()=>this.joystick.active;
    this.scene.onResetInput=()=>this.joystick.reset();
    window.addEventListener('blur',()=>this.scene.cancelControl());
    this.populateConfig();this.root.querySelector<HTMLSelectElement>('#profile')!.value=this.engine.config.profile;
    this.root.querySelector<HTMLSelectElement>('#speed')!.addEventListener('change',e=>{this.engine.speed=Number((e.target as HTMLSelectElement).value);log(this.engine.state,this.engine.config.save.max_events,'debug_speed',{speed:this.engine.speed});});
    const unsubscribe=onLanguageChange(()=>{
      this.signature='';applyTranslations(this.root);
      for(const el of this.root.querySelectorAll<HTMLElement>('[data-offer-name]'))el.textContent=offerName(this.engine.config,{id:el.dataset.offerName!});
      const golden=this.root.querySelector('#golden-amount');if(golden)golden.innerHTML=`${icon('coin')} ${num(this.goldenAmount)}`;
      if(typeof this.toastSource==='function')this.text('toast',this.toastSource());
      this.render();
    });this.scene.events.once('shutdown',unsubscribe);
    const resize=new ResizeObserver(()=>{const bottom=this.root.querySelector('.hud')!.getBoundingClientRect().bottom;this.root.style.setProperty('--hud-bottom',`${bottom}px`);});resize.observe(this.root.querySelector('.hud')!);this.scene.events.once('shutdown',()=>resize.disconnect());
    this.setDebug();this.render();
  }
  private text(id:string,value:string) {const node=this.root.querySelector(`#${id}`)!;if(node.textContent!==value)node.textContent=value;}
  render() {
    const c=this.engine.config,s=this.engine.state,p=s.boats[0],q=c.quests[s.questIndex];
    if(this.modalSkip){const order=s.orders[this.modalSkip];if(!order || order.complete)this.closeModal();else {const remaining=Math.max(0,order.readyAt!-s.time);const text=this.root.querySelector('#skip-remaining');if(text)text.textContent=t('world.remaining',{seconds:Math.ceil(remaining)});const button=this.root.querySelector('#skip-now');if(button)button.textContent=skipKind(c,remaining)==='free'?t('build.free'):t('build.rewarded');}}
    this.text('coins',num(s.coins));this.text('cargo',`${p.cargo.length} / ${capacity(c,s,p)}`);
    this.root.querySelector<HTMLElement>('#cargo-bar')!.style.width=`${Math.min(100,100*p.cargo.length/capacity(c,s,p))}%`;
    this.root.querySelector('#cargo-stat')!.classList.toggle('full',p.cargo.length>=capacity(c,s,p));
    this.text('metal',s.flags.storage?`${num(s.metal)} / ${storageCapacity(c,s)}`:'');this.root.querySelector<HTMLElement>('#metal-stat')!.hidden=!s.flags.storage;
    this.text('workers',t('hud.workers',{count:s.boats.filter(b=>b.kind==='worker'||b.kind==='speedboat').length}));this.root.querySelector('#workers')!.setAttribute('title',t('hud.fleetTip',{workers:s.boats.filter(b=>b.kind==='worker').length,speedboats:s.boats.filter(b=>b.kind==='speedboat').length}));
    const card=this.root.querySelector<HTMLElement>('.quest-card')!,pending=!!q && s.questStatus==='completed_unclaimed';card.classList.toggle('completed',pending);card.dataset.questId=String(q?.id??0);card.setAttribute('aria-label',pending?t('quest.completeAria'):q?questText(q):t('quest.allDone'));
    this.text('quest-state',pending?t('quest.pending'):t('quest.active'));this.text('quest-number',`${Math.min(s.questIndex+1,c.quests.length)} / ${c.quests.length}`);
    this.text('quest-title',pending?t('quest.complete'):q?questText(q):t('quest.allDone'));card.setAttribute('aria-disabled',String(!pending));
    const questIcon=pending?'check':/трюм/i.test(q?.label??'')?'cargo':/корабль|металл|склад|разбор/i.test(q?.label??'')?'metal':/лодк|катер|рыбак/i.test(q?.label??'')?'boat':/пират|защит/i.test(q?.label??'')?'shield':'fish';
    const art=this.root.querySelector<HTMLElement>('#quest-art')!;if(art.dataset.icon!==questIcon){art.dataset.icon=questIcon;art.innerHTML=icon(questIcon);}
    const progress=q?Math.min(questTarget(q),questProgress(q,s)):1,total=q?questTarget(q):1;
    this.text('quest-progress',q?`${num(progress)} / ${num(total)}`:t('quest.allDone'));this.text('quest-reward',q?`+${num(q.reward_coins)}${q.reward_metal?` · +${t('world.metal',{amount:num(q.reward_metal)})}`:''}`:t('quest.routeOpen'));
    this.root.querySelector<HTMLElement>('#quest-bar')!.style.width=`${100*progress/total}%`;
    const track=this.root.querySelector('.quest-track')!;track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax',String(total));track.setAttribute('aria-valuenow',String(progress));
    this.text('area-tag',p.x<c.world.gate_x?t('world.bay'):t('world.pirateWaters'));
    this.root.querySelector<HTMLElement>('#storage-nav')!.hidden=!s.flags.storage;
    const all=offers(c,s),activeId=this.questOffer();
    const filtered=all.filter(o=>this.tab==='fish'?o.id.startsWith('resource:') && o.id!=='resource:wreck':this.tab==='sea'?['gate','defender','storage','cutter','resource:wreck','storageUpgrade','den','route'].includes(o.id)||o.id.startsWith('salvage:'):o.id.startsWith('cargo:')||o.id.startsWith('worker:')||o.id==='speedboat');
    const signature=JSON.stringify([getLanguage(),this.tab,activeId,filtered.map(o=>[o.id,o.cost,o.blocked,s.orders[o.id]?.paid,s.orders[o.id]?.metalPaid,s.orders[o.id]?.readyAt===null?null:Math.ceil((s.orders[o.id]?.readyAt??0)-s.time)]),Math.floor(s.time)]);
    if(signature!==this.signature) {
      this.signature=signature;
      this.root.querySelector('#offers')!.innerHTML=filtered.map(o=>this.offerHTML(o,activeId)).join('')||`<p class="empty">${label('shop.empty')}</p>`;
      const timers=Object.values(s.orders).filter(o=>o.readyAt!==null && !o.complete);
      this.root.querySelector('#timers')!.innerHTML=timers.length?`<h3>${label('shop.building')}</h3>`+timers.map(o=>{const remaining=Math.max(0,o.readyAt!-s.time),name=offerName(c,o);return `<div class="timer-row"><span>${escape(name)}<small>${t('world.remaining',{seconds:Math.ceil(remaining)})}</small></span><button data-action="skip" data-id="${escape(o.id)}">${skipKind(c,remaining)==='free'?t('build.freeShort'):t('build.rewardedShort')}</button></div>`;}).join(''):'';
    }
    if(this.debug) {
      const a=this.analytics,status=a?.status??'OFF';
      this.text('analytics-status',`${analyticsLabel('Recording Status','Статус записи')}: ${status}`);
      this.text('analytics-time',`${analyticsLabel('Current Session Time','Время сессии')}: ${(a?.activeSeconds??0).toFixed(1)} active / ${(a?.wallSeconds??0).toFixed(1)} wall s`);
      this.text('analytics-count',`${analyticsLabel('Recorded Events','Записано событий')}: ${a?.eventCount??0}`);
      this.text('analytics-warning',a?.warning||a?.storageWarning||'');
      for(const [action,en,ru,disabled] of [['start','Start Recording','Начать запись',status!=='OFF'],['stop','Stop Recording','Остановить запись',status!=='RECORDING'],['export','Export JSON','Экспорт JSON',status==='OFF'],['export-full','Export Full JSON','Полный JSON',status==='OFF'],['clear','Clear Recording','Очистить запись',status==='OFF']] as const){const button=this.root.querySelector<HTMLButtonElement>(`[data-action="analytics-${action}"]`)!;button.textContent=analyticsLabel(en,ru);button.disabled=disabled;}
      this.text('debug-profile',`${c.profile} · ${this.overrides?t('debug.overrides'):t('debug.original')} · ${s.time.toFixed(1)} ${t('debug.gameSeconds')}`);
      this.text('diagnostics',`${t('debug.estimated')} ${estimatedEarnRate(c,s).toFixed(3)} ◉/${t('world.seconds',{seconds:''})}\n${t('debug.actual')} 30/60/180${t('world.seconds',{seconds:''})}: ${[30,60,180].map(w=>actualEarnRate(s,w).toFixed(3)).join(' / ')}\n${t('debug.quest')} ${s.questIndex+1}; ${t('debug.baseline')} ${s.questBaseline}\n\n${t('debug.purchases')}\n${allOffers(c,s).map(o=>`${o.id}: ${t(`status.${visibility(c,s,o.id)}` as TranslationKey)}${o.blocked?' · '+blockedText(o.blocked):''}`).join('\n')}\n\n${t('debug.boats')}\n${s.boats.map(b=>`${b.id}: ${b.state} → ${b.target??'—'} [${b.cargo.length}/${capacity(c,s,b)}]`).join('\n')}\n\n${t('debug.resources')}\n${Object.entries(s.nodes).map(([id,n])=>`${id}: ${n.unlocked?'open':'locked'} ${n.phase} stock=${n.stock} HP=${n.hp} ${t('world.seconds',{seconds:Math.max(0,n.readyAt-s.time).toFixed(1)})}`).join('\n')}\n\n${t('debug.pirates')} ${s.enemies.length} · ${t('debug.playerHp')} ${p.hp}\n${t('debug.events')}: ${s.eventSeq}`);
    }
  }
  private offerHTML(o:Offer,active:string|null) {
    const order=this.engine.state.orders[o.id],pending=order?.readyAt!==null && order?.readyAt!==undefined;
    const remaining=Math.max(0,(order?.cost??o.cost)-(order?.paid??0)),metal=Math.max(0,(order?.metalCost??o.metal_cost??0)-(order?.metalPaid??0));
    return `<article class="offer ${o.id===active?'recommended':''}"><div><strong>${escape(offerName(this.engine.config,o))}</strong>${o.id===active?`<em>${label('shop.current')}</em>`:''}<small>${o.blocked?escape(blockedText(o.blocked)):`${icon('coin')} ${num(remaining)}${metal?` · ${icon('metal')} ${num(metal)}`:''} · ${t('world.seconds',{seconds:o.build_s})}`}</small>${order && !pending?`<small>${t('shop.paid',{paid:num(order.paid),cost:num(order.cost)})}${order.metalCost?` · ${t('shop.paidMetal',{paid:num(order.metalPaid),cost:num(order.metalCost)})}`:''}</small>`:''}</div><button data-action="buy" data-id="${escape(o.id)}" ${o.blocked?'disabled':''}>${pending?t('shop.toBuild'):t('shop.onMap')}</button></article>`;
  }
  private questOffer():string|null{return questOfferId(this.engine.config,this.engine.state);}
  private async action(action:string,id?:string) {
    const c=this.engine.config,s=this.engine.state;
    const before={coins:s.coins,metal:s.metal,questIndex:s.questIndex,area:s.area,cargoLevel:s.cargoLevel,boats:s.boats.length,flags:{...s.flags}};
    switch(action) {
      case 'analytics-start': this.analytics?.start();break;
      case 'analytics-stop': this.analytics?.stop();break;
      case 'analytics-export': {const data=this.analytics?.exportJSON();if(data)download(this.analytics!.filename(),data);break;}
      case 'analytics-export-full': {const data=this.analytics?.exportJSON('full');if(data)download(this.analytics!.filename('full'),data);break;}
      case 'analytics-clear': if(confirm(analyticsLabel('Clear only the analytics recording? Game progress will be kept.','Удалить только запись аналитики? Игровой прогресс сохранится.')))this.analytics?.clear(true);break;
      case 'claim': if(this.engine.claimQuest(Number(id))){this.onPersist?.();this.scene.showQuestHint();this.toast(()=>t('notice.reward'));const card=this.root.querySelector('.quest-card')!;card.classList.remove('reward-pop');void (card as HTMLElement).offsetWidth;card.classList.add('reward-pop');}break;
      case 'buy': {const point=purchasePoint(c,id!);this.scene.navigate(point.x,point.y);this.root.querySelector('#shop')!.classList.remove('mobile-open');break;}
      case 'skip': this.showSkip(id!);break;

      case 'port': {const p=fishUnload(c,s);this.scene.navigate(p.x,p.y);break;}
      case 'storage': this.scene.navigate(c.world.storage.x,c.world.storage.y);break;
      case 'shop': this.root.querySelector('#shop')!.classList.toggle('mobile-open');break;
      case 'help': this.message('help.title','help.body');break;
      case 'settings': this.showSettings();break;
      case 'music-toggle': {this.music?.setEnabled(!this.music.enabled);const button=this.root.querySelector<HTMLButtonElement>('#music-toggle');if(button){button.setAttribute('aria-checked',String(this.music?.enabled??true));button.innerHTML=label(this.music?.enabled===false?'settings.musicOff':'settings.musicOn');}break;}
      case 'open-debug': this.closeModal();this.debug=true;this.setDebug();break;
      case 'settings-close': this.closeModal();break;
      case 'debug': this.toggleDebug();break;
      case 'coins': creditIncome(s,10000,'debug_grant');this.debugEvent('grant_coins',{before,coins_delta:s.coins-before.coins});break;
      case 'metal': s.metal=Math.min(storageCapacity(c,s),s.metal+100);this.debugEvent('grant_metal',{before,metal_delta:s.metal-before.metal});break;
      case 'unlock': openDebugZones(c,s);this.debugEvent('unlock',{before});this.onPersist?.();break;
      case 'jump': {const n=Number(this.root.querySelector<HTMLInputElement>('#quest-jump')!.value);if(Number.isInteger(n)&&n>=1&&n<=34){s.questIndex=n-1;this.debugEvent('quest_jump',{before,target_quest:n});activateQuest(c,s);}break;}
      case 'reset': if(confirm(t('debug.resetConfirm',{profile:c.profile})))this.resetProfile();break;
      case 'profile': {if(!this.allowSwitch){this.toast(()=>t('notice.switchOff'));break;}const p=this.root.querySelector<HTMLSelectElement>('#profile')!.value;if(confirm(t('debug.switchConfirm',{profile:p}))){this.analytics?.stop('profile_switch');this.onPersist?.();const url=new URL(location.href);url.searchParams.set('debug','1');url.searchParams.set('balance',p);location.href=url.href;}break;}
      case 'edit': this.editConfig();break;
      case 'config-export': download(`balance_${c.profile}_overrides.json`,JSON.stringify(c,null,2));break;
      case 'events-json': download(`events_${c.profile}.json`,JSON.stringify(s.events,null,2));break;
      case 'events-csv': download(`events_${c.profile}.csv`,'\ufeff'+eventsCSV(s.events),'text/csv;charset=utf-8');break;
    }
    this.root.querySelector('.shop-toggle')!.setAttribute('aria-expanded',String(this.root.querySelector('#shop')!.classList.contains('mobile-open')));
    this.render();
  }
  private debugEvent(type:string,data:Record<string,unknown>={}) {log(this.engine.state,this.engine.config.save.max_events,`debug_${type}`,data);}
  private toggleDebug() {this.debug=!this.debug;this.setDebug();}
  private setDebug() {this.root.querySelector<HTMLElement>('#debug')!.hidden=!this.debug;}
  private populateConfig() {
    const paths:{path:string;value:number}[]=[];
    const visit=(o:unknown,path:string)=>{if(typeof o==='number')paths.push({path,value:o});else if(o && typeof o==='object') for(const [k,v] of Object.entries(o)) visit(v,path?`${path}.${k}`:k);};
    for(const key of ['world','docks','resource_burst','units','workers','resources','combat','salvage','capacity_upgrades','monetization','ai','expansion','special','interaction','navigation','presentation'] as const) visit(this.engine.config[key],key);
    const select=this.root.querySelector<HTMLSelectElement>('#config-path')!;select.innerHTML=paths.map(x=>`<option value="${x.path}">${x.path}</option>`).join('');
    const refresh=()=>{this.root.querySelector<HTMLInputElement>('#config-value')!.value=String(paths.find(p=>p.path===select.value)?.value??0);};select.onchange=refresh;refresh();
  }
  private editConfig() {
    const path=this.root.querySelector<HTMLSelectElement>('#config-path')!.value, value=Number(this.root.querySelector<HTMLInputElement>('#config-value')!.value),clone=structuredClone(this.engine.config);
    let current: any=clone;const segments=path.split('.');for(const seg of segments.slice(0,-1))current=current[seg];current[segments.at(-1)!]=value;
    if(/^capacity_upgrades\.\d+\.capacity$/.test(path)) {const upgrade=clone.capacity_upgrades[Number(segments[1])];clone.units.player.capacity[upgrade.level]=value;}
    if(/^units\.player\.capacity\.\d+$/.test(path)) {const upgrade=clone.capacity_upgrades.find(u=>u.level===Number(segments[3]));if(upgrade)upgrade.capacity=value;}
    try {validateConfig(clone);const previous=balanceValue(this.engine.config,path);this.engine.config=clone;this.joystick.reset();this.joystick.configure();this.overrides=true;this.debugEvent('config_edit',{path,value,previous});this.populateConfig();this.toast(()=>t('notice.edited'));}catch(e){this.toast((e as Error).message);}
  }
  toast(message:string|(()=>string)) {this.toastSource=message;this.text('toast',typeof message==='function'?message():message);this.root.querySelector('#toast')!.classList.add('visible');clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>this.root.querySelector('#toast')!.classList.remove('visible'),3200);}
  private lockModal(){this.modalOpen=true;this.engine.lockControls('modal');this.scene.cancelControl();this.joystick.reset();}
  private closeModal(){this.root.querySelector<HTMLElement>('#modal')!.hidden=true;this.modalOpen=false;this.modalSkip=null;this.engine.unlockControls('modal');this.scene.cancelControl();this.joystick.reset();}
  private showSettings(){
    if(this.modalOpen)return;this.lockModal();const layer=this.root.querySelector<HTMLElement>('#modal')!;layer.hidden=false;
    layer.innerHTML=`<div class="modal settings" role="dialog" aria-modal="true"><h2>${label('settings.title')}</h2><label class="language-setting" for="language">${label('settings.language')}<select id="language" aria-label="${t('settings.language')}" data-i18n-aria-label="settings.language"><option value="en">English</option><option value="ru">Русский</option></select></label><div class="language-setting"><span id="music-label">${label('settings.music')}</span><button id="music-toggle" class="secondary music-toggle" data-action="music-toggle" role="switch" aria-labelledby="music-label" aria-checked="${this.music?.enabled??true}">${label(this.music?.enabled===false?'settings.musicOff':'settings.musicOn')}</button></div><label class="language-setting boat-names-setting" for="boat-names"><span>${label('settings.boatNames')}</span><input id="boat-names" type="checkbox" ${this.scene.showBoatNames?'checked':''}></label><button class="secondary" data-action="open-debug">${label('settings.debug')}</button><button data-action="settings-close">${label('settings.close')}</button></div>`;
    layer.querySelector<HTMLInputElement>('#boat-names')!.addEventListener('change',e=>this.scene.setBoatNames((e.target as HTMLInputElement).checked));
    const select=layer.querySelector<HTMLSelectElement>('#language')!;select.value=getLanguage();select.addEventListener('change',()=>setLanguage(select.value==='ru'?'ru':'en'));
  }
  private message(title:TranslationKey,text:TranslationKey) {if(this.modalOpen)return;this.lockModal();const layer=this.root.querySelector<HTMLElement>('#modal')!;layer.hidden=false;layer.innerHTML=`<div class="modal" role="dialog" aria-modal="true"><span class="eyebrow">${label('world.bay')}</span><h2>${label(title)}</h2><p>${label(text)}</p><button id="dismiss">${label('help.dismiss')}</button></div>`;layer.querySelector('#dismiss')!.addEventListener('click',()=>{this.closeModal();});}
  private rewarded(reward:()=>boolean,cancel:()=>void=()=>{},context:Record<string,unknown>={}) {
    if(this.modalOpen)return;this.lockModal();const layer=this.root.querySelector<HTMLElement>('#modal')!;
    layer.hidden=false;layer.innerHTML=`<div class="modal ad" role="dialog" aria-modal="true"><span class="eyebrow">${label('ad.eyebrow')}</span><div class="ad-art">${icon('boat')}</div><h2>${label('ad.title')}</h2><p>${label('ad.body')}</p><button id="confirm-ad" disabled>${label('ad.wait',{seconds:this.engine.config.monetization.fake_ad_s})}</button><button class="secondary" id="cancel-ad">${label('ad.cancel')}</button></div>`;
    const button=layer.querySelector<HTMLButtonElement>('#confirm-ad')!;
    log(this.engine.state,this.engine.config.save.max_events,'fake_ad_started',context);
    const timeout=setTimeout(()=>{button.disabled=false;button.innerHTML=label('ad.confirm');},this.engine.config.monetization.fake_ad_s*1000);
    const close=()=>{clearTimeout(timeout);this.closeModal();};button.addEventListener('click',()=>{if(button.disabled)return;button.disabled=true;log(this.engine.state,this.engine.config.save.max_events,'fake_ad_completed',context);const ok=reward();if(ok)this.onPersist?.();close();this.toast(()=>ok?t('notice.done'):t('notice.expired'));this.render();});layer.querySelector('#cancel-ad')!.addEventListener('click',()=>{log(this.engine.state,this.engine.config.save.max_events,'fake_ad_cancelled',context);cancel();close();});
  }
  showMerchant() {
    if(this.modalOpen)return;const offer=this.engine.openGoldenOffer();if(!offer)return;this.goldenAmount=offer.reward;this.onPersist?.();this.lockModal();
    const layer=this.root.querySelector<HTMLElement>('#modal')!;layer.hidden=false;layer.innerHTML=`<div class="modal golden" role="dialog" aria-modal="true"><div class="ad-art">${icon('boat')}</div><h2>${label('golden.title')}</h2><p>${label('golden.onBoard')}</p><strong id="golden-amount">${icon('coin')} ${num(offer.reward)}</strong><button id="golden-grab">${label('golden.grab')}</button><button class="secondary" id="golden-let-go">${label('golden.release')}</button></div>`;
    layer.querySelector('#golden-let-go')!.addEventListener('click',()=>{this.engine.cancelGoldenReward(offer.id);this.onPersist?.();this.closeModal();});
    layer.querySelector('#golden-grab')!.addEventListener('click',()=>{if(!this.engine.beginGoldenReward(offer.id)){this.closeModal();this.toast(()=>t('notice.boatGone'));return;}this.onPersist?.();this.closeModal();this.rewarded(()=>this.engine.claimGolden(true,offer.id),()=>{this.engine.cancelGoldenReward(offer.id);this.onPersist?.();},{source:'golden',transaction:offer.id});});
  }
  showSkip(id:string) {
    if(this.modalOpen)return;const c=this.engine.config,s=this.engine.state,o=s.orders[id];if(!o || o.complete || o.readyAt===null)return;
    this.lockModal();this.modalSkip=id;const name=offerName(c,{id}),layer=this.root.querySelector<HTMLElement>('#modal')!;
    layer.hidden=false;layer.innerHTML=`<div class="modal construction" role="dialog" aria-modal="true"><div class="ad-art">${icon('clock')}</div><span class="eyebrow">${label('build.title')}</span><h2 data-offer-name="${escape(id)}">${escape(name)}</h2><p id="skip-remaining"></p><button id="skip-now"></button><button class="secondary" id="skip-cancel">${label('build.cancel')}</button></div>`;
    layer.querySelector('#skip-cancel')!.addEventListener('click',()=>this.closeModal());
    layer.querySelector('#skip-now')!.addEventListener('click',()=>{const order=s.orders[id];if(!order || order.complete){this.closeModal();return;}const mode=skipKind(c,order.readyAt!-s.time);this.closeModal();if(mode==='free'){if(this.engine.skip(id))this.onPersist?.();this.render();}else this.rewarded(()=>this.engine.skip(id,true),()=>{},{source:'timer',purchase_id:id});});this.render();
  }
}

