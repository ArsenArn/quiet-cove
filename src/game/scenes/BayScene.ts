import {t,resourceName,offerName,number as num,onLanguageChange} from '../../ui/i18n';
import {nautical} from '../../ui/tokens';
import {WorldLabel,preloadUIIcons,uiFont} from '../../ui/WorldLabel';
import Phaser from 'phaser';

import type { Engine } from '../engine';
import type { Boat } from '../state';
import { capacity, goldenReward } from '../systems/economy';
import {fishUnload,fishPorts} from '../systems/delivery';
import { distance, navigationTarget, resolveLand, clampToWorld, onLand } from '../systems/movement';
import { FrameClock } from '../systems/timing';
import { gatherDuration } from '../systems/resources';
import { offers, purchasePoint, skipKind, revealed } from '../systems/construction';
import { spawnerProgress } from '../systems/combat';
import {CameraGuidance,nextQuestHintTarget} from '../systems/guidance';
import {boatArt,resourceArt,resourceCaptionTop,layers,directionFrame,resourceFrame,coinArt,crateKey,cargoPosition,preloadArt,cargoSize,waterArt,movementHeading} from '../art/registry';
import {assembleEnvironment} from '../art/sceneAssembly';
import {animation,ambient,netShape,newMotion,stepMotion,phase,type Motion} from '../art/animation';
import {VisualEffects} from '../art/VisualEffects';
type CargoView = {id:number;image:Phaser.GameObjects.Image};
type BoatView = { hull: Phaser.GameObjects.Image; cargo: CargoView[]; name: WorldLabel; hp: Phaser.GameObjects.Graphics; motion:Motion };
type CoinView = {image:Phaser.GameObjects.Image;label:WorldLabel};
export class BayScene extends Phaser.Scene {
  onReady?: ()=>void;
  onResetInput?:()=>void;
  manualInputActive?:()=>boolean;
  onMerchant?: ()=>void;
  onSkip?: (id:string)=>void;
  private dynamic!: Phaser.GameObjects.Graphics;
  private water!: Phaser.GameObjects.TileSprite;
  private environment!:ReturnType<typeof assembleEnvironment>;
  private goldenHeading:{x:number;y:number;angle:number;offerId:number|null}|null=null;
  private resourceViews=new Map<string,Phaser.GameObjects.Image>();
  private crateViews=new Map<number,Phaser.GameObjects.Image>();
  private labels = new Map<string,WorldLabel>();
  private boatViews = new Map<string,BoatView>();
  private purchaseCircles=new Map<string,Phaser.GameObjects.Image>();
  private circleTextures=new Set<string>();
  private purchaseLabels = new Map<string,WorldLabel>();
  private coinLabels = new Map<number,CoinView>();
  private coinPool:CoinView[]=[];
  private skipButtons=new Map<string,WorldLabel>();
  private effects!:VisualEffects;
  private visualTime=0;
  private visualDt=1/60;
  private visualState:Engine['state']|null=null;
  private pickupFlights=new Set<number>();
  private bursts=new Map<number,{x:number;y:number;start:number;duration:number}>();
  private coinBirths=new Map<number,{start:number;fromX:number;fromY:number}>();
  private hitUntil=new Map<string,number>();
  private constructionBirths=new Map<string,number>();
  private merchantMotion:Motion|null=null;
  private merchant!:Phaser.GameObjects.Image;
  private merchantLabel!:WorldLabel;
  private storageLabel!:WorldLabel;
  private portLabel!:WorldLabel;
  private zone2PortLabel?:WorldLabel;
  private lastOverflowNotice=-Infinity;
  private spawnerLabel!:WorldLabel;
  private keys!: Record<string,Phaser.Input.Keyboard.Key>;
  private lastEvent=0;

