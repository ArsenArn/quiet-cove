import type {Balance,Point} from '../../config/types';
import type {Boat,GameState} from '../state';
import {distance,routeTo} from './movement';

export function fishPorts(c:Balance,s:GameState):Point[] {
  return s.area>=2 && s.flags.secondPort && c.second_port ? [c.world.port,c.second_port.unload] : [c.world.port];
}
export function fishPortKey(port:Point):string {return `port:${port.x}:${port.y}`;}
const returns=new WeakMap<Point,{config:Balance;area:number;cargo:number;ports:string;port:Point}>();
// Routing can clamp or resolve a destination. Only an exact reachable dock qualifies.
export function fishUnload(c:Balance,s:GameState,origin:Point=s.boats[0]):Point {
  const ports=fishPorts(c,s);
  if(ports.length===1)return ports[0];
  const boat=origin as Partial<Boat>,cargo=boat.kind!=='player' && ['RETURN','UNLOAD'].includes(boat.state??'') ? boat.cargo?.at(-1)?.id : undefined;
  const keys=ports.map(fishPortKey).join('|'),cached=returns.get(origin);
  if(cargo!==undefined && cached?.config===c && cached.area===s.area && cached.cargo===cargo && cached.ports===keys)return cached.port;
  let best=ports[0],bestLength=Infinity;
  for(const port of ports){
    const route=routeTo(c,origin,port,s.area);
    if(!route.length || distance(route[route.length-1],port)>.01)continue;
    let length=0,previous=origin;
    for(const point of route){length+=distance(previous,point);previous=point;}
    if(length<bestLength){best=port;bestLength=length;}
  }
  // One destination per return trip; transient cache never enters a save.
  if(cargo!==undefined)returns.set(origin,{config:c,area:s.area,cargo,ports:keys,port:best});
  return best;
}
