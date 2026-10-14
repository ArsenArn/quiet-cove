import {it,expect} from 'vitest';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {compactRecording,expandRecording} from '../src/analytics/compact';
import {PlaytestAnalytics,analyticsKey} from '../src/analytics/playtest';
import {Engine} from '../src/game/engine';
import type {Balance} from '../src/config/types';
import type {AnalyticsStorage} from '../src/analytics/storage';

const path='tests/fixtures/release/analytics-v07a-scripted.json.gz';
const fixture=()=>expandRecording(JSON.parse(gunzipSync(fs.readFileSync(path)).toString('utf8')));
function live(){
  const config=JSON.parse(fs.readFileSync('public/balance/balance_fast.json','utf8')) as Balance;
  const e=new Engine(config),values=new Map<string,string>();let now=100000;
  const storage:AnalyticsStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>{values.set(key,value);},removeItem:key=>{values.delete(key);}};
  return {e,storage,values,now:()=>now,advance:(seconds:number)=>{now+=seconds*1000;}};
}

it('representative v0.7a recording survives lossless compact/full roundtrip',()=>{
  const original=fixture(),before=JSON.stringify(original),compact=compactRecording(original);
  expect(expandRecording(JSON.parse(JSON.stringify(compact)))).toEqual(original);
  expect(JSON.stringify(original)).toBe(before);
  expect(compact.aggregates).toEqual(original.aggregates);expect(compact.quests).toEqual(original.quests);expect(compact.summary).toEqual(original.summary);
  expect(compact.events.map((e:any)=>[e.event_id,e.event_timestamp,e.elapsed_wall_time_s,e.elapsed_active_time_s,e.elapsed_game_time_s])).toEqual(original.events.map((e:any)=>[e.event_id,e.event_timestamp,e.elapsed_wall_time_s,e.elapsed_active_time_s,e.elapsed_game_time_s]));
  expect(compact.initial_snapshot).toEqual(original.initial_snapshot);expect(compact.final_snapshot).toEqual(original.final_snapshot);
});
it('all snapshot references resolve and periodic snapshots remain central',()=>{
  const original=fixture(),compact=compactRecording(original),ids=new Set(compact.snapshots.map((s:any)=>s.snapshot_id));
  expect(ids.size).toBe(compact.snapshots.length);
  for(const event of compact.events){expect(event.payload.economy_snapshot).toBeUndefined();expect(event.payload.effect_on_state).toBeUndefined();for(const field of ['economy_snapshot_ref','effect_on_state_ref'])if(event.payload[field])expect(ids.has(event.payload[field])).toBe(true);}
  expect(compact.snapshots.filter((s:any)=>s.reason==='periodic').length).toBe(original.snapshots.filter((s:any)=>s.reason==='periodic').length);
  expect(compactRecording(compact)).toBe(compact);expect(expandRecording(original)).toBe(original);
});
it('snapshot IDs remain stable when a later snapshot is appended',()=>{
  const original=fixture(),first=compactRecording(original);original.snapshots.push({...original.final_snapshot,reason:'later',elapsed_wall_time_s:99999});const second=compactRecording(original);
  expect(second.events.map((e:any)=>e.payload.economy_snapshot_ref)).toEqual(first.events.map((e:any)=>e.payload.economy_snapshot_ref));
});
it('compact storage resumes recording, pause/stop/clear and full export still work',()=>{
  const {e,storage,values,now,advance}=live();let a=new PlaytestAnalytics(e,storage,now);a.start();advance(31);a.sample();a.setVisible(false);a.persist();
  expect(JSON.parse(values.get(analyticsKey('fast'))!).snapshot_encoding.version).toBe(1);const before=JSON.parse(a.exportJSON('full')!);a.destroy();advance(60);
  a=new PlaytestAnalytics(e,storage,now);const resumed=JSON.parse(a.exportJSON('full')!);expect(resumed.session.session_id).toBe(before.session.session_id);expect(resumed.session.active_duration_s).toBe(before.session.active_duration_s);
  a.stop();const compact=JSON.parse(a.exportJSON()!),full=JSON.parse(a.exportJSON('full')!);expect(expandRecording(compact)).toEqual(full);expect(compact.session.recording_status).toBe('STOPPED');
  expect(compact.summary.coins_reconciliation.residual).toBe(0);expect(compact.summary.metal_reconciliation.residual).toBe(0);expect(a.filename('full')).toMatch(/_full\.json$/);
  const state=structuredClone(e.state);a.clear(true);expect(e.state).toEqual(state);expect(a.status).toBe('OFF');
});
it('old inline v0.7a checkpoints remain exportable without losing diagnostics',()=>{
  const {e,storage,now}=live();const a=new PlaytestAnalytics(e,storage,now);a.start();a.stop();const encoded=JSON.parse(storage.getItem(analyticsKey('fast'))!);storage.setItem(analyticsKey('fast'),JSON.stringify(expandRecording(encoded)));a.destroy();
  const restored=new PlaytestAnalytics(e,storage,now);expect(restored.status).toBe('STOPPED');expect(JSON.parse(restored.exportJSON('full')!).snapshot_encoding).toBeUndefined();expect(expandRecording(JSON.parse(restored.exportJSON()!))).toEqual(JSON.parse(restored.exportJSON('full')!));
});
it('measures export and storage reduction on a full 34-quest recording',()=>{
  const original=fixture(),compact=compactRecording(original),full=JSON.stringify(original,null,2),small=JSON.stringify(compact);
  const report={full_bytes:Buffer.byteLength(full),compact_bytes:Buffer.byteLength(small),reduction_factor:Buffer.byteLength(full)/Buffer.byteLength(small),old_storage_bytes:Buffer.byteLength(JSON.stringify(original)),new_storage_bytes:Buffer.byteLength(small),quests:original.summary.total_quests_claimed,coins_residual:original.summary.coins_reconciliation.residual,metal_residual:original.summary.metal_reconciliation.residual};
  expect(report.compact_bytes).toBeLessThan(report.full_bytes);expect(report.new_storage_bytes).toBeLessThan(report.old_storage_bytes);expect(report.quests).toBe(34);expect(report.coins_residual).toBe(0);expect(report.metal_residual).toBe(0);
  fs.mkdirSync('test-results/v07b',{recursive:true});fs.writeFileSync('test-results/v07b/size-comparison.json',JSON.stringify(report,null,2));fs.writeFileSync('test-results/v07b/playtest_FAST_compact_34.json',small);fs.writeFileSync('test-results/v07b/playtest_FAST_full_34.json',full);
});
