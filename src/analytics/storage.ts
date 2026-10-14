import type { StorageLike } from '../game/systems/save';

export type AnalyticsStorage = StorageLike & { maxBytes?:number; backend?:string; warning?:string };
export const IDB_LIMIT_BYTES=20_000_000;
export const FALLBACK_LIMIT_BYTES=3_000_000;

/** IndexedDB writes are queued in order. The observer sees a synchronous memory mirror;
 * transactions run outside the gameplay loop and failures leave the export available. */
export async function loadAnalyticsStorage(key:string,fallback:StorageLike):Promise<AnalyticsStorage> {
  try {
    const database=await new Promise<IDBDatabase>((resolve,reject)=>{
      const request=indexedDB.open('quiet_cove_playtest_analytics',1);
      const timeout=setTimeout(()=>reject(Error('IndexedDB open timed out')),2000);
      request.onupgradeneeded=()=>request.result.createObjectStore('recordings');
      request.onerror=()=>{clearTimeout(timeout);reject(request.error);};
      request.onblocked=()=>{clearTimeout(timeout);reject(Error('IndexedDB blocked'));};
      request.onsuccess=()=>{clearTimeout(timeout);resolve(request.result);};
    });
    let value=await new Promise<string|null>((resolve,reject)=>{
      const request=database.transaction('recordings','readonly').objectStore('recordings').get(key);
      request.onsuccess=()=>resolve(typeof request.result==='string'?request.result:null);
      request.onerror=()=>reject(request.error);
    });
    // Recover a fallback recording when IndexedDB becomes available again.
    if(value===null)try{value=fallback.getItem(key);}catch{/* New recording can still use IndexedDB. */}
    let queue=Promise.resolve();
    const store:AnalyticsStorage={
      backend:'indexedDB',maxBytes:IDB_LIMIT_BYTES,warning:'',
      getItem:k=>k===key?value:null,
      setItem:(k,v)=>{if(k!==key)return;value=v;write(v);},
      removeItem:k=>{
        if(k!==key)return;value=null;write(null);
        try{fallback.removeItem(key);}catch{/* Only the analytics key is ever addressed. */}
      },
    };
    function write(next:string|null){queue=queue.then(()=>new Promise<void>((resolve,reject)=>{
      const transaction=database.transaction('recordings','readwrite');
      const objectStore=transaction.objectStore('recordings');if(next===null)objectStore.delete(key);else objectStore.put(next,key);
      transaction.oncomplete=()=>{store.warning='';resolve();};
      transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error??Error('IndexedDB aborted'));
    })).catch(error=>{store.warning=`Analytics storage failed; export before closing: ${String(error)}`;});}
    return store;
  }catch(error){
    return {backend:'localStorage',maxBytes:FALLBACK_LIMIT_BYTES,warning:`IndexedDB unavailable; bounded localStorage fallback. ${String(error)}`,getItem:k=>fallback.getItem(k),setItem:(k,v)=>fallback.setItem(k,v),removeItem:k=>fallback.removeItem(k)};
  }
}