  showBoatNames=false;
  setBoatNames(enabled:boolean){this.showBoatNames=enabled;try{localStorage.setItem('quiet_cove_boat_names',String(enabled));}catch{}for(const view of this.boatViews.values())view.name.setVisible(enabled);}
  waypoint: {x:number;y:number} | null=null;
  readonly frameClock=new FrameClock();
  readonly guidance=new CameraGuidance();
  constructor(public engine: Engine,private touch: ()=>{x:number;y:number}) { super('bay');try{this.showBoatNames=localStorage.getItem('quiet_cove_boat_names')==='true';}catch{} }
  preload(){preloadArt(this);preloadUIIcons(this);}
  create() {
    const c=this.engine.config;
    this.effects=new VisualEffects(this);
    const quality=new URLSearchParams(location.search).get('vfx');
    animation.vfx.quality=quality==='off'?'off':quality==='low'?'low':'high';
    // Native repeat, with a fixed world-space tile origin. No camera-relative UV drift or stretching.
    this.water=this.add.tileSprite(0,0,c.world.width,c.world.height,waterArt.key).setOrigin(0).setTileScale(waterArt.tileScale).setDepth(layers.water).setTint(waterArt.tint).setAlpha(waterArt.alpha);
    const map=this.add.graphics().setDepth(layers.coast);
    map.fillStyle(0x184a73,0.2).fillRect(c.world.gate_x,0,c.world.width-c.world.gate_x,c.world.height);
    this.environment=assembleEnvironment(this,c);
    const portLabel=new WorldLabel(this,c.world.port.x,c.world.port.y+90,t('world.port'),'anchor').setDepth(layers.groundUI);
    this.portLabel=portLabel;
    if(c.second_port){const p=c.second_port.unload;this.zone2PortLabel=new WorldLabel(this,p.x,p.y+90,t('world.port'),'anchor').setDepth(layers.groundUI).setVisible(false);}
    this.storageLabel=new WorldLabel(this,2310,1550,t('world.storage'),'metal').setDepth(layers.groundUI).setVisible(false);
    const seaTitle=this.add.text(1930,260,t('world.sea'),{fontFamily:uiFont,fontSize:'34px',color:'#88c1c7',letterSpacing:5}).setAlpha(0.55);
    for(const [id,r] of Object.entries(c.resources)) {
      this.labels.set(id,new WorldLabel(this,r.x,r.y+111,'',id==='wreck'?'metal':id==='crab'||id==='lobster'?'crab':id==='mussel'?'shell':id==='squid'?'squid':'fish').setDepth(layers.groundUI));
      if(resourceArt[id])this.resourceViews.set(id,this.add.image(r.x,r.y,`resource-${id}`).setDisplaySize(id==='wreck'?196:160,id==='wreck'?196:160).setDepth(layers.resource).setVisible(false));
    }
    const unsubscribe=onLanguageChange(()=>{portLabel.setText(t('world.port'));this.zone2PortLabel?.setText(t('world.port'));this.storageLabel.setText(t('world.storage'));seaTitle.setText(t('world.sea'));for(const button of this.skipButtons.values())button.setText(t('world.skip'));});this.events.once('shutdown',unsubscribe);
    this.dynamic=this.add.graphics().setDepth(layers.groundUI-.01);
    this.merchant=this.add.image(0,0,boatArt.golden.key).setDisplaySize(boatArt.golden.size,boatArt.golden.size).setDepth(layers.boat).setVisible(false);
    this.merchantLabel=new WorldLabel(this,0,0,'','coin','gold').setDepth(layers.groundUI).setVisible(false).makeInteractive();
    this.merchantLabel.on('pointerdown',(_p:Phaser.Input.Pointer,_x:number,_y:number,event:Phaser.Types.Input.EventData)=>{event.stopPropagation();if(!this.engine.controlsLocked)this.onMerchant?.();});
    this.spawnerLabel=new WorldLabel(this,c.combat.spawner.x,c.combat.spawner.y-145,'','pirate','danger',true).setDepth(layers.groundUI);
    this.cameras.main.setBounds(0,0,c.world.width,c.world.height).setZoom(c.world.camera_zoom);
    this.keys=this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string,Phaser.Input.Keyboard.Key>;
    this.input.on('pointerdown',(p: Phaser.Input.Pointer)=>{
      const c=this.engine.config,point={x:p.worldX,y:p.worldY},s=this.engine.state;if(this.engine.controlsLocked)return;
      if(s.golden.expires!==null && distance(point,s.golden)<=54){this.onMerchant?.();return;}
      const offer=offers(c,s).find(o=>distance(point,purchasePoint(c,o.id))<=c.interaction.purchase_radius);
      if(offer)this.interactPurchase(offer.id);
    });
    this.lastEvent=this.engine.state.eventSeq;
    this.events.once('shutdown',()=>{this.stopGuidance();this.cancelControl();this.effects.clear();this.pickupFlights.clear();this.bursts.clear();this.coinBirths.clear();this.hitUntil.clear();this.constructionBirths.clear();this.boatViews.clear();this.resourceViews.clear();this.crateViews.clear();this.labels.clear();this.purchaseLabels.clear();this.purchaseCircles.clear();for(const key of this.circleTextures)this.textures.remove(key);this.circleTextures.clear();this.coinLabels.clear();this.coinPool=[];this.skipButtons.clear();});
    this.onReady?.();
  }
  cancelControl(){this.onResetInput?.();this.waypoint=null;this.engine.input={x:0,y:0};this.input.keyboard?.resetKeys();}
  canStartJoystick(clientX:number,clientY:number){
    if(this.engine.controlsLocked || !this.sys.isActive())return false;
    const rect=this.game.canvas.getBoundingClientRect(),probe=new Phaser.Input.Pointer(this.input.manager,-1);
    probe.position.set((clientX-rect.left)*this.scale.width/rect.width,(clientY-rect.top)*this.scale.height/rect.height);
    // Use Phaser's hit test so every current/future interactive object keeps its own input.
    if(this.input.hitTestPointer(probe).length)return false;
    const c=this.engine.config,s=this.engine.state,point=this.cameras.main.getWorldPoint(probe.x,probe.y);
    if(point.x<0 || point.y<0 || point.x>(s.area===1?c.world.gate_x:c.world.width) || point.y>c.world.height || onLand(c,point))return false;
    if(s.golden.expires!==null && distance(point,s.golden)<=54)return false;
    return !offers(c,s).some(o=>distance(point,purchasePoint(c,o.id))<=c.interaction.purchase_radius);
  }
  showQuestHint(){const target=nextQuestHintTarget(this.engine.config,this.engine.state);if(!target){this.stopGuidance();return;}const cam=this.cameras.main;this.guidance.begin({x:cam.midPoint.x,y:cam.midPoint.y},target);}
  stopGuidance(){this.guidance.cancel();}
  navigate(x:number,y:number) {if(this.engine.controlsLocked || this.manualInputActive?.())return;const point={x,y};clampToWorld(point,this.engine.config,this.engine.state.area);resolveLand(this.engine.config,point);this.waypoint=point;}
  update(_t:number,delta:number) {
    const c=this.engine.config,s=this.engine.state,p=s.boats[0];
    const frameDt=this.frameClock.step(performance.now());
    const touch=this.touch(),kx=Number(this.keys.D.isDown||this.keys.RIGHT.isDown)-Number(this.keys.A.isDown||this.keys.LEFT.isDown),ky=Number(this.keys.S.isDown||this.keys.DOWN.isDown)-Number(this.keys.W.isDown||this.keys.UP.isDown);
    let x=kx||ky?kx:touch.x,y=kx||ky?ky:touch.y;
    if(document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLSelectElement || document.activeElement instanceof HTMLTextAreaElement) {x=0;y=0;this.waypoint=null;}
    if(x||y)this.waypoint=null;
    if(this.waypoint) { const d=distance(p,this.waypoint); if(d<c.world.arrival_radius || (s.area===1 && this.waypoint.x>=c.world.gate_x && p.x>=c.world.gate_x-c.world.edge_margin-1)) this.waypoint=null; else {const next=navigationTarget(c,p,this.waypoint,s.area),nd=distance(p,next),scale=Math.min(1,nd/Math.max(.001,c.units.player.speed*frameDt*this.engine.speed));x=nd>0?(next.x-p.x)/nd*scale:0;y=nd>0?(next.y-p.y)/nd*scale:0;} }
    if(this.engine.controlsLocked){x=0;y=0;this.waypoint=null;}
    this.engine.input={x,y}; this.engine.update(frameDt);
    const focus=this.guidance.step(frameDt,p,c.presentation);this.cameras.main.centerOn(focus.x,focus.y);
    this.visualDt=Math.min(.05,delta/1000);this.visualTime+=this.visualDt;
    if(this.visualState!==s){
      if(this.visualState){this.effects.clear();this.effects=new VisualEffects(this);this.lastEvent=s.eventSeq;}
      this.visualState=s;this.pickupFlights.clear();this.bursts.clear();this.coinBirths.clear();this.hitUntil.clear();this.constructionBirths.clear();this.merchantMotion=null;
      for(const v of this.boatViews.values()){for(const item of v.cargo)item.image.destroy();v.cargo=[];v.motion=newMotion(v.hull.x,v.hull.y,0);}
    }
    this.drawEvents(); this.drawWorld();this.effects.update(this.visualDt);
  }
  private drawWorld() {
    const c=this.engine.config,s=this.engine.state,g=this.dynamic;g.clear();
    for(const view of this.environment.zone2)view.setVisible(s.area===2);
    this.environment.lair.setTint(s.flags.den?0xd4e5cb:0xffffff);
    this.cameras.main.setBounds(0,0,s.area===1?c.world.gate_x:c.world.width,c.world.height);
    if(s.area===1) { g.lineStyle(8,0xd4b478,0.8);g.lineBetween(c.world.gate_x,0,c.world.gate_x,c.world.height);for(let y=30;y<c.world.height;y+=140) {g.fillStyle(0xf2d9a1).fillCircle(c.world.gate_x,y,10);} }
    this.environment.gateBuilding.setVisible(s.area>=2 && !!s.flags.secondPort);
    this.portLabel.setPosition(c.world.port.x,c.world.port.y+160);
    this.zone2PortLabel?.setVisible(s.area>=2 && !!s.flags.secondPort).setPosition(c.second_port!.unload.x,c.second_port!.unload.y+c.world.deposit_radius+8+this.zone2PortLabel!.height/2);
    for(const port of fishPorts(c,s))this.drawDropoff(port.x,port.y,c.world.deposit_radius);
    if(s.flags.storage) {this.drawDropoff(c.world.storage.x,c.world.storage.y,c.world.deposit_radius);}
    if(s.area===2) {
      const den=c.combat.spawner;
      const spawn=spawnerProgress(c,s);this.spawnerLabel.setPosition(den.x,den.y+114).setVisible(true).setText(spawn.status==='closed'?t('world.closed'):spawn.status==='waiting_slot'?t('world.limit'):t('world.nextPirate',{seconds:Math.ceil(spawn.remaining!)}));
      // Above the lair model (top = spawner.y - 123), with a clear outline.
      g.fillStyle(0x062f40,.55).fillRoundedRect(den.x-92,den.y-149,184,18,9);
      g.fillStyle(0x123b4a,.98).fillRoundedRect(den.x-92,den.y-152,184,18,9);
      g.lineStyle(2,0xffe3a1,.9).strokeRoundedRect(den.x-92,den.y-152,184,18,9);
      if(spawn.fraction>0)g.fillStyle(spawn.status==='closed'?0x8dccab:0xffca65).fillRoundedRect(den.x-88,den.y-148,176*spawn.fraction,10,Math.min(5,88*spawn.fraction));
    }
    else this.spawnerLabel.setVisible(false);
    this.storageLabel.setVisible(s.area>=2 && s.flags.storage).setPosition(c.navigation.obstacles[4].x,c.navigation.obstacles[4].y+135);
    for(const [id,r] of Object.entries(c.resources)) {
      const n=s.nodes[id],color=Phaser.Display.Color.HexStringToColor(r.color).color;
      const hidden=r.zone>s.area || (!n.unlocked && !revealed(c,s,`resource:${id}`)) || (id==='wreck' && !s.flags.cutter);this.labels.get(id)!.setVisible(!hidden);if(hidden){this.resourceViews.get(id)?.setVisible(false);continue;}
      const ready=n.unlocked && n.phase==='ready';
      // HP is the current harvest portion, independent of stock and recovery time.
      if(n.unlocked)this.drawHealthBar(g,r.x,r.y-(id==='wreck'?112:90),70,n.hp/r.portion_hp);
      g.fillStyle(color,ready?0.17:0.06).fillEllipse(r.x,r.y,145,98);g.lineStyle(2,color,ready?0.55:0.15).strokeEllipse(r.x,r.y,145,98);
      const art=this.resourceViews.get(id),frame=resourceFrame(r,n);
      if(art){const motion=ambient(id,this.visualTime),size=id==='wreck'?196:160;
        const birth=this.constructionBirths.get('resource:'+id),t=birth===undefined?1:Math.min(1,(this.visualTime-birth)/.42),pop=1+Math.sin(t*Math.PI*2)*.09*(1-t);
        art.setVisible(frame!==null).setFrame(frame??0).setPosition(r.x+motion.x,r.y+motion.y).setDisplaySize(size*motion.scale*pop,size*motion.scale*pop).setRotation(motion.rotation);
      }
      else if(id==='wreck') {g.fillStyle(0x5b655f,0.8).fillPoints([{x:r.x-55,y:r.y-22},{x:r.x+28,y:r.y-35},{x:r.x+58,y:r.y+7},{x:r.x+18,y:r.y+36},{x:r.x-47,y:r.y+27}],true);g.lineStyle(3,0xadc0b7).lineBetween(r.x-30,r.y-16,r.x+30,r.y+16);}
      else for(let i=0;i<7;i++) {const x=r.x-45+(i%4)*27,y=r.y-16+Math.floor(i/4)*28;g.fillStyle(color,ready?0.95:0.3).fillEllipse(x,y,19,8);g.fillTriangle(x-8,y,x-15,y-5,x-15,y+5);g.fillStyle(0x174957).fillCircle(x+5,y-1,1.5);}
      if(!n.unlocked) {g.fillStyle(0xf4dbab).fillRoundedRect(r.x-10,r.y-10,20,20,4);g.lineStyle(3,0xf4dbab).strokeCircle(r.x,r.y-13,7);}
      const seconds=Math.ceil(Math.max(0,n.readyAt-s.time));
      const status=id==='wreck' && c.profile==='fast'?(n.phase==='restock'?t('world.restoring',{seconds}):`${n.stock}/${r.stock}${ready?'':' · '+t('world.seconds',{seconds})}`):ready?'':t('world.seconds',{seconds});
      const caption=this.labels.get(id)!;caption.setText(`${resourceName(id)}${status?' · '+status:''}`).setPosition(r.x,r.y+resourceCaptionTop[id]+caption.height/2).setVisible(n.unlocked).setAlpha(1);
    }
    const crateIds=new Set(s.crates.map(crate=>crate.id));
    for(const [id,view] of this.crateViews)if(!crateIds.has(id)){view.destroy();this.crateViews.delete(id);}
    for(const id of this.bursts.keys())if(!crateIds.has(id))this.bursts.delete(id);
    for(const crate of s.crates) {
      const key=crateKey(crate.resource);if(!key){this.drawCrate(g,crate.x,crate.y,Phaser.Display.Color.HexStringToColor(c.resources[crate.resource].color).color);continue;}
      let view=this.crateViews.get(crate.id);if(!view){view=this.add.image(crate.x,crate.y,key).setDisplaySize(cargoSize.floating,cargoSize.floating).setDepth(layers.loot);this.crateViews.set(crate.id,view);}
      let x=crate.x,y=crate.y,angle=0;const burst=this.bursts.get(crate.id);
      if(burst){const t=Math.min(1,(this.visualTime-burst.start)/burst.duration),ease=1-(1-t)**2;x=burst.x+(crate.x-burst.x)*ease;y=burst.y+(crate.y-burst.y)*ease-Math.sin(Math.PI*t)*36;angle=Math.sin(Math.PI*t)*.18;
        if(t===1){this.bursts.delete(crate.id);this.effects.splash(crate.x,crate.y);}}
      else y+=Math.sin(this.visualTime*1.7+crate.id)*1.1;
      view.setPosition(x,y).setRotation(angle).setVisible(true);
    }
    this.drawDocks();
    this.drawPurchases();this.animateBuildings();
    this.drawCoins();
    this.merchant.setVisible(s.golden.expires!==null);
    this.merchantLabel.setVisible(s.golden.expires!==null);
    if(s.golden.expires===null){this.goldenHeading=null;this.merchantMotion=null;}
    if(s.golden.expires!==null) {
      const previous=this.goldenHeading?.offerId===s.golden.offerId?this.goldenHeading:null;
      const heading=this.engine.paused?s.golden.angle:movementHeading(previous,s.golden,s.golden.angle);
      this.goldenHeading={x:s.golden.x,y:s.golden.y,angle:heading,offerId:s.golden.offerId};
      if(!this.merchantMotion)this.merchantMotion=newMotion(s.golden.x,s.golden.y,heading);
      const motion=stepMotion(this.merchantMotion,s.golden.x,s.golden.y,heading,this.visualDt),bob=Math.sin(this.visualTime*animation.boats.frequency+phase('golden'))*animation.boats.bob;
      if(motion.speed>3&&this.visualTime>this.merchantMotion.wakeAt){this.effects.wake(s.golden.x,s.golden.y,motion.dx,motion.dy,true);this.merchantMotion.wakeAt=this.visualTime+animation.boats.wakeInterval;}
      this.merchant.setPosition(s.golden.x,s.golden.y+bob).setFrame(directionFrame(heading)).setRotation(Math.sin(this.visualTime*1.4+phase('golden'))*animation.boats.roll);g.fillStyle(0xffd86b,.15).fillCircle(s.golden.x,s.golden.y,54);g.lineStyle(2,0xffd86b,.8).strokeCircle(s.golden.x,s.golden.y,54);
      const reward=s.golden.transaction && ['offered','watching'].includes(s.golden.transaction.status)?s.golden.transaction.reward:goldenReward(c,s);
      const age=s.time-(s.golden.expires!-c.monetization.golden_lifetime_s);
      this.merchantLabel.setPosition(s.golden.x,s.golden.y+75).setText(Math.floor(age/c.presentation.golden_label_interval_s)%2===0?t('world.claim'):t('world.coins',{amount:num(reward)}));
    }
    for(const b of [...s.boats,...s.defender?[s.defender]:[]]) this.drawBoat(b,b.id==='defender'?'defender':b.kind);
    const alive=new Set([...s.boats,...s.defender?[s.defender]:[],...s.enemies].map(b=>b.id));
    for(const e of s.enemies) this.drawBoat({...e,kind:'player',cargo:[],gather:0,unload:0,respawnAt:0} as Boat,'pirate');
    for(const [id,view] of this.boatViews) if(!alive.has(id)) {view.hull.destroy();for(const item of view.cargo)item.image.destroy();view.name.destroy();view.hp.destroy();this.boatViews.delete(id);}

    for(const proj of s.projectiles) {const target=proj.faction==='friendly'?s.enemies.find(e=>e.id===proj.target):[s.boats[0],s.defender].find(b=>b?.id===proj.target);if(!target)continue;const a=Math.atan2(target.y-proj.y,target.x-proj.x),dx=Math.cos(a),dy=Math.sin(a);
      g.lineStyle(2,0xd0ebe7,.35).lineBetween(proj.x-dx*22,proj.y-dy*22,proj.x,proj.y);g.lineStyle(3,proj.faction==='friendly'?0xe5f8db:0xff9a80).lineBetween(proj.x-dx*8,proj.y-dy*8,proj.x+dx*4,proj.y+dy*4);
    }
    for(const player of s.boats.filter(b=>b.gather>0)) if(player.target && typeof player.target==='string') {
      const r=c.resources[player.target],fraction=player.gather/gatherDuration(c,player,player.target),view=this.boatViews.get(player.id);
      if(view && this.visualTime>view.motion.fishAt){this.effects.particle('ring',r.x+Math.sin(phase(player.id))*20,r.y,18,0xcceee7,.8);this.effects.particle('bubble',r.x+12,r.y+10,2,0xd4f4ee,.6,0,-12);view.motion.fishAt=this.visualTime+.65;}
      g.lineStyle(player.kind==='player'?4:3,0xade8ae,0.9);g.beginPath();g.arc(player.x,player.y,43,-Math.PI/2,-Math.PI/2+fraction*Math.PI*2,false);g.strokePath();
      const resource=this.resourceViews.get(player.target),x=resource?.x??r.x,y=resource?.y??r.y;
      this.drawFishingNet(player.x,player.y,x,y,fraction);
    }
    if(this.waypoint) {g.lineStyle(2,0xf3e2af,0.6).strokeCircle(this.waypoint.x,this.waypoint.y,14);g.lineBetween(this.waypoint.x-20,this.waypoint.y,this.waypoint.x+20,this.waypoint.y);}
    if(this.guidance.highlighting){const t=this.guidance.target!,y=t.y-c.presentation.target_arrow_offset+Math.sin(performance.now()/180)*5;g.lineStyle(5,0xfff09c,.95).strokeCircle(t.x,t.y,c.presentation.target_ring_radius);g.fillStyle(0xffe885).fillTriangle(t.x-22,y-25,t.x+22,y-25,t.x,y+8);g.fillRect(t.x-10,y-53,20,31);}
  }
  private drawDocks(){
    const c=this.engine.config,s=this.engine.state,g=this.dynamic;
    for(const dock of c.docks){
      if(dock.zone>s.area)continue;
      if(dock.zone===1){
        // Mooring guides make the immutable interaction points legible without duplicate painted piers.
        const point=c.interaction.purchase_points[dock.id];
        const anchors:Record<string,{x:number;y:number}>={cargo:{x:880,y:1455},worker:{x:735,y:1340},speedboat:{x:880,y:1250}};
        const anchor=anchors[dock.id]??dock.end;
        if(point){g.lineStyle(2,0xffefb9,.5);const dx=point.x-anchor.x,dy=point.y-anchor.y;for(let t=0;t<1;t+=.16)g.lineBetween(anchor.x+dx*t,anchor.y+dy*t,anchor.x+dx*Math.min(1,t+.07),anchor.y+dy*Math.min(1,t+.07));}
        continue;
      }
      // Defender station replaces the old painted pontoon; the guide remains decorative.
      const point=c.interaction.purchase_points.defender;
      g.lineStyle(2,0xd8e5cf,.45);
      const anchor={x:this.environment.defender.x,y:this.environment.defender.y+110};
      for(let t=0;t<1;t+=.18){const end=Math.min(1,t+.08);g.lineBetween(anchor.x+(point.x-anchor.x)*t,anchor.y+(point.y-anchor.y)*t,anchor.x+(point.x-anchor.x)*end,anchor.y+(point.y-anchor.y)*end);}
    }
  }
  private drawCoins(){
    const c=this.engine.config,s=this.engine.state,g=this.dynamic,cam=this.cameras.main,rect=cam.worldView;
    const visible=s.coinStacks.filter(p=>(s.time>=p.availableAt || this.coinBirths.has(p.id)) && p.x>=rect.x-30 && p.x<=rect.right+30 && p.y>=rect.y-30 && p.y<=rect.bottom+30).slice(0,c.presentation.max_coin_views),ids=new Set(visible.map(p=>p.id));
    for(const [id,view] of this.coinLabels)if(!ids.has(id)){view.label.setVisible(false);view.image.setVisible(false);this.coinPool.push(view);this.coinLabels.delete(id);}
    if(this.coinBirths.size){const pending=new Set(s.coinStacks.map(p=>p.id));for(const [id,birth] of this.coinBirths)if(this.visualTime-birth.start>=.4||!pending.has(id))this.coinBirths.delete(id);}
    for(const p of visible){
      let view=this.coinLabels.get(p.id);if(!view){view=this.coinPool.pop()??{image:this.add.image(0,0,'coin-single').setDepth(layers.loot),label:new WorldLabel(this,0,0,'',null,'gold',true).setDepth(layers.groundUI)};this.coinLabels.set(p.id,view);}
      const skin=coinArt(p.value,p.source),size=animation.coins[skin];
      const birth=this.coinBirths.get(p.id),age=birth===undefined?1:(this.visualTime-birth.start)/.4,t=Math.min(1,age),jump=Math.sin(Math.PI*t)*(p.source==='golden_reward'?26:16),scale=1+Math.sin(Math.PI*t)*.23;
      if(t===1)this.coinBirths.delete(p.id);
      view.image.setVisible(true).setTexture(`coin-${skin}`).setDisplaySize(size*scale,size*scale).setPosition(birth?birth.fromX+(p.x-birth.fromX)*t:p.x,(birth?birth.fromY+(p.y-birth.fromY)*t:p.y)-jump);
      view.label.setVisible(true).setPosition(p.x,p.y-size/2-18).setText(String(p.value));
    }
  }
  private drawFishingNet(boatX:number,boatY:number,x:number,y:number,progress:number){
    const g=this.dynamic,{rx,ry}=netShape(progress);
    g.lineStyle(3,0x164b5d,.3).lineBetween(boatX,boatY,x,y);
    g.lineStyle(1.5,0xfff1ce,.65).lineBetween(boatX,boatY,x,y);
    g.fillStyle(0xc7f6e9,.075).fillEllipse(x,y,rx*2,ry*2);
    g.lineStyle(4,0x164b5d,.32).strokeEllipse(x,y+1,rx*2,ry*2);
    g.lineStyle(2.6,0xffedc1,.88).strokeEllipse(x,y,rx*2,ry*2);
    const strands=animation.vfx.quality==='high'?2:1;
    if(animation.vfx.quality!=='off'){
      g.lineStyle(1.25,0xeaf6d8,.48);
      for(let i=-strands;i<=strands;i++){
        const fraction=i/(strands+1),span=Math.sqrt(1-fraction*fraction);
        g.lineBetween(x+rx*fraction,y-ry*span,x+rx*fraction,y+ry*span);
        g.lineBetween(x-rx*span,y+ry*fraction,x+rx*span,y+ry*fraction);
      }
      const floats=animation.vfx.quality==='high'?8:4;
      for(let i=0;i<floats;i++){const a=i*Math.PI*2/floats;g.fillStyle(0x164b5d,.3).fillCircle(x+Math.cos(a)*rx,y+Math.sin(a)*ry+1,2.8);g.fillStyle(i%2?0xffda83:0xfff4d7,.95).fillCircle(x+Math.cos(a)*rx,y+Math.sin(a)*ry,2.1);}
    }
  }
  private drawDropoff(x:number,y:number,radius:number){
    const g=this.dynamic;
    // Same gameplay radius. A dark under-stroke defines the pale edge against bright water.
    g.fillStyle(nautical.circle,.035).fillCircle(x,y,radius);
    g.lineStyle(5,nautical.navy,.5).strokeCircle(x,y,radius);
    g.lineStyle(2.5,nautical.circle,.82).strokeCircle(x,y,radius);
    for(let i=0;i<4;i++){const a=i*Math.PI/2;g.lineStyle(2,nautical.circle,.65).lineBetween(x+Math.cos(a)*(radius-9),y+Math.sin(a)*(radius-9),x+Math.cos(a)*(radius-3),y+Math.sin(a)*(radius-3));}
  }
  private purchaseCircle(id:string,x:number,y:number,radius:number,blocked:boolean){
    const key=`bay-purchase-${radius}-${blocked?'blocked':'active'}`;
    if(!this.textures.exists(key)){
      const g=new Phaser.GameObjects.Graphics(this),center=Math.ceil(radius+6),alpha=blocked?.3:.9;
      g.fillStyle(nautical.circle,.07).fillCircle(center,center,radius);
      g.lineStyle(6,nautical.circle,.06).strokeCircle(center,center,radius);
      g.lineStyle(2.5,nautical.circle,alpha).strokeCircle(center,center,radius);
      for(let i=0;i<20;i++){const start=i*Math.PI/10;g.lineStyle(1.5,nautical.circle,alpha*.85);g.beginPath();g.arc(center,center,radius-7,start,start+.19);g.strokePath();}
      g.lineStyle(2,nautical.circle,alpha*.65).lineBetween(center,center-12,center,center-3).lineBetween(center,center+4,center,center+13);
      g.lineStyle(1.5,nautical.circle,alpha*.7).lineBetween(center-4,center+radius-13,center,center+radius-9).lineBetween(center,center+radius-9,center+4,center+radius-13);
      g.generateTexture(key,center*2,center*2);g.destroy();this.circleTextures.add(key);
    }
    let image=this.purchaseCircles.get(id);if(!image){image=this.add.image(x,y,key).setDepth(layers.groundUI-.01);this.purchaseCircles.set(id,image);}
    image.setTexture(key).setPosition(x,y);
  }
  private drawPurchases() {
    const c=this.engine.config,s=this.engine.state,g=this.dynamic,active=offers(c,s),ids=new Set(active.map(o=>o.id));
    for(const [id,image] of this.purchaseCircles)if(!ids.has(id)){image.destroy();this.purchaseCircles.delete(id);}
    for(const [id,label] of this.purchaseLabels)if(!ids.has(id)){label.destroy();this.purchaseLabels.delete(id);}
    const buildingIds=new Set(active.filter(o=>s.orders[o.id]?.readyAt!=null&&!s.orders[o.id].complete).map(o=>o.id));
    for(const [id,button] of this.skipButtons)if(!buildingIds.has(id)){button.destroy();this.skipButtons.delete(id);}
    for(const o of active){
      const point=purchasePoint(c,o.id),order=s.orders[o.id],building=buildingIds.has(o.id);
      const coins=Math.max(0,(order?.cost??o.cost)-(order?.paid??0)),metal=Math.max(0,(order?.metalCost??o.metal_cost??0)-(order?.metalPaid??0));
      const fraction=((order?.paid??0)+(order?.metalPaid??0))/Math.max(1,(order?.cost??o.cost)+(order?.metalCost??o.metal_cost??0));
      this.purchaseCircle(o.id,point.x,point.y,c.interaction.purchase_radius,!!o.blocked);
      if(fraction>0){g.lineStyle(4,nautical.purchaseGreen);g.beginPath();g.arc(point.x,point.y,c.interaction.purchase_radius,-Math.PI/2,-Math.PI/2+fraction*2*Math.PI);g.strokePath();}
      let label=this.purchaseLabels.get(o.id);if(!label){label=new WorldLabel(this,0,0,'',o.id.startsWith('cargo:')?'cargo':o.id.startsWith('resource:')?'fish':o.id==='storage'||o.id==='storageUpgrade'?'metal':o.id==='den'?'pirate':o.id==='defender'?'shield':o.id==='gate'||o.id==='route'?'compass':'boat','gold',false,'purchase').setDepth(layers.groundUI).makeInteractive();label.on('pointerdown',(_p:Phaser.Input.Pointer,_x:number,_y:number,event:Phaser.Types.Input.EventData)=>{event.stopPropagation();this.interactPurchase(o.id);});this.purchaseLabels.set(o.id,label);}
      const name=offerName(c,o,true);
      label.setText(building?`${name}\n${t('world.seconds',{seconds:Math.ceil(Math.max(0,order!.readyAt!-s.time))})}`:`${name}\n${num(Math.ceil(coins))}${metal?` · ${t('world.metal',{amount:Math.ceil(metal)})}`:''}`).setTone(building?'success':'gold').setAlpha(o.blocked?.72:1).setGroundPosition(point.x,point.y,c.interaction.purchase_radius);
      if(building){let button=this.skipButtons.get(o.id);if(!button){button=new WorldLabel(this,0,0,t('world.skip'),'clock','success').setDepth(layers.groundUI).makeInteractive();button.on('pointerdown',(_p:Phaser.Input.Pointer,_x:number,_y:number,event:Phaser.Types.Input.EventData)=>{event.stopPropagation();if(!this.engine.controlsLocked)this.onSkip?.(o.id);});this.skipButtons.set(o.id,button);}button.setPosition(point.x,label.y+label.height/2+12+button.height/2);}
    }
  }
  private interactPurchase(id:string){if(this.engine.controlsLocked)return;const point=purchasePoint(this.engine.config,id);this.navigate(point.x,point.y);}
  private drawCrate(g: Phaser.GameObjects.Graphics,x:number,y:number,color:number) {g.fillStyle(0x7c624c).fillRoundedRect(x-10,y-10,20,18,3);g.fillStyle(color).fillRect(x-7,y-7,14,12);g.lineStyle(2,0xe5cb8e).lineBetween(x-8,y,x+8,y);g.lineBetween(x,y-8,x,y+7);}
  private drawBoat(b: Boat,texture: string) {
    const art=boatArt[texture],frame=directionFrame(b.angle);
    let v=this.boatViews.get(b.id);
    if(!v) {v={hull:this.add.image(b.x,b.y,art?.key??texture).setDepth(layers.boat),cargo:[],name:new WorldLabel(this,b.x,b.y,'',null,texture==='pirate'?'danger':'neutral',true).setDepth(layers.marker),hp:this.add.graphics().setDepth(layers.marker),motion:newMotion(b.x,b.y,b.angle)};this.boatViews.set(b.id,v);}
    const motion=stepMotion(v.motion,b.x,b.y,b.angle,this.visualDt),bob=Math.sin(this.visualTime*animation.boats.frequency+phase(b.id))*animation.boats.bob;
    if(motion.speed>3&&motion.speed<1000&&this.visualTime>v.motion.wakeAt){this.effects.wake(b.x,b.y,motion.dx,motion.dy,texture==='speedboat');v.motion.wakeAt=this.visualTime+animation.boats.wakeInterval*(texture==='worker'?1.6:1);}
    v.hull.setTint((this.hitUntil.get(b.id)??0)>this.visualTime?0xffbbbb:0xffffff);
    v.hull.setPosition(b.x,b.y+bob).setRotation(art?Math.sin(this.visualTime*1.4+phase(b.id))*animation.boats.roll:b.angle).setAlpha(b.hp===0 && ['player','defender'].includes(texture)?0.35:1);
    // Speed atlas frame 7 repeats NE; mirror frame 1 for NW. Cargo uses the logical heading.
    if(art){const birth=this.constructionBirths.get(b.id),t=birth===undefined?1:Math.min(1,(this.visualTime-birth)/.42),scale=1+Math.sin(t*Math.PI*2)*.09*(1-t);v.hull.setTexture(art.key,texture==='speedboat'&&frame===7?1:frame).setFlipX(texture==='speedboat'&&frame===7).setDisplaySize(art.size*scale,art.size*scale);}
    const count=Math.min(b.cargo.length,animation.cargo.maxVisible);
    for(let i=v.cargo.length-1;i>=0;i--)if(!b.cargo.some((item,index)=>index<count&&item.id===v!.cargo[i].id)){v.cargo[i].image.destroy();v.cargo.splice(i,1);}
    const anchor=cargoPosition(frame,0,count,b.kind),blend=1-Math.exp(-this.visualDt*18);
    if(!Number.isFinite(v.motion.anchorX)){v.motion.anchorX=anchor.x;v.motion.anchorY=anchor.y;}
    v.motion.anchorX+=(anchor.x-v.motion.anchorX)*blend;v.motion.anchorY+=(anchor.y-v.motion.anchorY)*blend;
    const bounce=v.motion.impact>0?Math.sin((.24-v.motion.impact)/.24*Math.PI*2)*3*v.motion.impact/.24:0;
    for(let i=0;i<count;i++){
      const item=b.cargo[i];let view=v.cargo.find(view=>view.id===item.id);
      if(!view){view={id:item.id,image:this.add.image(b.x,b.y,crateKey(item.resource)!).setDisplaySize(cargoSize.deck,cargoSize.deck)};v.cargo.push(view);}
      const offset=cargoPosition(frame,i,count,b.kind),rise=i*animation.cargo.rise;
      view.image.setTexture(crateKey(item.resource)!).setPosition(b.x+v.motion.anchorX+offset.x-anchor.x+Math.sin(v.motion.lean)*rise,b.y+bob+v.motion.anchorY-rise+bounce).setRotation(v.motion.lean*(.45+.55*i/Math.max(1,count-1))).setDepth(layers.cargo+i*.001).setAlpha(v.hull.alpha).setVisible(!this.pickupFlights.has(item.id));
    }
    const full=b.cargo.length>=capacity(this.engine.config,this.engine.state,b);
    const name=texture==='pirate'?t('world.pirate'):b.id==='defender'?t('world.defender'):b.kind==='player'?t('world.player'):b.kind==='speedboat'?t('world.speedboat'):b.kind==='salvage'?t('world.salvage'):t('world.worker');
    v.name.setVisible(this.showBoatNames).setTone(texture==='pirate'?'danger':full?'gold':'neutral').setPosition(b.x,b.y+65).setText(b.kind==='player'&&texture!=='pirate'&&full?t('world.full',{count:b.cargo.length}):`${name}${b.cargo.length?' · '+b.cargo.length:''}`);
    // Civilian boats use hp=0 as a sentinel and have no combat health mechanic.
    const max=texture==='pirate'?this.engine.config.combat.pirate_hp:texture==='defender'?this.engine.config.combat.defender_hp:texture==='player'?this.engine.config.units.player.hp:0;
    v.hp.clear().setVisible(max>0 && b.hp<max);
    if(v.hp.visible)this.drawHealthBar(v.hp,b.x,b.y-58,46,b.hp/max);
  }
  private drawHealthBar(g:Phaser.GameObjects.Graphics,x:number,y:number,width:number,fraction:number){
    const fill=(width-6)*Phaser.Math.Clamp(fraction,0,1);
    g.fillStyle(0x062f40,.96).fillRoundedRect(x-width/2,y-5,width,10,5);
    g.lineStyle(1,0x4f9caa,.85).strokeRoundedRect(x-width/2,y-5,width,10,5);
    if(fill>0)g.fillStyle(0x69dc79,1).fillRoundedRect(x-width/2+3,y-2,fill,4,Math.min(2,fill/2));
  }
  private deckPoint(boat:string,index?:number){
    const b=this.engine.state.boats.find(b=>b.id===boat),v=this.boatViews.get(boat);
    if(!b)return {x:v?.hull.x??0,y:v?.hull.y??0};
    const i=Math.min(index??Math.max(0,b.cargo.length-1),animation.cargo.maxVisible-1),offset=cargoPosition(directionFrame(b.angle),i,b.cargo.length,b.kind);
    if(v&&Number.isFinite(v.motion.anchorX))return {x:b.x+v.motion.anchorX+Math.sin(v.motion.lean)*i*animation.cargo.rise,y:v.hull.y+v.motion.anchorY-i*animation.cargo.rise};
    return {x:b.x+offset.x,y:b.y+offset.y};
  }
  private animateBuildings(){
    const objects:Record<string,Phaser.GameObjects.Image>={secondPort:this.environment.gateBuilding,defender:this.environment.defender,storage:this.environment.storage,den:this.environment.lair};
    for(const [id,start] of this.constructionBirths){const age=this.visualTime-start,t=Math.min(1,age/.42),image=objects[id];
      if(image){const factor=1+Math.sin(Math.PI*t*2)*.09*(1-t),base=id==='secondPort'?{w:143,h:169}:id==='defender'?{w:203,h:221}:id==='storage'?{w:244,h:214}:{w:194,h:194};image.setDisplaySize(base.w*factor,base.h*factor);}
      if(t===1)this.constructionBirths.delete(id);
    }
    for(const [id,order] of Object.entries(this.engine.state.orders))if(order.readyAt!==null&&!order.complete){const p=purchasePoint(this.engine.config,id);if(Math.floor(this.visualTime*3)!==Math.floor((this.visualTime-this.visualDt)*3))this.effects.particle('spark',p.x+Math.sin(this.visualTime*8)*22,p.y,2,0xf1d6a1,.4,0,-20);}
    for(const [id,time] of this.hitUntil)if(time<this.visualTime)this.hitUntil.delete(id);
  }
  private drawEvents() {
    const s=this.engine.state,c=this.engine.config;
    let first=s.events.length;while(first>0 && s.events[first-1].seq>this.lastEvent)first--;
    for(let i=first;i<s.events.length;i++) {const e=s.events[i];
      if(e.type==='harvest'||e.type==='crate_pickup'){
        const id=Number(e.data.crate),boat=String(e.data.boat),b=s.boats.find(b=>b.id===boat),item=b?.cargo.find(item=>item.id===id);
        if(!item)continue;
        const old=this.crateViews.get(id),from=old?{x:old.x,y:old.y}:{x:Number(e.data.x),y:Number(e.data.y)};
        old?.destroy();this.crateViews.delete(id);this.bursts.delete(id);
        this.effects.splash(from.x,from.y);
        const index=b!.cargo.findIndex(item=>item.id===id);
        if(this.effects.flight(crateKey(item.resource)!,from,()=>this.deckPoint(boat,index),cargoSize.deck,animation.cargo.pickup,22,()=>{this.pickupFlights.delete(id);const v=this.boatViews.get(boat);if(v)v.motion.impact=.24;},id))this.pickupFlights.add(id);
      }
      if(e.type==='delivery'){
        const id=Number(e.data.crate),boat=String(e.data.boat),v=this.boatViews.get(boat),from=this.deckPoint(boat,v?Math.max(0,v.cargo.length-1):0);
        const resource=String(e.data.resource??(e.data.kind==='fish'?'sardine':'wreck')),destination=e.data.kind==='fish'?fishUnload(c,s,{x:Number(e.data.x),y:Number(e.data.y)}):c.world.storage;
        this.effects.cancel(id);this.pickupFlights.delete(id);
        this.effects.flight(crateKey(resource)!,from,()=>({x:destination.x,y:destination.y-20}),cargoSize.delivery,animation.cargo.unload,28,()=>this.effects.spark(destination.x,destination.y-20,3,0xffe4ab));
        if(v)v.motion.impact=.24;
      }
      if(e.type==='coin_spawn'){const id=Number(e.data.id);if(s.coinStacks.some(p=>p.id===id)){this.coinBirths.set(id,{start:this.visualTime,fromX:Number(e.data.source==='fish_sale'?e.data.x:e.data.fromX),fromY:Number(e.data.source==='fish_sale'?e.data.y:e.data.fromY)});this.effects.spark(Number(e.data.x),Number(e.data.y),e.data.source==='golden_reward'?6:2,0xffdf84);}}
      if(e.type==='coin_collect'){this.coinBirths.delete(Number(e.data.id));this.effects.number(Number(e.data.x),Number(e.data.y),Number(e.data.value),e.data.source==='golden_reward');}
      if(e.type==='resource_depleted'){const r=c.resources[String(e.data.id)];this.effects.splash(r.x,r.y,true);}
      if(e.type==='metal_overflow' && this.visualTime-this.lastOverflowNotice>1.2){this.lastOverflowNotice=this.visualTime;this.effects.message(c.world.storage.x+80,c.world.storage.y-65,t('world.storageFull'));}
      if(e.type==='resource_recovered'){const r=c.resources[String(e.data.id)];this.effects.particle('ring',r.x,r.y,34,0xb9efd4,.6);}
      if(e.type==='crate_spawn'){const id=Number(e.data.id);if(s.crates.some(crate=>crate.id===id))this.bursts.set(id,{x:Number(e.data.fromX),y:Number(e.data.fromY),start:this.visualTime,duration:c.resource_burst.duration_s});}
      if(e.type==='combat_attack')this.effects.spark(Number(e.data.x),Number(e.data.y),3,0xffefd0);
      if(e.type==='combat_hit'){this.hitUntil.set(String(e.data.target),this.visualTime+.16);this.effects.splash(Number(e.data.x),Number(e.data.y));this.effects.spark(Number(e.data.x),Number(e.data.y),5,0xffbf8e);}
      if(e.type==='pirate_killed'){
        const x=Number(e.data.x),y=Number(e.data.y),angle=Number(e.data.angle);this.effects.splash(x,y,true);
        if(this.effects.flight(boatArt.pirate.key,{x,y},()=>({x,y:y+17}),boatArt.pirate.size,.4,0)){const flight=this.effects.flights.at(-1)!;flight.image.setFrame(directionFrame(angle));flight.sinking=true;}
        for(let i=0;i<4;i++)this.effects.particle('spark',x,y,4,0x9e7751,.55,Math.cos(i*2)*35,Math.sin(i*2)*35);
      }
      if(e.type==='timer_finish'){const id=String(e.data.id),p=purchasePoint(c,id);this.constructionBirths.set(id,this.visualTime);this.effects.spark(p.x,p.y,8,0xffedab);this.effects.particle('ring',p.x,p.y,40,0xe4f5ba,.5);const building=id==='secondPort'?this.environment.gateBuilding:id==='defender'?this.environment.defender:id==='storage'?this.environment.storage:id==='den'?this.environment.lair:null;if(building)this.effects.spark(building.x,building.y,6,0xffedab);}
      if(e.type==='area_open')this.cameras.main.flash(500,181,223,198);
    }
    this.lastEvent=s.eventSeq;
  }
}

