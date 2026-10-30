import {SHELL_FRAMES} from './shell-frame-data.js';

// The first hit removes the casing; the game then draws its normal marble.
// Request only intact shells in the colors used by the current board.
export class ShellArt {
  constructor({createImage=()=>new Image()}={}){this.createImage=createImage;this.images=new Map();}
  preloadColor(color){
    const frames=SHELL_FRAMES[color];if(!frames)return;
    for(const frame of Object.values(frames)){
      if(this.images.has(frame.src))continue;
      const image=this.createImage();this.images.set(frame.src,image);image.src=new URL(frame.src,import.meta.url).href;
      image.decode?.().catch(()=>{});
    }
  }
  preload(pegs){for(const p of pegs)if(p.type==='shell'&&p.durability!==1)this.preloadColor(p.color);}
  draw(peg,x,y,r,alpha,sx,sy,target){
    if(peg.durability===1)return false;
    const frame=SHELL_FRAMES[peg.color]?.intact;
    const image=frame&&this.images.get(frame.src);
    if(!image?.complete||!image.naturalWidth)return false;
    target.save();target.globalAlpha=alpha;target.translate(x,y);target.scale(sx,sy);
    target.drawImage(image,...frame.rect,-r,-r,r*2,r*2);target.restore();return true;
  }
}
