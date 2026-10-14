// Presentation only: seconds/pixels, independent of simulation speed and save data.
export const animation = {
  cargo: { maxVisible: 7, rise: 7, maxLean: 7*Math.PI/180, spring: 11, pickup: .28, unload: .30 },
  boats: { bob: 1.6, frequency: 1.8, roll: .009, wakeInterval: .11 },
  coins: {single:32,small_stack:38,large_pile:44},
  vfx: { quality: 'high' as 'high'|'low'|'off', maxFlights: 96, maxFeedback: 64, maxParticles: 192 },
};
export type Motion = {x:number;y:number;angle:number;vx:number;lean:number;velocity:number;drive:number;anchorX:number;anchorY:number;impact:number;wakeAt:number;fishAt:number};
export function phase(id:string){let hash=0;for(let i=0;i<id.length;i++)hash=(hash*31+id.charCodeAt(i))|0;return (hash>>>0)%628/100;}
export function newMotion(x:number,y:number,angle:number):Motion{return {x,y,angle,vx:0,lean:0,velocity:0,drive:0,anchorX:NaN,anchorY:NaN,impact:0,wakeAt:0,fishAt:0};}
export function stepMotion(m:Motion,x:number,y:number,angle:number,dt:number){
  dt=Math.max(.001,Math.min(.05,dt));
  const dx=x-m.x,dy=y-m.y,speed=Math.hypot(dx,dy)/dt;
  const turn=Math.atan2(Math.sin(angle-m.angle),Math.cos(angle-m.angle));
  const acceleration=dx/dt-m.vx;
  m.drive=Math.max(-animation.cargo.maxLean,Math.min(animation.cargo.maxLean,m.drive-turn*.25-acceleration*.0005))*Math.exp(-dt*5);
  const target=speed>.5?m.drive:0;
  // Exact critically damped spring: stable with variable renderer FPS.
  const omega=animation.cargo.spring,offset=m.lean-target,term=m.velocity+omega*offset,decay=Math.exp(-omega*dt);
  m.lean=target+(offset+term*dt)*decay;m.velocity=(m.velocity-omega*term*dt)*decay;
  m.lean=Math.max(-animation.cargo.maxLean,Math.min(animation.cargo.maxLean,m.lean));
  m.x=x;m.y=y;m.angle=angle;m.vx=dx/dt;m.impact=Math.max(0,m.impact-dt);
  return {speed,dx,dy};
}
export function ambient(id:string,time:number){
  const amplitude=id==='wreck'?.1:id==='mussel'?.7:['crab','lobster'].includes(id)?1:id==='squid'?1.8:1.6;
  const t=time*.65+phase(id);
  return {x:Math.sin(t*.7)*amplitude*.2,y:Math.sin(t)*amplitude,scale:1,rotation:Math.sin(t*.7)*.001*amplitude};
}
export function netShape(progress:number){const p=Math.max(0,Math.min(1,progress)),cast=1-(1-Math.min(1,p/.25))**3;return {rx:26+17*cast,ry:17+11*cast};}
