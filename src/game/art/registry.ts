import type Phaser from 'phaser';
import type { ResourceConfig } from '../../config/types';
import type { NodeState } from '../state';
import {animation} from './animation';

// Only renderer metadata; no gameplay numbers or persisted state live here.
export const boatArt: Record<string,{key:string;file:string;size:number}> = {
  player:{key:'art-player',file:'player',size:104}, worker:{key:'art-worker',file:'worker',size:98},
  speedboat:{key:'art-speed',file:'speed',size:106}, golden:{key:'art-golden',file:'golden',size:108},
  defender:{key:'art-defender',file:'guard',size:108},pirate:{key:'art-pirate',file:'pirate',size:104},
  salvage:{key:'art-salvage',file:'salvage',size:108},
};
export const resourceArt: Record<string,string> = {sardine:'sardines',crab:'crabs',mussel:'mussels',snapper:'red_snapper',tuna:'tuna',lobster:'lobster',swordfish:'swordfish',squid:'squid',wreck:'shipwreck'};
// Fixed caption top offsets: the lowest opaque pixel across all four frames,
// scaled to world size, plus ambient bob and a small gap. Transparent atlas
// margins do not push the caption away from the visible resource.
export const resourceCaptionTop:Record<string,number>={sardine:55,crab:71,mussel:64,snapper:65,tuna:59,lobster:67,swordfish:67,squid:79,wreck:92};
export const cargoSize={deck:36,floating:42,delivery:36};
export const environmentArt=[3,6,7,9,12,14,15,17,18,30,33,36,37,38,39,49,51,55];
export const buildingArt=['harbor_main','pirate_lair','defender_dock','zone2_purchase','scrap_storage'];
export const waterArt={key:'art-water-tile',tileScale:.65,tint:0x91c4ce,alpha:.72};
export const layers={water:-20,coast:0,resource:1,loot:2,harbor:3,groundUI:3.5,boat:4,cargo:5,marker:7,effect:8};
export const directions=['N','NE','E','SE','S','SW','W','NW'] as const;
export function directionFrame(angle:number) {return ((Math.round((angle+Math.PI/2)/(Math.PI/4))%8)+8)%8;}
export function resourceFrame(r:ResourceConfig,n:NodeState):number|null {
  if(!n.unlocked || n.phase!=='ready' || n.stock<=0 || n.hp<=0)return null;
  // stock counts portions including the current one. HP resets must not reset the overall stage.
  const fraction=Math.max(0,Math.min(1,(n.stock-1+n.hp/r.portion_hp)/r.stock));
  return fraction>.75?0:fraction>.5?1:fraction>.25?2:3;
}
export function coinArt(value:number,source:string) {return source==='golden_reward'||value>=100?'large_pile':value>=10?'small_stack':'single';}
export function crateKey(resource:string) {return resourceArt[resource]?`crate-${resource}`:null;}
// Deck coordinates in world pixels at the displayed size. Bow follows the eight views, crates remain upright.
export const cargoAnchors:Record<string,readonly {x:number;y:number}[]>={
  player:[{x:0,y:12},{x:-12,y:8},{x:-20,y:2},{x:-13,y:-9},{x:0,y:-18},{x:13,y:-9},{x:20,y:2},{x:12,y:8}],
  worker:[{x:-8,y:22},{x:-16,y:18},{x:-21,y:10},{x:-15,y:-3},{x:0,y:-10},{x:15,y:-3},{x:21,y:10},{x:16,y:18}],
  speedboat:[{x:-6,y:16},{x:-12,y:14},{x:-17,y:7},{x:-13,y:-4},{x:0,y:-9},{x:13,y:-4},{x:17,y:7},{x:12,y:14}],
  salvage:[{x:-9,y:24},{x:-16,y:20},{x:-23,y:13},{x:-17,y:-3},{x:0,y:-10},{x:17,y:-3},{x:23,y:13},{x:16,y:20}],
};
export function cargoPosition(frame:number,index:number,count:number,kind:string) {
  const anchor=(cargoAnchors[kind]??cargoAnchors.player)[frame],level=Math.min(index,animation.cargo.maxVisible-1);
  return {x:anchor.x+(level%2===0?-1:1)*level*.3,y:anchor.y-level*animation.cargo.rise};
}
export function movementHeading(previous:{x:number;y:number;angle:number}|null,current:{x:number;y:number},fallback:number){
  if(!previous)return fallback;
  const dx=current.x-previous.x,dy=current.y-previous.y;
  return Math.hypot(dx,dy)>.001?Math.atan2(dy,dx):previous.angle;
}
export function preloadArt(scene:Phaser.Scene) {
  for(const art of Object.values(boatArt)) {
    scene.load.spritesheet(art.key,`assets/boats/boat_${art.file}_8dir.png`,{frameWidth:192,frameHeight:192});
  }
  for(const [id,file] of Object.entries(resourceArt)) {
    scene.load.spritesheet(`resource-${id}`,`assets/resources/${file}_4states.png`,{frameWidth:192,frameHeight:192});
    scene.load.image(`crate-${id}`,`assets/cargo/crate_${id==='wreck'?'scrap':file}.png`);
  }
  for(const file of ['single','small_stack','large_pile'])scene.load.image(`coin-${file}`,`assets/coins/coin_${file}.png`);
  for(const file of buildingArt)scene.load.image(`building-${file}`,`assets/buildings/${file}.png`);
  for(const number of environmentArt){const file=`env_${String(number).padStart(2,'0')}`;scene.load.image(file,`assets/environment/${file}.png`);}
  scene.load.image(waterArt.key,'assets/water/water_approved_mirrored_tile.png');
}
