import type Phaser from 'phaser';
import type {Balance} from '../../config/types';
import {defenderStation} from '../../config/mapLayout';
import {layers} from './registry';

export type Prop={key:string;x:number;y:number;width:number;height:number;zone:1|2;alpha?:number};
// Decoration only. Neither this table nor the image bounds are supplied to navigation/input.
export const resourceDressing:Prop[]=[
  {key:'env_30',x:1600,y:1240,width:78,height:58,zone:1,alpha:.48},
  {key:'env_14',x:1210,y:928,width:65,height:54,zone:1,alpha:.85},
  {key:'env_12',x:370,y:1518,width:90,height:64,zone:1,alpha:.85},
  {key:'env_33',x:970,y:2070,width:68,height:58,zone:1,alpha:.48},
  {key:'env_38',x:1740,y:755,width:77,height:55,zone:1,alpha:.75},
  {key:'env_36',x:2030,y:1010,width:72,height:64,zone:2,alpha:.75},
  {key:'env_07',x:2720,y:745,width:44,height:36,zone:2,alpha:.65},
  {key:'env_37',x:3210,y:1690,width:85,height:66,zone:2,alpha:.8},
  {key:'env_55',x:2780,y:2230,width:52,height:40,zone:2,alpha:.75},
  {key:'env_15',x:2240,y:2260,width:65,height:52,zone:2,alpha:.65},
  {key:'env_06',x:2880,y:1200,width:68,height:56,zone:2,alpha:.65},
];
export function assembleEnvironment(scene:Phaser.Scene,c:Balance){
  const zone2:Phaser.GameObjects.Image[]=[];
  const place=(key:string,x:number,y:number,width:number,height:number,zone=1,depth:number=layers.coast,alpha=1)=>{
    const image=scene.add.image(x,y,key).setDisplaySize(width,height).setOrigin(.5).setDepth(depth).setAlpha(alpha);
    if(zone===2)zone2.push(image);return image;
  };
  // Original land positions and radii remain authoritative. Art replaces the flat ellipses.
  const land=c.navigation.obstacles;
  place('building-harbor_main',land[0].x,land[0].y+8,352,250,1,layers.harbor);
  place('env_39',land[1].x,land[1].y+12,240,160);place('env_17',460,820,105,108,1,1.2);
  place('env_49',land[2].x,land[2].y+12,405,220);place('env_17',1390,405,122,125,1,1.2);place('env_03',1580,435,108,96,1,1.2);
  place('env_51',land[3].x,land[3].y+5,485,210);place('env_18',595,2175,94,120,1,1.2);place('env_12',790,2220,95,66,1,1.2);
  place('env_39',land[4].x,land[4].y+18,300,165,2);
  const storage=place('building-scrap_storage',land[4].x,land[4].y-24,244,214,2,layers.harbor);
  const defenderPoint=defenderStation(c);
  const defender=place('building-defender_dock',defenderPoint.x,defenderPoint.y,203,221,2,layers.harbor);
  place('env_49',land[5].x,land[5].y+10,418,235,2).setTint(0xc5c9bd);
  place('env_09',3090,315,144,125,2,1.2);place('env_37',2910,350,83,71,2,1.2);
  place('env_15',c.combat.spawner.x,c.combat.spawner.y+15,195,126,2);
  const lair=place('building-pirate_lair',c.combat.spawner.x,c.combat.spawner.y-26,194,194,2,layers.harbor);
  // The chart post sits alongside the functional gate point, leaving the interaction circle clear.
  const gate=c.interaction.purchase_points.gate;
  // Modest chart marker preserves the gate interaction; reuse its hut at the new dock.
  const gateMarker=scene.add.graphics().setDepth(layers.marker);
  gateMarker.lineStyle(3,0xf2d9a1,.65).strokeCircle(gate.x,gate.y,19).lineBetween(gate.x-12,gate.y,gate.x+12,gate.y).lineBetween(gate.x,gate.y-12,gate.x,gate.y+12);
  const hut=c.second_port?.hut??{x:2660,y:1250};
  const gateBuilding=place('building-zone2_purchase',hut.x,hut.y,143,169,1,layers.harbor).setVisible(false);
  for(const p of resourceDressing)place(p.key,p.x,p.y,p.width,p.height,p.zone,.4,p.alpha??1);
  return {zone2,lair,storage,defender,gateBuilding};
}
