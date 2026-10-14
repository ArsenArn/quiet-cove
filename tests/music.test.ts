import {it,expect} from 'vitest';
import {BackgroundMusic,musicStorageKey} from '../src/audio/BackgroundMusic';
class Media {
 loop=false;volume=1;preload='';paused=true;plays=0;pauses=0;removed=false;
 next:()=>Promise<void>=()=>Promise.resolve();
 play(){this.plays++;return this.next().then(()=>{this.paused=false;});}
 pause(){this.pauses++;this.paused=true;}
 removeAttribute(){this.removed=true;}load(){}
}
class Page extends EventTarget {hidden=false;hasFocus(){return true;}}
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function fixture(saved?:string){const data=new Map<string,string>();if(saved!==undefined)data.set(musicStorageKey,saved);const media=new Media(),doc=new Page(),win=new EventTarget();const storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}};const create=()=>new BackgroundMusic(media as unknown as HTMLAudioElement,storage,doc as unknown as Document,win as Window);return {media,doc,win,data,create};}
it('first launch defaults ON, loops at 25%, and repeated ON/gestures never duplicate playback',async()=>{
 const f=fixture(),music=f.create();await flush();expect(music.enabled).toBe(true);expect(f.media.loop).toBe(true);expect(f.media.volume).toBe(.25);expect(f.media.paused).toBe(false);
 for(let i=0;i<5;i++){music.setEnabled(true);const event=new Event('pointerdown',{cancelable:true});f.doc.dispatchEvent(event);expect(event.defaultPrevented).toBe(false);}expect(f.media.plays).toBe(1);music.destroy();
});
it('blocked autoplay is handled and retries after the first pointer/keyboard interaction',async()=>{
 const f=fixture();f.media.next=()=>Promise.reject(new DOMException('Gesture required','NotAllowedError'));const music=f.create();await flush();expect(f.media.paused).toBe(true);expect(music.enabled).toBe(true);expect(f.media.plays).toBe(1);
 f.media.next=()=>Promise.resolve();f.doc.dispatchEvent(new Event('keydown'));await flush();expect(f.media.paused).toBe(false);expect(f.media.plays).toBe(2);music.destroy();
});
it('OFF pauses immediately, persists separately, restores OFF, and ON resumes the same media element',async()=>{
 const f=fixture(),music=f.create();await flush();music.setEnabled(false);expect(f.media.paused).toBe(true);expect(f.data.get(musicStorageKey)).toBe('false');music.destroy();const restored=f.create();await flush();expect(restored.enabled).toBe(false);expect(f.media.plays).toBe(1);
 restored.setEnabled(true);await flush();expect(f.media.plays).toBe(2);expect(f.media.paused).toBe(false);expect(f.data.get(musicStorageKey)).toBe('true');restored.destroy();
});
it('hidden/blur/pagehide suspend music; return resumes only when enabled',async()=>{
 const f=fixture(),music=f.create();await flush();f.doc.hidden=true;f.doc.dispatchEvent(new Event('visibilitychange'));expect(f.media.paused).toBe(true);f.doc.dispatchEvent(new Event('pointerdown'));expect(f.media.plays).toBe(1);
 f.doc.hidden=false;f.doc.dispatchEvent(new Event('visibilitychange'));await flush();expect(f.media.paused).toBe(false);f.win.dispatchEvent(new Event('blur'));expect(f.media.paused).toBe(true);f.win.dispatchEvent(new Event('focus'));await flush();expect(f.media.paused).toBe(false);
 f.win.dispatchEvent(new Event('pagehide'));expect(f.media.paused).toBe(true);f.win.dispatchEvent(new Event('pageshow'));await flush();expect(f.media.paused).toBe(false);music.setEnabled(false);f.win.dispatchEvent(new Event('focus'));f.doc.dispatchEvent(new Event('visibilitychange'));await flush();expect(f.media.paused).toBe(true);music.destroy();
});
it('an in-flight play cannot restart after OFF/hidden, and rapid OFF/ON remains one instance',async()=>{
 const f=fixture();let resolve!:()=>void;f.media.next=()=>new Promise<void>(r=>resolve=r);const music=f.create();music.setEnabled(false);resolve();await flush();expect(f.media.paused).toBe(true);
 f.media.next=()=>Promise.resolve();music.setEnabled(true);music.setEnabled(false);music.setEnabled(true);await flush();expect(f.media.paused).toBe(false);expect(f.media.plays).toBe(2);music.destroy();f.doc.dispatchEvent(new Event('pointerdown'));f.win.dispatchEvent(new Event('focus'));expect(f.media.plays).toBe(2);expect(f.media.removed).toBe(true);
});
it('storage failures and synchronous play errors cannot break game input or settings',async()=>{
 const media=new Media(),doc=new Page(),win=new EventTarget();media.next=()=>{throw new DOMException('Blocked','NotAllowedError');};const bad={getItem:()=>{throw Error('Denied');},setItem:()=>{throw Error('Quota');}};
 const music=new BackgroundMusic(media as unknown as HTMLAudioElement,bad,doc as unknown as Document,win as Window);expect(music.enabled).toBe(true);expect(()=>music.setEnabled(false)).not.toThrow();expect(media.paused).toBe(true);music.destroy();await flush();
});
