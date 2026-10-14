import type { Engine } from '../engine';
// Wall-clock frames avoid Phaser's focus cooldown / smoothed delta undercounting.
export class FrameClock {
  private previous:number|null=null;
  reset(){this.previous=null;}
  step(now:number) {const dt=this.previous===null?0:Math.max(0,Math.min(.1,(now-this.previous)/1000));this.previous=now;return dt;}
}
export class VisibilityLifecycle {
  private hiddenAt:number|null=null;
  constructor(private engine:Engine,private clock:FrameClock){}
  suspend(now:number) {if(this.hiddenAt!==null)return;this.hiddenAt=now;this.engine.paused=true;this.engine.input={x:0,y:0};this.clock.reset();}
  resume(now:number) {if(this.hiddenAt===null)return;this.engine.settleOffline(Math.max(0,(now-this.hiddenAt)/1000));this.hiddenAt=null;this.clock.reset();this.engine.paused=false;}
}
