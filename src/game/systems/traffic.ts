import type { Balance, Point, TrafficConfig } from '../../config/types';
import type { Boat, Enemy, GameState } from '../state';
import {fishUnload,fishPortKey} from './delivery';
import { clearSegment, distance, forgetRoute, navigateTo, navigationTarget, onLand, routeTo, setMotionHandler, type MotionHandler } from './movement';

type Hull=Boat|Enemy;
type Body={hull:Hull;radius:number;cell:number;rank:number;vx:number;vy:number;lastX:number;lastY:number;lastDt:number;stuck:number;repathAt:number;budget:number;travelBudget:number;turn:number;nearby:Body[];candidate:Point;handler?:MotionHandler;egress?:Point;park?:Point;detour?:Point;detourUntil?:number;detourAt?:number};
type Berth={points:Point[];owners:Map<Hull,number>;queue:Map<Hull,Point>;center:Point;radius:number};
export type TrafficMetrics={neighborChecks:number;corrections:number;repaths:number;waiting:number;maxCorrection:number};
const worlds=new WeakMap<GameState,Traffic>();
const active=new WeakMap<Point,Traffic>();
const turns=[0,.35,-.35,.7,-.7,1.05,-1.05,1.4,-1.4,1.75,-1.75];

// No persistent fields, random calls or global path searches in pair avoidance.
class Traffic {
  bodies:Body[]=[];
  private byHull=new WeakMap<Hull,Body>();
  private grid=new Map<number,Body[]>();
  private berths=new Map<string,Berth>();
  private frameActive=false;
  metrics:TrafficMetrics={neighborChecks:0,corrections:0,repaths:0,waiting:0,maxCorrection:0};
  constructor(private c:Balance,private s:GameState,private settings:TrafficConfig){}
  private key(p:Point) {return Math.floor(p.x/this.settings.neighbor_radius)+Math.floor(p.y/this.settings.neighbor_radius)*10000;}
  private insert(b:Body) {b.cell=this.key(b.hull);let bucket=this.grid.get(b.cell);if(!bucket){bucket=[];this.grid.set(b.cell,bucket);}bucket.push(b);}
  private relocate(b:Body) {if(this.key(b.hull)===b.cell)return;const bucket=this.grid.get(b.cell)!;bucket.splice(bucket.indexOf(b),1);this.insert(b);}
  private neighbors(b:Body,visit:(other:Body)=>void) {
    const key=this.key(b.hull),range=this.settings.neighbor_radius;
    for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){
      const bucket=this.grid.get(key+x+y*10000);if(!bucket)continue;
      for(const other of bucket)if(other!==b && Math.abs(other.hull.x-b.hull.x)<=range && Math.abs(other.hull.y-b.hull.y)<=range){this.metrics.neighborChecks++;visit(other);}
    }
  }
  private safe(p:Point,next:Point) {
    const world=this.c.world,m=world.edge_margin,maxX=this.s.area===1?world.gate_x-m:world.width-m;
    // Do not project a correction across an island or gate to find a free point.
    return next.x>=m && next.x<=maxX && next.y>=m && next.y<=world.height-m && (p!==this.s.defender||next.x>=world.gate_x+m) && !onLand(this.c,next) && clearSegment(this.c,p,next);
  }
  begin(dt:number,input:Point) {
    this.frameActive=true;
    for(const bucket of this.grid.values())bucket.length=0;
    this.bodies.length=0;
    const add=(hull:Hull,kind:keyof TrafficConfig['radii'])=>{
      let body=this.byHull.get(hull);
      if(!body){body={hull,radius:0,cell:0,rank:0,vx:0,vy:0,lastX:hull.x,lastY:hull.y,lastDt:dt,stuck:0,repathAt:0,budget:0,travelBudget:0,turn:0,nearby:[],candidate:{x:0,y:0}};const current=body;body.handler=(dx,dy,step)=>this.move(current,dx,dy,step);this.byHull.set(hull,body);}
      body.radius=this.settings.radii[kind];body.rank=this.bodies.length;body.budget=this.settings.correction_speed*dt;
      body.travelBudget=(kind==='defender'?this.c.combat.defender_speed:kind==='pirate'?this.c.combat.pirate_speed:this.c.units[kind].speed)*dt;
      body.vx=(hull.x-body.lastX)/body.lastDt;body.vy=(hull.y-body.lastY)/body.lastDt;body.lastDt=dt;body.lastX=hull.x;body.lastY=hull.y;
      // Existing combat respawns relocate a hull. Never predict that relocation
      // as a velocity through the bay, or keep a detour from its previous life.
      if(Math.hypot(body.vx,body.vy)>body.travelBudget/dt+this.settings.correction_speed+1){body.vx=0;body.vy=0;body.stuck=0;delete body.detour;delete body.egress;delete body.park;forgetRoute(hull);}
      this.bodies.push(body);this.insert(body);active.set(hull,this);setMotionHandler(hull,body.handler);
    };
    for(const b of this.s.boats)if(b.kind!=='player'||b.hp>0)add(b,b.kind);
    if(this.s.defender && this.s.defender.hp>0)add(this.s.defender,'defender');
    for(const e of this.s.enemies)if(e.hp>0)add(e,'pirate');
    // Release only arrival places; crate reservations belong exclusively to Worker AI.
    for(const [key,berth] of this.berths){
      const keep=(h:Hull)=>this.bodies.some(b=>b.hull===h) && 'kind' in h && this.intent(h)===key;
      for(const h of berth.owners.keys())if(!keep(h)){
        if(!key.startsWith('resource:') && distance(h,berth.center)<berth.radius+30){
          const body=this.byHull.get(h),slot=berth.points[berth.owners.get(h)!],d=distance(slot,berth.center);
          if(body && d>1){const point={x:berth.center.x+(slot.x-berth.center.x)/d*(berth.radius+35),y:berth.center.y+(slot.y-berth.center.y)/d*(berth.radius+35)};if(this.safe(slot,point))body.egress=point;}
        }
        berth.owners.delete(h);
      }
      for(const h of berth.queue.keys())if(!keep(h))berth.queue.delete(h);
    }
    const player=this.bodies.find(b=>b.hull.id==='player');
    // An idle worker gives way before contact, while an idle player is always pinned.
    if(player && Math.hypot(input.x,input.y)>0){
      const len=Math.hypot(input.x,input.y),scale=Math.min(1,len)/len,vx=input.x*scale*this.c.units.player.speed,vy=input.y*scale*this.c.units.player.speed;
      const future={x:player.hull.x+vx*.25,y:player.hull.y+vy*.25};
      this.neighbors(player,other=>{
        if(!('kind' in other.hull)||other.hull.id==='defender')return;
        const dx=other.hull.x+other.vx*.25-future.x,dy=other.hull.y+other.vy*.25-future.y,d=Math.hypot(dx,dy),r=player.radius+other.radius+3;
        if(d>=r)return;
        // Right of the player's course; avoid pushing a worker further along that course.
        const side=(other.hull.x-player.hull.x)*(-vy)+(other.hull.y-player.hull.y)*vx;
        const sign=side<0?-1:1;this.correct(other,-input.y/len*sign,input.x/len*sign,Math.min(other.budget,r-d));
      });
    }
    // Incremental recovery of close/stacked saves. Fixed ordering breaks exact symmetry.
    for(const b of this.bodies)this.neighbors(b,other=>{
      if(other.rank<=b.rank)return;
      const dx=other.hull.x-b.hull.x,dy=other.hull.y-b.hull.y,d=Math.hypot(dx,dy),overlap=b.radius+other.radius-d;
      if(overlap<=.01)return;
      const a=d>1e-6?Math.atan2(dy,dx):(other.rank*2.399963229728653),nx=Math.cos(a),ny=Math.sin(a);
      if(b.hull.id!=='player')this.correct(b,-nx,-ny,overlap*.5);
      this.correct(other,nx,ny,overlap-(b.hull.id==='player'?0:overlap*.5));
    });
  }
  parkIdle(dt:number){
    if(!this.frameActive)return;
    // Run after Worker AI so a newly available crate/node keeps its normal priority.
    // Empty WAIT boats must vacate the service disk during resource recovery.
    // Otherwise released berths are physically occupied by boats with no route.
    for(const body of this.bodies){
      const b=body.hull;if(!('kind' in b)||b.kind==='player')continue;
      if(b.state!=='WAIT'||b.cargo.length){delete body.park;continue;}
      const center=b.kind==='salvage'?this.c.world.storage:fishUnload(this.c,this.s,b);
      if(!body.park && distance(b,center)<this.c.world.deposit_radius+65){
        for(let i=0;i<32;i++){
          const a=(body.rank+i)*2.399963229728653,r=this.c.world.deposit_radius+110+Math.floor(i/16)*40,point={x:center.x+Math.cos(a)*r,y:center.y+Math.sin(a)*r};
          if(!onLand(this.c,point) && this.bodies.every(other=>!other.park||distance(point,other.park)>body.radius+other.radius+8) && routeTo(this.c,b,point,this.s.area).length){body.park=point;delete body.egress;break;}
        }
      }
      if(body.park)navigateTo(this.c,b,body.park,this.c.units[b.kind].speed,dt,this.s.area,2);
    }
  }
  private correct(b:Body,nx:number,ny:number,amount:number) {
    const step=Math.min(b.budget,amount);if(step<=1e-6)return;
    const next={x:b.hull.x+nx*step,y:b.hull.y+ny*step};
    if(!this.safe(b.hull,next))return;
    // A stacked legacy save cannot satisfy every pair simultaneously. Reduce total
    // penetration energy, with a pinned player and no newly overlapping pairs.
    let before=0,after=0,allowed=true;
    this.neighbors(b,o=>{const r=b.radius+o.radius,d=distance(b.hull,o.hull),nd=distance(next,o.hull);before+=Math.max(0,r-d)**2;after+=Math.max(0,r-nd)**2;if((d>=r && nd<r-.001)||(o.hull.id==='player'&&nd<Math.min(d,r)-.001))allowed=false;});
    if(!allowed || (before>0 && after>=before-1e-6))return;
    b.hull.x=next.x;b.hull.y=next.y;b.budget-=step;this.relocate(b);
    this.metrics.corrections++;this.metrics.maxCorrection=Math.max(this.metrics.maxCorrection,step);
  }
  move(b:Body,dx:number,dy:number,dt:number) {
    const requested=Math.hypot(dx,dy),amount=Math.min(requested,b.travelBudget);if(amount<1e-8)return;dx*=amount/requested;dy*=amount/requested;
    if(b.egress){
      if(distance(b.hull,b.egress)<5 || dx*(b.egress.x-b.hull.x)+dy*(b.egress.y-b.hull.y)>amount*distance(b.hull,b.egress)*.15)delete b.egress;
      else if(b.stuck>.25){const next=navigationTarget(this.c,b.hull,b.egress,this.s.area),d=distance(b.hull,next);if(d>0){dx=(next.x-b.hull.x)/d*amount;dy=(next.y-b.hull.y)/d*amount;}}
    }
    if(b.detour && (distance(b.hull,b.detour)<6 || this.s.time>(b.detourUntil??0)))delete b.detour;
    if(!b.detour && b.stuck>.25 && b.hull.id!=='player' && this.s.time>=(b.detourAt??0)){
      let blocker:Body|undefined,closest=Infinity;
      const ux=dx/amount,uy=dy/amount;
      this.neighbors(b,o=>{
        const rx=o.hull.x-b.hull.x,ry=o.hull.y-b.hull.y,forward=rx*ux+ry*uy,side=Math.abs(rx*uy-ry*ux),r=b.radius+o.radius;
        const fx=dx/dt-o.vx,fy=dy/dt-o.vy,t=Math.max(0,Math.min(.35,(rx*fx+ry*fy)/(fx*fx+fy*fy||1))),future=Math.hypot(rx-fx*t,ry-fy*t);
        if(forward>-.5 && forward<r+35 && side<r+4 && future<r+3 && Math.hypot(rx,ry)<closest){blocker=o;closest=Math.hypot(rx,ry);}
      });
      if(blocker){
        const other=blocker as Body,r=b.radius+other.radius+10;
        for(const side of [1,-1]){const ahead=Math.max(0,closest-b.radius-other.radius)*.3,point={x:b.hull.x-uy*r*side+ux*ahead,y:b.hull.y+ux*r*side+uy*ahead};
          if(this.safe(b.hull,point)){b.detour=point;b.detourUntil=this.s.time+2;b.detourAt=this.s.time+2.5;break;}
        }
      }
    }
    if(b.detour){const next=navigationTarget(this.c,b.hull,b.detour,this.s.area),d=distance(b.hull,next);if(d>0){dx=(next.x-b.hull.x)/d*amount;dy=(next.y-b.hull.y)/d*amount;}}
    const ux=dx/amount,uy=dy/amount;
    let best=-Infinity,bestX=0,bestY=0,bestTurn=0;
    const nearby=b.nearby;nearby.length=0;this.neighbors(b,other=>nearby.push(other));
    // Manual control only slides locally; AI can pass an obstacle on a consistent side.
    const count=b.hull.id==='player'?9:turns.length;
    for(let i=0;i<count;i++){
      const turn=turns[i];
      const cos=Math.cos(turn),sin=Math.sin(turn),vx=ux*cos-uy*sin,vy=ux*sin+uy*cos;
      const next=b.candidate;next.x=b.hull.x+vx*amount;next.y=b.hull.y+vy*amount;if(!this.safe(b.hull,next))continue;
      let fraction=1,penalty=0;
      for(const o of nearby){
        const rx=b.hull.x-o.hull.x,ry=b.hull.y-o.hull.y,nominal=b.radius+o.radius,r=nominal*.9,d=Math.hypot(rx,ry);
        // Swept disk intersection prevents passing through even at the highest step speed.
        const sx=vx*amount,sy=vy*amount,t=Math.max(0,Math.min(1,-(rx*sx+ry*sy)/(amount*amount)));
        const closest=Math.hypot(rx+sx*t,ry+sy*t);
        if(d<r-.01){if(Math.hypot(rx+sx,ry+sy)<d+.001)fraction=0;}
        else if(closest<r+.001 && rx*sx+ry*sy<0){
          const dot=rx*sx+ry*sy,disc=dot*dot-amount*amount*(rx*rx+ry*ry-r*r);
          if(disc>=0)fraction=Math.min(fraction,Math.max(0,(-dot-Math.sqrt(disc))/(amount*amount)-.001));
        }
        // Look ahead a short distance. Predict the other boat with its last actual velocity.
        const horizon=.35,futureX=rx+(vx*amount/dt-o.vx)*horizon,futureY=ry+(vy*amount/dt-o.vy)*horizon;
        const fx=futureX-rx,fy=futureY-ry,ft=Math.max(0,Math.min(1,-(rx*fx+ry*fy)/(fx*fx+fy*fy||1)));
        const clearance=Math.hypot(rx+fx*ft,ry+fy*ft);
        if(clearance<nominal+8)penalty+=Math.max(0,(nominal+8-clearance)/(nominal+8))*2;
      }
      const score=fraction*(Math.cos(turn)+.15)-penalty-Math.abs(turn-b.turn)*.04+(turn>0?.025:0);
      if(score>best){best=score;bestX=vx*amount*fraction;bestY=vy*amount*fraction;bestTurn=turn;}
    }
    const traveled=Math.hypot(bestX,bestY);
    if(traveled>1e-6){b.hull.x+=bestX;b.hull.y+=bestY;b.hull.angle=Math.atan2(bestY,bestX);b.travelBudget-=traveled;this.relocate(b);}
    b.turn=bestTurn;
    b.stuck=traveled<amount*.1?b.stuck+dt:0;
    if(b.hull.id!=='player' && b.stuck>=this.settings.stuck_s && this.s.time>=b.repathAt){
      forgetRoute(b.hull);b.repathAt=this.s.time+this.settings.repath_s;b.turn=0;this.metrics.repaths++;
    }
  }
  private intent(b:Boat) {
    if(['RETURN','UNLOAD'].includes(b.state))return b.kind==='salvage'?'storage':fishPortKey(fishUnload(this.c,this.s,b));
    return typeof b.target==='string'?`resource:${b.target}`:'';
  }
  arrival(b:Boat,key:string,center:Point,radius:number):Point {
    let berth=this.berths.get(key);
    if(berth && (distance(berth.center,center)>.01 || berth.radius!==radius)){
      for(const hull of [...berth.owners.keys(),...berth.queue.keys()]){forgetRoute(hull);const body=this.byHull.get(hull);if(body){delete body.egress;delete body.park;}}
      this.berths.delete(key);berth=undefined;
    }
    if(!berth){
      const points:Point[]=[],r=key.startsWith('resource:')?radius*.9:radius-2;
      const spacing=Math.max(this.settings.radii.worker,this.settings.radii.speedboat,this.settings.radii.salvage)*2+this.settings.arrival_spacing,count=Math.max(3,Math.floor(Math.PI*2*r/spacing));
      const candidates:Point[]=[];
      if(key.startsWith('resource:')){
        const step=Math.max(this.settings.radii.worker,this.settings.radii.speedboat,this.settings.radii.salvage)*2+this.settings.arrival_spacing;
        for(let row=-2;row<=2;row++)for(let column=-2;column<=2;column++){
          const p={x:center.x+(column+(Math.abs(row)%2)*.5)*step,y:center.y+row*step*Math.sqrt(3)/2};if(distance(p,center)<radius-2)candidates.push(p);
        }
      }else for(let i=0;i<count;i++){const a=i*Math.PI*2/count;candidates.push({x:center.x+Math.cos(a)*r,y:center.y+Math.sin(a)*r});}
      for(const p of candidates)if(this.safe(center,p) && routeTo(this.c,this.c.world.spawn,p,this.s.area).length)points.push(p);
      berth={points,owners:new Map(),queue:new Map(),center,radius};this.berths.set(key,berth);
    }
    const current=berth.owners.get(b);if(current!==undefined)return berth.points[current];
    // FIFO after the first approach; a newly returning boat cannot steal a waiting place.
    if(!berth.queue.has(b)){
      const body=this.byHull.get(b)!,r=radius+80;
      let point:Point|undefined;
      for(let ring=0;ring<4&&!point;ring++)for(let i=0;i<16;i++){
        const a=(body.rank+i)*2.399963229728653,p={x:center.x+Math.cos(a)*(r+ring*spacingFor(body,this.settings)),y:center.y+Math.sin(a)*(r+ring*spacingFor(body,this.settings))};
        if(this.safe(center,p) && [...berth.queue.values()].every(q=>distance(p,q)>=spacingFor(body,this.settings))){point=p;break;}
      }
      berth.queue.set(b,point??{x:b.x,y:b.y});
    }
    for(const waiting of berth.queue.keys()){
      let free=-1,best=Infinity;
      for(let i=0;i<berth.points.length;i++)if(![...berth.owners.values()].includes(i)){
        const point=berth.points[i],body=this.byHull.get(waiting)!;let score=distance(waiting,point);
        // A released place may still contain a departing hull. Prefer another
        // free place without changing a boat's already assigned destination.
        for(const other of this.bodies)if(other.hull!==waiting)score+=Math.max(0,body.radius+other.radius+2-distance(other.hull,point))*6;
        if(score<best){best=score;free=i;}
      }
      if(free<0)break;berth.owners.set(waiting,free);berth.queue.delete(waiting);
    }
    const assigned=berth.owners.get(b);if(assigned!==undefined)return berth.points[assigned];
    this.metrics.waiting++;return berth.queue.get(b)!;
  }
  end(){this.frameActive=false;for(const b of this.bodies){setMotionHandler(b.hull);active.delete(b.hull);}}
}
function spacingFor(b:Body,c:TrafficConfig){return b.radius*2+c.arrival_spacing;}
export function beginTraffic(c:Balance,s:GameState,dt:number,input:Point) {
  if(!c.navigation.traffic)return;
  let world=worlds.get(s);if(!world){world=new Traffic(c,s,c.navigation.traffic);worlds.set(s,world);}world.begin(dt,input);
}
export function endTraffic(s:GameState){worlds.get(s)?.end();}
export function parkIdleTraffic(s:GameState,dt:number){worlds.get(s)?.parkIdle(dt);}
export function arrivalPosition(b:Boat,key:string,center:Point,radius:number) {return active.get(b)?.arrival(b,key,center,radius)??center;}
export function trafficMetrics(s:GameState){return worlds.get(s)?.metrics;}
