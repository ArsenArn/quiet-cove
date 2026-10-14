// Lossless serialization only: the recorder and its accounting stay unchanged.
type ObjectValue = Record<string, any>;
const resourceDefaults={units_collected:0,units_delivered:0,coins_earned:0,player_units:0,worker_units:0,floating_crates_collected:0,floating_crates_expired:0,depletions:0,recoveries:0};
const workerDefaults={collected_resources:0,deliveries:0,earned_coins:0};
const snapshotFields=['economy_snapshot','effect_on_state'] as const;
const stampFields=['event_timestamp','elapsed_wall_time_s','elapsed_active_time_s','elapsed_game_time_s'];
const transitionColumns=['id','type','active_s','game_s','ready_at_game_s','phase'];

/** Snapshots live once in the existing collection. Repeated node/order state objects
 * are interned in a small JSON value table; all money and timestamps remain exact. */
export function compactRecording<T extends ObjectValue>(recording:T):T {
  if(recording.snapshot_encoding)return recording;
  const result=structuredClone(recording) as ObjectValue;
  const originalCount=result.snapshots.length;
  const snapshotIds=new Map<string,string>();
  result.snapshots.forEach((snapshot:ObjectValue,index:number)=>{
    const id=`snapshot:${index}`;snapshotIds.set(JSON.stringify(snapshot),id);snapshot.snapshot_id=id;
  });
  for(const event of result.events)for(const field of snapshotFields){
    const snapshot=event.payload[field];if(!snapshot||typeof snapshot!=='object')continue;
    const key=JSON.stringify(snapshot);
    let id=snapshotIds.get(key);
    if(!id){id=`${event.event_id}:${field}`;snapshotIds.set(key,id);result.snapshots.push({...snapshot,snapshot_id:id});}
    delete event.payload[field];event.payload[`${field}_ref`]=id;
  }
  const values:ObjectValue[]=[],valueIds=new Map<string,number>();
  const intern=(value:ObjectValue)=>{const key=JSON.stringify(value);let index=valueIds.get(key);if(index===undefined){index=values.length;values.push(value);valueIds.set(key,index);}return index;};
  for(const snapshot of result.snapshots){
    for(const [id,value] of Object.entries(snapshot.investments??{}))snapshot.investments[id]=intern(value as ObjectValue);
    for(const [id,value] of Object.entries(snapshot.production?.resource_states??{}))snapshot.production.resource_states[id]=intern(value as ObjectValue);
  }
  for(const event of result.events)if(event.event_type==='economy_interval'){
    for(const map of [event.payload.resources,event.payload.workers])for(const metrics of Object.values(map??{}) as ObjectValue[])for(const key of Object.keys(metrics))if(metrics[key]===0)delete metrics[key];
    if(event.payload.ended&&Object.keys(event.payload.ended).length===stampFields.length&&stampFields.every(key=>event.payload.ended[key]===event[key])){
      delete event.payload.ended;event.payload.ended_ref='event_stamp';
    }
    const transitions=event.payload.resource_transitions;
    if(Array.isArray(transitions)&&transitions.every(row=>Object.keys(row).length===transitionColumns.length&&transitionColumns.every(key=>key in row))){
      delete event.payload.resource_transitions;event.payload.resource_transition_rows=transitions.map(row=>transitionColumns.map(key=>row[key]));
    }
  }
  result.snapshot_encoding={version:1,original_snapshot_count:originalCount,state_values:values,state_value_paths:['snapshots[].investments.*','snapshots[].production.resource_states.*'],description:'Event snapshot refs resolve by snapshots[].snapshot_id. Numeric state refs index state_values. Missing interval counters use zero_defaults. ended_ref=event_stamp uses the parent event clocks.',resource_transition_columns:transitionColumns,zero_defaults:{resources:resourceDefaults,workers:workerDefaults}};
  return result as T;
}

/** Also accepts old inline v0.7a recordings unchanged. No database/schema migration. */
export function expandRecording<T extends ObjectValue>(recording:T):T {
  if(!recording.snapshot_encoding)return recording;
  const result=structuredClone(recording) as ObjectValue,encoding=result.snapshot_encoding;
  if(encoding.version!==1||!Array.isArray(encoding.state_values))throw Error('Unsupported snapshot encoding');
  const snapshots=new Map<string,ObjectValue>();
  for(const snapshot of result.snapshots){
    for(const [id,index] of Object.entries(snapshot.investments??{}))snapshot.investments[id]=structuredClone(encoding.state_values[index as number]);
    for(const [id,index] of Object.entries(snapshot.production?.resource_states??{}))snapshot.production.resource_states[id]=structuredClone(encoding.state_values[index as number]);
    const id=snapshot.snapshot_id;delete snapshot.snapshot_id;snapshots.set(id,snapshot);
  }
  for(const event of result.events){
    for(const field of snapshotFields){
      const id=event.payload[`${field}_ref`];if(id===undefined)continue;
      const snapshot=snapshots.get(id);if(!snapshot)throw Error(`Missing analytics snapshot: ${id}`);
      event.payload[field]=structuredClone(snapshot);delete event.payload[`${field}_ref`];
    }
    if(event.event_type==='economy_interval'){
      for(const field of ['resources','workers'])for(const [id,metrics] of Object.entries(event.payload[field]??{}))event.payload[field][id]={...encoding.zero_defaults[field],...(metrics as ObjectValue)};
      if(event.payload.ended_ref==='event_stamp'){event.payload.ended=Object.fromEntries(stampFields.map(key=>[key,event[key]]));delete event.payload.ended_ref;}
      if(event.payload.resource_transition_rows){event.payload.resource_transitions=event.payload.resource_transition_rows.map((row:unknown[])=>Object.fromEntries(encoding.resource_transition_columns.map((key:string,index:number)=>[key,row[index]])));delete event.payload.resource_transition_rows;}
    }
  }
  result.snapshots=result.snapshots.slice(0,encoding.original_snapshot_count);
  delete result.snapshot_encoding;
  return result as T;
}
