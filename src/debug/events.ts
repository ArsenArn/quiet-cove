import type { GameEvent, GameState } from '../game/state';
// Observers are ephemeral, never serialized with the gameplay save. A failed observer
// cannot interrupt the authoritative mutation that emitted the event.
const observers = new WeakMap<GameState, Set<(event: GameEvent) => void>>();
export function observeEvents(state: GameState, observer: (event: GameEvent) => void) {
  const listeners=observers.get(state)??new Set();listeners.add(observer);observers.set(state,listeners);
  return ()=>{listeners.delete(observer);};
}
export function log(s: GameState, max: number, type: string, data: Record<string, unknown> = {}) {
  s.events.push({ seq: ++s.eventSeq, realTime: new Date().toISOString(), gameTime: s.time, type, data });
  const event=s.events.at(-1)!;
  for(const observer of observers.get(s)??[])try{observer(event);}catch{/* Gameplay remains authoritative. */}
  if (s.events.length > max) s.events.splice(0, s.events.length-max);
}
export function eventsCSV(events: GameEvent[]) { const cell = (x: unknown) => `"${String(x).replaceAll('"','""')}"`; return 'seq,real_time,game_time,type,data\n' + events.map(e => [e.seq,e.realTime,e.gameTime,e.type,JSON.stringify(e.data)].map(cell).join(',')).join('\n'); }
export function download(name: string, data: string, type = 'application/json') { const url = URL.createObjectURL(new Blob([data],{type})); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
