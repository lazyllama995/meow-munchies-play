// Visible silhouettes measured at alpha >= 128 in the separate 512px sprites.
// Ignore faint watercolor specks when finding the ball's diameter and center.
const bounds={mint:[65,74,447,455],pink:[60,64,452,453],orange:[41,55,471,457]};
const canvasSize=512;
// Board canvas: the glossy atlasRects hold a ~452px ball in a 460px rect, so the
// watercolor balls fill the same 98% of their drawn box.
const boardFraction=.98;
// HUD and level-transition icons keep the earlier 420/512 framing: at 98% the 52px
// single-order icon overflows the 50px order card (overflow:hidden) and the 54px
// transition icons (margin-right:-8px) overlap.
const iconFraction=420/canvasSize;
const frameSize=([left,top,right,bottom],fraction)=>Math.max(right-left,bottom-top)/fraction;

// Uniform scale preserves each painting's proportions; it does not stretch an oval
// or change the artwork itself. Board and icon framings share the same centers.
export const STORYBOOK_MARBLE_FRAMES=Object.freeze(Object.fromEntries(
  Object.entries(bounds).map(([color,box])=>{
    const [left,top,right,bottom]=box,cx=(left+right)/2,cy=(top+bottom)/2;
    const board=frameSize(box,boardFraction),icon=frameSize(box,iconFraction);
    const position=center=>100*(icon/2-center)/(icon-canvasSize);
    return[color,Object.freeze({
      source:Object.freeze([cx-board/2,cy-board/2,board,board]),
      backgroundSize:`${100*canvasSize/icon}% ${100*canvasSize/icon}%`,
      backgroundPosition:`${position(cx)}% ${position(cy)}%`,
    })];
  })
));
