import Phaser from 'phaser';
import {iconPaths,iconSVG,iconAssets,type IconName} from './icons';
import {nautical as ui} from './tokens';
export const uiFont='"Trebuchet MS", "Segoe UI", sans-serif';
type Tone='neutral'|'gold'|'success'|'danger';
const palette={neutral:{line:ui.border,text:ui.white,detail:'#c3e2e9'},gold:{line:ui.gold,text:'#ffe3a1',detail:'#f1dbb4'},success:{line:ui.success,text:'#c4f2d2',detail:'#c4e6d5'},danger:{line:ui.danger,text:'#ffe2d9',detail:'#f1c5bc'}};
export function preloadUIIcons(scene:Phaser.Scene){
  scene.load.image('ui-coin',iconAssets.coin);scene.load.image('ui-cargo',iconAssets.cargo);
  scene.load.spritesheet('ui-boat',iconAssets.boat,{frameWidth:192,frameHeight:192});
  for(const name of Object.keys(iconPaths) as IconName[])if(!(name in iconAssets))scene.load.svg(`ui-${name}`,`data:image/svg+xml;base64,${btoa(iconSVG(name))}`,{width:48,height:48});
}

// Phaser containers remain in world space. No DOM projection, rounding or frame-by-frame textures.
export class WorldLabel extends Phaser.GameObjects.Container {
  text='';
  private panel:Phaser.GameObjects.Graphics;
  private heading:Phaser.GameObjects.Text;
  private detail:Phaser.GameObjects.Text;
  private marker:Phaser.GameObjects.Image|null;
  private coin:Phaser.GameObjects.Image|null;
  private tone:Tone;
  private hover=false;private pressed=false;
  constructor(scene:Phaser.Scene,x:number,y:number,text:string,marker:IconName|null=null,tone:Tone='neutral',private compact=false,private variant:'status'|'purchase'='status'){
    super(scene,x,y);scene.add.existing(this);this.tone=tone;
    this.panel=scene.add.graphics();
    this.heading=scene.add.text(0,0,'',{fontFamily:uiFont,fontSize:compact?'13px':'17px',fontStyle:'bold',wordWrap:{width:variant==='purchase'?140:220},resolution:2});
    this.detail=scene.add.text(0,0,'',{fontFamily:uiFont,fontSize:variant==='purchase'?'21px':'13px',fontStyle:'bold',wordWrap:{width:200},resolution:2});
    this.marker=marker?scene.add.image(0,0,`ui-${marker}`,marker==='boat'?3:undefined).setDisplaySize(compact?17:26,compact?17:26):null;
    this.coin=variant==='purchase'?scene.add.image(0,0,'ui-coin').setDisplaySize(21,21):null;
    this.add([this.panel,this.heading,this.detail,...this.marker?[this.marker]:[],...this.coin?[this.coin]:[]]);
    this.setText(text);
  }
  setText(text:string){if(this.text===text && this.width)return this;this.text=text;const [title,...lines]=text.split('\n');this.heading.setText(title);this.detail.setText(lines.join('\n'));this.layout();return this;}
  setTone(tone:Tone){if(this.tone!==tone){this.tone=tone;this.layout();}return this;}
  // Entire panel beneath the circle, with a gap; boats never move this anchor.
  setGroundPosition(x:number,y:number,radius=0){
    return this.setPosition(x,this.variant==='purchase'?y+radius+8+this.height/2:y);
  }
  makeInteractive(){this.setInteractive(new Phaser.Geom.Rectangle(0,0,this.width,this.height),Phaser.Geom.Rectangle.Contains);this.input!.cursor='pointer';this.on('pointerover',()=>{this.hover=true;this.layout();});this.on('pointerout',()=>{this.hover=false;this.pressed=false;this.layout();});this.on('pointerdown',()=>{this.pressed=true;this.layout();});this.on('pointerup',()=>{this.pressed=false;this.layout();});return this;}
  private layout(){
    const p=palette[this.tone];
    if(this.variant==='purchase'){
      const nameWidth=this.heading.width+26,valueWidth=this.detail.width+68,w=Math.max(nameWidth,valueWidth,126),nameHeight=this.heading.height+10,pillHeight=Math.max(48,this.detail.height+16),h=pillHeight+nameHeight-10;
      this.setSize(w,h);
      const valueY=-h/2+(pillHeight-10)/2,nameY=-h/2+pillHeight-10;
      this.detail.setColor(this.tone==='success'?'#c4f2d2':ui.white).setPosition(-this.detail.width/2,valueY-this.detail.height/2);
      this.heading.setColor(ui.ink).setPosition(-this.heading.width/2,nameY+5);
      this.marker?.setPosition(-this.detail.width/2-20,valueY);
      this.coin?.setVisible(this.tone!=='success').setPosition(this.detail.width/2+16,valueY);
      this.panel.clear().fillStyle(ui.shadow,.3).fillRoundedRect(-w/2,-h/2+4,w,h,22)
        .fillStyle(this.pressed?ui.navy:this.hover?ui.teal:ui.navy,.97).fillRoundedRect(-w/2,-h/2,w,pillHeight,24)
        .lineStyle(1.5,ui.border,.8).strokeRoundedRect(-w/2,-h/2,w,pillHeight,24)
        .fillStyle(ui.cream).fillRoundedRect(-nameWidth/2,nameY,nameWidth,nameHeight,11)
        .lineStyle(1,ui.creamBorder,.9).strokeRoundedRect(-nameWidth/2,nameY,nameWidth,nameHeight,11);
    }else{
      const pad=this.compact?7:10,iconWidth=this.marker?(this.compact?23:33):0;
      const w=Math.max(this.heading.width,this.detail.width)+pad*2+iconWidth,h=this.heading.height+(this.detail.text?this.detail.height+3:0)+pad*2;
      this.setSize(w,h);this.heading.setColor(p.text).setPosition(-w/2+pad+iconWidth,-h/2+pad);
      this.detail.setColor(p.detail).setPosition(this.heading.x,this.heading.y+this.heading.height+3).setVisible(!!this.detail.text);
      this.marker?.setPosition(-w/2+pad+(this.compact?8.5:13),0);
      const radius=Math.min(19,h/2);
      this.panel.clear().fillStyle(ui.shadow,.3).fillRoundedRect(-w/2,-h/2+3,w,h,radius)
        .fillStyle(this.pressed?ui.navy:this.hover?ui.teal:ui.navy,.97).fillRoundedRect(-w/2,-h/2,w,h,radius)
        .lineStyle(1.5,p.line,this.hover?1:.75).strokeRoundedRect(-w/2,-h/2,w,h,radius)
        .lineStyle(1,0xffffff,.07).lineBetween(-w/2+radius,-h/2+3,w/2-radius,-h/2+3);
    }
    if(this.input)(this.input.hitArea as Phaser.Geom.Rectangle).setTo(0,0,this.width,this.height);
  }
}
