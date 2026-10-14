import Phaser from 'phaser';
import {animation} from './animation';
import {layers} from './registry';
type Point={x:number;y:number};
type Flight={image:Phaser.GameObjects.Image;age:number;duration:number;from:Point;to:()=>Point;arc:number;size:number;done?:()=>void;tag?:number; sinking?:boolean};
type Feedback={text:Phaser.GameObjects.Text;age:number;x:number;y:number;duration?:number};
type Particle={active:boolean;age:number;duration:number;x:number;y:number;vx:number;vy:number;size:number;color:number;kind:'ring'|'spark'|'wake'|'bubble';angle:number};
// Shared bounded pools. No timers/tweens or textures are created per frame.
export class VisualEffects {
  readonly flights:Flight[]=[];
  readonly feedback:Feedback[]=[];
  private imagePool:Phaser.GameObjects.Image[]=[];
  private textPool:Phaser.GameObjects.Text[]=[];
  readonly particles:Particle[]=Array.from({length:animation.vfx.maxParticles},()=>({active:false,age:0,duration:0,x:0,y:0,vx:0,vy:0,size:0,color:0,kind:'spark',angle:0}));
  private graphics:Phaser.GameObjects.Graphics;
  peak={flights:0,particles:0,feedback:0};
  constructor(private scene:Phaser.Scene){this.graphics=scene.add.graphics().setDepth(2.5);}
  flight(key:string,from:Point,to:()=>Point,size:number,duration:number,arc=24,done?:()=>void,tag?:number){
    if(this.flights.length>=animation.vfx.maxFlights)return false;
    const image=this.imagePool.pop()??this.scene.add.image(0,0,key).setDepth(layers.effect);
    image.setTexture(key).setVisible(true).setAlpha(1).setRotation(0).setDisplaySize(size,size).setPosition(from.x,from.y);
    this.flights.push({image,from:{...from},to,size,duration,arc,age:0,done,tag});this.peak.flights=Math.max(this.peak.flights,this.flights.length);return true;
  }
  cancel(tag:number){for(let i=this.flights.length-1;i>=0;i--)if(this.flights[i].tag===tag)this.release(i,false);}
  private release(index:number,complete=true){const f=this.flights[index];f.image.setVisible(false);this.imagePool.push(f.image);this.flights.splice(index,1);if(complete)f.done?.();}
  number(x:number,y:number,value:number,golden=false){
    if(this.feedback.length>=animation.vfx.maxFeedback)return;
    let nearby=0;for(const f of this.feedback)if(Math.abs(f.x-x)<100&&Math.abs(f.y-y)<150)nearby++;
    const offset=[0,-58,58][nearby%3],numberX=x+offset,numberY=y-26-Math.floor(nearby/3)*25;
    const text=this.textPool.pop()??this.scene.add.text(0,0,'',{fontFamily:'system-ui',fontSize:'18px',color:'#ffe08a',fontStyle:'bold',stroke:'#234751',strokeThickness:3}).setOrigin(.5).setDepth(9);
    text.setText(`+${value} ◉`).setPosition(numberX,numberY).setVisible(true).setAlpha(1);this.feedback.push({text,age:0,x:numberX,y:numberY});this.peak.feedback=Math.max(this.peak.feedback,this.feedback.length);this.spark(x,y,golden?12:5,0xffdb79);
  }
  message(x:number,y:number,value:string){
    if(this.feedback.length>=animation.vfx.maxFeedback)return;
    const text=this.textPool.pop()??this.scene.add.text(0,0,'',{fontFamily:'system-ui',fontSize:'18px',color:'#ffe08a',fontStyle:'bold',stroke:'#234751',strokeThickness:3}).setOrigin(.5).setDepth(9);
    text.setText(value).setPosition(x,y).setVisible(true).setAlpha(1);
    this.feedback.push({text,age:0,x,y,duration:1.2});
  }
  particle(kind:Particle['kind'],x:number,y:number,size:number,color:number,duration:number,vx=0,vy=0,angle=0){
    if(animation.vfx.quality==='off')return;
    const limit=animation.vfx.quality==='low'?48:this.particles.length;
    for(let i=0;i<limit;i++){const p=this.particles[i];if(p.active)continue;Object.assign(p,{active:true,age:0,duration,x,y,vx,vy,size,color,kind,angle});return;}
    // Coin/impact feedback gets a slot before a decorative wake when the fleet fills the pool.
    if(kind!=='wake')for(let i=0;i<limit;i++){const p=this.particles[i];if(p.kind==='wake'){Object.assign(p,{active:true,age:0,duration,x,y,vx,vy,size,color,kind,angle});return;}}
  }
  splash(x:number,y:number,strong=false){this.particle('ring',x,y,strong?27:10,0xd2f4ee,.55);this.spark(x,y,strong?8:3,0xd4f5ee);}
  spark(x:number,y:number,count:number,color:number){if(animation.vfx.quality==='low')count=Math.min(count,3);for(let i=0;i<count;i++){const a=i*2.39996;this.particle('spark',x,y,2+i%2,color,.35+i%3*.1,Math.cos(a)*(22+i*2),Math.sin(a)*22-12);}}
  wake(x:number,y:number,dx:number,dy:number,strong=false){const a=Math.atan2(dy,dx),back=26;for(const side of [-1,1])this.particle('wake',x-Math.cos(a)*back-Math.sin(a)*side*10,y-Math.sin(a)*back+Math.cos(a)*side*10,strong?18:12,0xcceaf3,.75,-Math.cos(a)*9-Math.sin(a)*side*9,-Math.sin(a)*9+Math.cos(a)*side*9,a+side*.45);}
  update(dt:number){
    dt=Math.min(.05,dt);this.graphics.clear();let active=0;
    for(const p of this.particles){if(!p.active)continue;p.age+=dt;if(p.age>=p.duration){p.active=false;continue;}active++;const t=p.age/p.duration,x=p.x+p.vx*p.age,y=p.y+p.vy*p.age,a=(1-t)*.65,g=this.graphics;
      if(p.kind==='ring'){g.lineStyle(1.5,p.color,a).strokeEllipse(x,y,p.size*(1+t*2),p.size*(.5+t));}
      else if(p.kind==='wake'){g.lineStyle(2,p.color,a*.65).lineBetween(x-Math.cos(p.angle)*p.size/2,y-Math.sin(p.angle)*p.size/2,x+Math.cos(p.angle)*p.size/2,y+Math.sin(p.angle)*p.size/2);}
      else if(p.kind==='bubble')g.lineStyle(1,p.color,a).strokeCircle(x,y,p.size);
      else g.fillStyle(p.color,a).fillCircle(x,y+p.age*p.age*20,p.size*(1-t*.4));
    }this.peak.particles=Math.max(this.peak.particles,active);
    for(let i=this.flights.length-1;i>=0;i--){const f=this.flights[i];f.age+=dt;const t=Math.min(1,f.age/f.duration),end=f.to(),ease=t*t*(3-2*t),scale=f.sinking?1-t*.45:1+Math.sin(Math.PI*t)*.12;f.image.setPosition(f.from.x+(end.x-f.from.x)*ease,f.from.y+(end.y-f.from.y)*ease-Math.sin(Math.PI*t)*f.arc).setDisplaySize(f.size*scale,f.size*scale);if(f.sinking)f.image.setAlpha((1-t)*.7);if(t===1)this.release(i);}
    for(let i=this.feedback.length-1;i>=0;i--){const f=this.feedback[i];f.age+=dt;const duration=f.duration??.7;f.text.setPosition(f.x,f.y-f.age*(f.duration?20:65)).setAlpha(Math.max(0,1-f.age/duration));if(f.age>=duration){f.text.setVisible(false);this.textPool.push(f.text);this.feedback.splice(i,1);}}
  }
  clear(){for(const f of this.flights)f.image.destroy();for(const v of this.imagePool)v.destroy();for(const f of this.feedback)f.text.destroy();for(const t of this.textPool)t.destroy();this.graphics.destroy();this.flights.length=0;this.feedback.length=0;this.imagePool.length=0;this.textPool.length=0;for(const p of this.particles)p.active=false;}
}
