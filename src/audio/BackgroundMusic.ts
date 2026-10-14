export const musicStorageKey='quiet_cove_music_enabled';
type PreferenceStorage=Pick<Storage,'getItem'|'setItem'>;

/** One media element, independent of the gameplay clock and Phaser sound. */
export class BackgroundMusic {
  enabled=true;
  private focused:boolean;
  private suspended=false;
  private destroyed=false;
  private pending:Promise<void>|null=null;
  private retryAfterPending=false;
  private readonly gesture=()=>this.sync(true);
  private readonly visibility=()=>this.sync(true);
  private readonly blur=()=>{this.focused=false;this.sync();};
  private readonly focus=()=>{this.focused=true;this.sync(true);};
  private readonly hide=()=>{this.suspended=true;this.sync();};
  private readonly show=()=>{this.suspended=false;this.focused=this.doc.hasFocus();this.sync(true);};

  constructor(readonly audio:HTMLAudioElement,private storage:PreferenceStorage|null,private doc:Document=document,private win:Window=window){
    try{this.enabled=storage?.getItem(musicStorageKey)!=='false';}catch{/* Default ON when storage is unavailable. */}
    this.focused=doc.hasFocus();audio.loop=true;audio.volume=.25;audio.preload='auto';
    doc.addEventListener('pointerdown',this.gesture,true);doc.addEventListener('keydown',this.gesture,true);
    doc.addEventListener('visibilitychange',this.visibility);
    win.addEventListener('blur',this.blur);win.addEventListener('focus',this.focus);
    win.addEventListener('pagehide',this.hide);win.addEventListener('pageshow',this.show);
    this.sync();
  }
  setEnabled(enabled:boolean){
    this.enabled=enabled;
    try{this.storage?.setItem(musicStorageKey,String(enabled));}catch{/* Keep the current session usable. */}
    this.sync(true);
  }
  private canPlay(){return !this.destroyed&&this.enabled&&!this.doc.hidden&&this.focused&&!this.suspended;}
  private sync(retry=false){
    if(!this.canPlay()){this.retryAfterPending=false;this.audio.pause();return;}
    if(this.pending){if(retry)this.retryAfterPending=true;return;}
    if(!this.audio.paused)return;
    let attempt:Promise<void>;
    try{attempt=Promise.resolve(this.audio.play());}catch{return;}
    this.pending=attempt;
    // NotAllowedError/AbortError are normal browser lifecycle outcomes. Retry
    // only on a gesture, focus/visibility return or an explicit ON action.
    void attempt.then(()=>{if(!this.canPlay())this.audio.pause();}).catch(()=>{}).finally(()=>{
      this.pending=null;const again=this.retryAfterPending;this.retryAfterPending=false;
      if(again)this.sync();
    });
  }
  destroy(){
    this.destroyed=true;this.retryAfterPending=false;this.audio.pause();
    this.doc.removeEventListener('pointerdown',this.gesture,true);this.doc.removeEventListener('keydown',this.gesture,true);
    this.doc.removeEventListener('visibilitychange',this.visibility);
    this.win.removeEventListener('blur',this.blur);this.win.removeEventListener('focus',this.focus);
    this.win.removeEventListener('pagehide',this.hide);this.win.removeEventListener('pageshow',this.show);
    this.audio.removeAttribute('src');this.audio.load();
  }
}
