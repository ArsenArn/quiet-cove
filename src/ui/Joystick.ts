import type {Balance,Point} from '../config/types';
type Settings=Pick<Balance['interaction'],'joystick_radius'|'joystick_deadzone'|'joystick_opacity'|'joystick_thumb_radius'>;
export function joystickVector(dx:number,dy:number,radius:number,deadzone:number):Point {
  const length=Math.hypot(dx,dy),magnitude=Math.min(1,length/radius);
  if(magnitude<=deadzone || length===0)return {x:0,y:0};
  const strength=(magnitude-deadzone)/(1-deadzone);
  return {x:dx/length*strength,y:dy/length*strength};
}
export class Joystick {
  private pointer:number|null=null;
  private origin:Point={x:0,y:0};
  private listeners=new AbortController();
  get active(){return this.pointer!==null;}
  constructor(private surface:HTMLElement,private pad:HTMLElement,private thumb:HTMLElement,private settings:()=>Settings,private changed:(point:Point)=>void,private started:()=>void,private canStart:(x:number,y:number)=>boolean){
    const options={signal:this.listeners.signal};
    surface.addEventListener('pointerdown',e=>{
      if(this.pointer!==null || e.button!==0 || !this.canStart(e.clientX,e.clientY))return;
      e.preventDefault();this.pointer=e.pointerId;this.origin={x:e.clientX,y:e.clientY};
      try{surface.setPointerCapture(e.pointerId);}catch{this.reset();return;}
      this.pad.style.left=`${e.clientX}px`;this.pad.style.top=`${e.clientY}px`;this.pad.hidden=false;
      this.started();this.move(e);
    },options);
    surface.addEventListener('pointermove',e=>this.move(e),options);
    for(const type of ['pointerup','pointercancel','lostpointercapture'] as const)surface.addEventListener(type,e=>{if(e.pointerId===this.pointer)this.reset();},options);
    window.addEventListener('blur',()=>this.reset(),options);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.reset();},options);
    this.pad.hidden=true;this.configure();
  }
  configure(){const c=this.settings();this.pad.style.setProperty('--joystick-radius',`${c.joystick_radius}px`);this.pad.style.setProperty('--joystick-thumb-radius',`${c.joystick_thumb_radius}px`);this.pad.style.setProperty('--joystick-opacity',String(c.joystick_opacity));}
  private move(e:PointerEvent){
    if(e.pointerId!==this.pointer)return;e.preventDefault();e.stopPropagation();
    const c=this.settings(),dx=e.clientX-this.origin.x,dy=e.clientY-this.origin.y,d=Math.hypot(dx,dy),radius=c.joystick_radius-c.joystick_thumb_radius,scale=d>radius?radius/d:1;
    this.thumb.style.transform=`translate(${dx*scale}px,${dy*scale}px)`;
    this.changed(joystickVector(dx,dy,radius,c.joystick_deadzone));
  }
  reset(){const id=this.pointer;this.pointer=null;this.pad.hidden=true;this.changed({x:0,y:0});this.thumb.style.transform='';if(id!==null && this.surface.hasPointerCapture(id))this.surface.releasePointerCapture(id);}
  destroy(){this.reset();this.listeners.abort();}
}
