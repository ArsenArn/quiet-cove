import type { Balance, Point } from '../../config/types';
import type {GameState} from '../state';
import {defenderStation} from '../../config/mapLayout';
type Obstacle=Point & {rx:number;ry:number};
const buildings=new WeakMap<Balance,{key:string;obstacles:Obstacle[]}>();
export function syncBuildingObstacles(c:Balance,s:GameState){
  const key=`${s.area}:${!!s.flags.secondPort}`,prior=buildings.get(c);if(prior?.key===key)return;
  const list:Obstacle[]=[];
  // Static routing uses boat_radius; grow only building footprints by the
  // difference to the largest traffic hull so every boat keeps body clearance.
  const extra=Math.max(0,...Object.values(c.navigation.traffic?.radii??{}).map(r=>r-c.navigation.boat_radius));
  if(s.area>=2){const p=defenderStation(c);list.push({x:p.x,y:p.y+30,rx:49+extra,ry:35+extra});
    if(s.flags.secondPort && c.second_port)list.push({x:c.second_port.hut.x,y:c.second_port.hut.y+28,rx:38+extra,ry:27+extra});}
  buildings.set(c,{key,obstacles:[...c.navigation.obstacles,...list]});graphs.delete(c);
}
const obstacles=(c:Balance):readonly Obstacle[]=>buildings.get(c)?.obstacles??c.navigation.obstacles;
export function distance(a: Point,b: Point) { return Math.hypot(a.x-b.x,a.y-b.y); }
export function moveTo(a: Point & {angle:number},b: Point,speed:number,dt:number,stop=0) {
  const d=distance(a,b);if(d<=stop)return true;
  const amount=Math.min(speed*dt,Math.max(0,d-stop));a.angle=Math.atan2(b.y-a.y,b.x-a.x);a.x+=(b.x-a.x)/d*amount;a.y+=(b.y-a.y)/d*amount;return d-amount<=stop+.001;
}
export function clampToWorld(p: Point,c: Balance,area:number) { const m=c.world.edge_margin;p.x=Math.min(area===1?c.world.gate_x-m:c.world.width-m,Math.max(m,p.x));p.y=Math.min(c.world.height-m,Math.max(m,p.y)); }
export function onLand(c: Balance,p: Point,padding=c.navigation.boat_radius) {
  return obstacles(c).some(o=>((p.x-o.x)/(o.rx+padding))**2+((p.y-o.y)/(o.ry+padding))**2<1-1e-8);
}
export function resolveLand(c: Balance,p: Point) {
  for(const o of obstacles(c)) {
    const rx=o.rx+c.navigation.boat_radius,ry=o.ry+c.navigation.boat_radius,dx=(p.x-o.x)/rx,dy=(p.y-o.y)/ry,d=Math.hypot(dx,dy);
    if(d<1){const angle=d>1e-8?Math.atan2(dy,dx):0;p.x=o.x+Math.cos(angle)*(rx+.1);p.y=o.y+Math.sin(angle)*(ry+.1);}
  }
}
export function clearSegment(c: Balance,a: Point,b: Point,padding=c.navigation.boat_radius) {
  return obstacles(c).every(o=>{
    const rx=o.rx+padding,ry=o.ry+padding,ax=(a.x-o.x)/rx,ay=(a.y-o.y)/ry,dx=(b.x-a.x)/rx,dy=(b.y-a.y)/ry;
    const t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1)));
    return (ax+t*dx)**2+(ay+t*dy)**2>=1-1e-8;
  });
}
// Small visibility graph built once per config/territory, reused by all boats.
type Graph={points:Point[];edges:{to:number;cost:number}[][]};
const graphs=new WeakMap<Balance,Map<number,Graph>>();
function graph(c: Balance,area:number) {
  let areas=graphs.get(c);if(!areas){areas=new Map();graphs.set(c,areas);}if(areas.has(area))return areas.get(area)!;
  const points:Point[]=[];
  for(const o of obstacles(c))for(let i=0;i<16;i++){
    const angle=i*Math.PI/8,p={x:o.x+Math.cos(angle)*(o.rx+c.navigation.boat_radius+12),y:o.y+Math.sin(angle)*(o.ry+c.navigation.boat_radius+12)};
    const clamped={...p};clampToWorld(clamped,c,area);if(distance(p,clamped)<.01&&!onLand(c,p))points.push(p);
  }
  const edges=points.map(()=>[] as {to:number;cost:number}[]);
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)if(clearSegment(c,points[i],points[j])){const cost=distance(points[i],points[j]);edges[i].push({to:j,cost});edges[j].push({to:i,cost});}
  const result={points,edges};areas.set(area,result);return result;
}
export function routeTo(c: Balance,start: Point,destination: Point,area:number):Point[] {
  const goal={...destination};clampToWorld(goal,c,area);resolveLand(c,goal);
  if(clearSegment(c,start,goal))return [goal];
  const base=graph(c,area),points=[...base.points,start,goal],n=points.length,from=n-2,to=n-1;
  const edges=base.edges.map(a=>[...a]);edges.push([],[]);
  for(const id of [from,to])for(let i=0;i<id;i++)if(clearSegment(c,points[id],points[i])){const cost=distance(points[id],points[i]);edges[id].push({to:i,cost});edges[i].push({to:id,cost});}
  const costs=Array(n).fill(Infinity),prior=Array(n).fill(-1),done=new Set<number>();costs[from]=0;
  while(done.size<n){let u=-1;for(let i=0;i<n;i++)if(!done.has(i)&&(u<0||costs[i]<costs[u]))u=i;if(u<0||!Number.isFinite(costs[u]))break;if(u===to)break;done.add(u);for(const e of edges[u])if(costs[u]+e.cost<costs[e.to]){costs[e.to]=costs[u]+e.cost;prior[e.to]=u;}}
  if(!Number.isFinite(costs[to]))return [];
  const path:Point[]=[];for(let i=to;i!==from;i=prior[i])path.unshift({...points[i]});return path;
}
const routes=new WeakMap<Point,{goal:Point;area:number;config:Balance;topology:unknown;points:Point[]}>();
export function forgetRoute(p:Point) { routes.delete(p); }
// The Engine attaches a local traffic handler for a simulation step only.
// Standalone navigation and projectiles retain their original behavior.
export type MotionHandler=(dx:number,dy:number,dt:number)=>void;
const motionHandlers=new WeakMap<Point,MotionHandler>();
export function setMotionHandler(p:Point,handler?:MotionHandler) { if(handler)motionHandlers.set(p,handler);else motionHandlers.delete(p); }
export function moveBoat(c:Balance,p:Point & {angle:number},dx:number,dy:number,dt:number,area:number) {
  const handler=motionHandlers.get(p);
  if(handler)handler(dx,dy,dt);
  else {p.x+=dx;p.y+=dy;resolveLand(c,p);clampToWorld(p,c,area);}
}
export function navigationTarget(c: Balance,p: Point,goal: Point,area:number) {
  resolveLand(c,p);
  if(clearSegment(c,p,goal))return goal;
  let route=routes.get(p);
  if(!route||route.config!==c||route.topology!==buildings.get(c)||route.area!==area||distance(route.goal,goal)>12||!route.points.length){route={goal:{...goal},area,config:c,topology:buildings.get(c),points:routeTo(c,p,goal,area)};routes.set(p,route);}
  while(route.points.length>1&&distance(p,route.points[0])<3)route.points.shift();
  if(route.points[0]&&!clearSegment(c,p,route.points[0]))route.points=routeTo(c,p,goal,area);
  return route.points[0]??p;
}
export function navigateTo(c: Balance,p: Point & {angle:number},goal: Point,speed:number,dt:number,area:number,stop=0) {
  if(distance(p,goal)<=stop)return true;
  const next=navigationTarget(c,p,goal,area),d=distance(p,next),amount=Math.min(speed*dt,Math.max(0,d-(next===goal?stop:0)));
  if(d>1e-8) {p.angle=Math.atan2(next.y-p.y,next.x-p.x);moveBoat(c,p,(next.x-p.x)/d*amount,(next.y-p.y)/d*amount,dt,area);}
  return distance(p,goal)<=stop+.01;
}
