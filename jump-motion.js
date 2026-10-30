// The shape of one jump on the board and of the food it sends to the dragon, as
// pure maths so it can be tested without a canvas. A tapped ball crouches, springs
// along a true parabola, freezes for a hit-stop as it crosses the ball it captures,
// and lands. The crouch and the hit-stop fit inside the old .34 s, so play is not slower.
export const JUMP=Object.freeze({tap:.30,drag:.20,calm:.16,crouch:.045,ghostLag:.06});
export const HIT_STOP=Object.freeze({capture:.045,crack:.035,stone:0});
// A captured ball pops in place for POP_HOLD seconds (covering the hit-stop), then
// leaves for the mouth; its swell and white flash fade at POP_RATE per second.
export const POP_HOLD=.07,POP_RATE=4.5;

// Fraction of the flight at which the mover is closest to the ball it jumps over.
// A drag released past that ball captures it almost at once.
export function crossingPoint(from,over,to){
  const dx=to.x-from.x,dy=to.y-from.y,length=dx*dx+dy*dy;
  if(!length)return .5;
  return Math.max(.18,Math.min(.82,((over.x-from.x)*dx+(over.y-from.y)*dy)/length));
}

// Times for a new jump. Total time on screen = duration + hitStop.
export function jumpTiming({dragged=false,reduced=false,effect='capture'}={}){
  if(reduced)return{duration:JUMP.calm,crouch:0,hitStop:0};
  return{duration:dragged?JUMP.drag:JUMP.tap,crouch:dragged?0:JUMP.crouch,hitStop:HIT_STOP[effect]||0};
}

// Writes the pose of jump `j` at clock `now` into `out` (reused, no allocation):
// t overall progress (1 = landed), u flight progress, height 0..1 of the arc,
// sx/sy squash and stretch, sink = fraction of the radius the ball sinks while crouching.
// `j` needs start, duration, crouch, hitStop and hitAt (-1 until the hit).
export function jumpShape(j,now,reduced,out){
  const held=j.hitAt>=0?Math.min(j.hitStop,Math.max(0,now-j.hitAt)):0;
  const age=Math.max(0,now-j.start-held);
  const u=Math.min(1,Math.max(0,(age-j.crouch)/(j.duration-j.crouch)));
  out.t=Math.min(1,age/j.duration);out.u=u;out.sink=0;
  if(reduced){out.height=0;out.sx=out.sy=1;return out;}
  out.height=4*u*(1-u);
  if(age<j.crouch){
    const q=Math.sin(age/j.crouch*Math.PI/2);
    out.sx=1+q*.14;out.sy=1-q*.16;out.sink=q*.16;return out;
  }
  // Stretch with vertical speed: strongest at launch and touchdown, round at the top.
  const speed=u<1?Math.abs(1-2*u):0;
  out.sx=1-speed*.09;out.sy=1+speed*.13;
  return out;
}

// Size of a captured ball while it pops, relative to its flight size: it starts at its
// board size, swells, then shrinks to flight size as it leaves for the mouth.
// p runs 0 → 1 over the pop.
const BOARD_TO_FLIGHT=.422/.36,POP_PEAK=1.45;
export function popScale(p){
  if(p<.3)return BOARD_TO_FLIGHT+(POP_PEAK-BOARD_TO_FLIGHT)*Math.sin(p/.3*Math.PI/2);
  const e=Math.min(1,(p-.3)/.7);
  return 1+(POP_PEAK-1)*(1-e)*(1-e);
}
// White flash over the popping ball: full for the first frames, gone by mid-pop.
export const popFlash=p=>Math.max(0,.9-1.8*Math.max(0,p-.08));

// The order's last ball hangs at the top of its hop: its own clock slows to 20% and
// eases back. Returns 0 outside the hang and 1 at its deepest; `age` is the ball's clock.
const HANG_START=.03,HANG_LENGTH=.24,HANG_DEPTH=.8;
export function finaleHang(age){
  const u=(age-HANG_START)/HANG_LENGTH;
  return u<=0||u>=1?0:Math.sin(Math.PI*u)**2;
}
// Real seconds the hang adds to the fall, from any row: ∫ dt/(1-depth·sin²) - length (≈ .297 s).
export const FINALE_HANG_EXTRA=HANG_LENGTH*(1/Math.sqrt(1-HANG_DEPTH)-1);
export const finaleClock=age=>1-HANG_DEPTH*finaleHang(age);
