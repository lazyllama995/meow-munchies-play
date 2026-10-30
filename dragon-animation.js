// The dragon reacts to food with its existing painted frames and whole-body
// transforms only: the face artwork is never redrawn.
// Frames: 0 idle (open smile), 1 anticipation (mouth open for incoming food),
// 2 bite (mouth closed, eyes shut). Incoming food takes priority over the end of
// a reaction so consecutive captures still meet an open mouth.
// After a bite (seconds): chomp until CHOMP, then MUNCHES munches of MUNCH each
// (the jaw closes again at the start of each), then a happy hop for food in the
// order, higher with each chain link, or a small "hm" nod for other food.
// Finishing the order plays the PARTY instead.
export const CHOMP=.14,MUNCH=.22,MUNCHES=2,HOP=.44,PARTY=1.5;
// Party beats shared with game.js (confetti from the mouth as it leaps, dust as it
// lands) and bite-sound.js (the gulp as it leaps).
export const PARTY_BEATS=Object.freeze([.4,.88]);
// One reused pose: render reads it immediately, so nothing is allocated per frame.
const pose={frame:0,sx:1,sy:1,lift:0,rotation:0,x:0};
const bump=(t,from,to)=>t>from&&t<to?Math.sin((t-from)/(to-from)*Math.PI):0;
function set(frame,sx=1,sy=1,lift=0,rotation=0,x=0){
  pose.frame=frame;pose.sx=sx;pose.sy=sy;pose.lift=lift;pose.rotation=rotation;pose.x=x;return pose;
}
// Adds one hop over p = 0..1: crouch, flight with stretch, landing squash.
function hop(p,height){
  if(p<.2){const q=Math.sin(p/.2*Math.PI);pose.sx+=q*.05;pose.sy-=q*.07;return;}
  if(p<.8){const a=(p-.2)/.6,k=Math.abs(1-2*a)*.05;pose.lift+=4*a*(1-a)*height;pose.sx-=k*.7;pose.sy+=k;return;}
  const q=Math.sin((p-.8)/.2*Math.PI);pose.sx+=q*.06;pose.sy-=q*.07;
}

// Finishing the order: chomp, a trembling "mmm" crouch, a big leap with a wiggle,
// a squashy landing with eyes shut for joy, then two small bounces.
function party(c,reduced){
  const [leap,land]=PARTY_BEATS;
  if(reduced)return set(c<.5?2:0);
  if(c<CHOMP){const b=Math.sin(c/CHOMP*Math.PI);return set(2,1+b*.06,1-b*.05);}
  if(c<leap){const q=Math.sin((c-CHOMP)/(leap-CHOMP)*Math.PI/2);return set(2,1+q*.08,1-q*.1,-q*2,Math.sin(c*70)*q*.9);}
  if(c<land){const a=(c-leap)/(land-leap),k=Math.abs(1-2*a)*.07;return set(0,1-k*.7,1+k,4*a*(1-a)*40,Math.sin(a*Math.PI*2)*8);}
  if(c<land+.16){const q=Math.sin((c-land)/.16*Math.PI);return set(2,1+q*.12,1-q*.12);}
  const p=(c-land-.16)/(PARTY-land-.16);set(0);
  if(p<.56)hop(p/.56,14);else hop((p-.56)/.44,7);
  pose.rotation=Math.sin(p*Math.PI*4)*4*(1-p);
  return pose;
}

export function dragonPose({elapsed:e,approaching=false,reduced=false,streak=1,cheer=Infinity,liked=true}){
  if(cheer>=0&&cheer<PARTY)return party(cheer,reduced);
  const level=Math.max(1,Math.min(5,streak||1));
  const munchEnd=CHOMP+MUNCHES*MUNCH,munching=e>=CHOMP&&e<munchEnd;
  const beat=munching?((e-CHOMP)%MUNCH)/MUNCH:0;
  // Reduced motion keeps the munch on one frame: no flicker, no movement.
  const frame=e>=0&&e<CHOMP?2:approaching?1:munching?(reduced||beat<.62?2:0):0;
  set(frame);
  if(reduced||!(e>=0))return pose;
  // Chomp: a quick squash with a small head shake.
  const chomp=bump(e,0,.22);pose.sx+=chomp*.05;pose.sy-=chomp*.045;
  if(e<.6)pose.rotation+=Math.sin(e*21)*(1-e/.6)*1.4;
  // Munch: the jaw squashes the head a little with each bite.
  if(munching&&!approaching){const m=Math.sin(beat*Math.PI);pose.sx+=m*.025;pose.sy-=m*.04;pose.lift-=m*1.5;}
  const after=e-munchEnd;
  if(after<0)return pose;
  if(liked){
    // Happy hop, higher and wigglier with each chain link; from four links, a second hop.
    const height=6+(level-1)*4,total=level>=4?HOP+.28:HOP;
    if(after>=total)return pose;
    if(after<HOP)hop(after/HOP,height);else hop((after-HOP)/.28,height*.55);
    const fade=1-after/total;
    pose.rotation+=Math.sin(after*16)*(.6+level*.5)*fade;
    if(level>=3)pose.x=Math.sin(after*25)*(level-2)*1.6*fade;
  }else pose.rotation-=bump(after,0,.34)*2.2; // food outside the order: a small "hm" nod
  return pose;
}
