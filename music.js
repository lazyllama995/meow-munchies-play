// The original cozy loop is CC0 by MintoDog; five additional compositions are
// original game compositions rendered from scripts/generate-music.py.
// https://opengameart.org/content/cozy-puzzle-in-game-1

export const SOUNDTRACKS=Object.freeze([
  {id:'cozy',title:'Cozy Café Morning',file:'cozy-puzzle-loop.mp3'},
  {id:'mundo-por-descubrir',title:'A Whisker Lane Stroll',file:'mundo-por-descubrir.mp3'},
  {id:'baile-de-las-frutas',title:'Orchard Picnic',file:'baile-de-las-frutas.mp3'},
  {id:'pasos-traviesos',title:'Playful Paws',file:'pasos-traviesos.mp3'},
  {id:'rio-de-estrellas',title:'Lantern Lane',file:'rio-de-estrellas.mp3'},
  {id:'gran-fiesta-del-dragon',title:'The Grand Tasting Party',file:'gran-fiesta-del-dragon.mp3'},
]);
export const soundtrackId=id=>SOUNDTRACKS.some(track=>track.id===id)?id:'cozy';
const sourceFor=id=>new URL(`./assets/${SOUNDTRACKS.find(item=>item.id===id).file}`,import.meta.url).href;

const hz=midi=>440*2**((midi-69)/12);

export function createSoundtrack(ctx,initialId='cozy'){
  let selectedId=soundtrackId(initialId);
  const track=new Audio(sourceFor(selectedId));
  track.loop=true;
  track.preload='auto';
  track.hidden=true;
  track.setAttribute('aria-hidden','true');
  document.body.append(track);
  const musicBus=ctx.createGain(),celebrationBus=ctx.createGain();
  musicBus.gain.value=0;
  celebrationBus.gain.value=.55;
  ctx.createMediaElementSource(track).connect(musicBus).connect(ctx.destination);
  celebrationBus.connect(ctx.destination);
  const playing=new Set();
  let active=false,blocked=false,playPending=false,playAttempt=0;
  const musicLevel=.17;

  function note(midi,at,length,volume,{type='sine',attack=.01,release=.18}={}){
    const oscillator=ctx.createOscillator(),envelope=ctx.createGain();
    oscillator.type=type;oscillator.frequency.setValueAtTime(hz(midi),at);
    envelope.gain.setValueAtTime(.0001,at);
    envelope.gain.linearRampToValueAtTime(volume,at+attack);
    envelope.gain.setValueAtTime(volume,at+Math.max(attack,length-release));
    envelope.gain.exponentialRampToValueAtTime(.0001,at+length);
    oscillator.connect(envelope).connect(celebrationBus);
    playing.add(oscillator);
    oscillator.onended=()=>{playing.delete(oscillator);oscillator.disconnect();envelope.disconnect();};
    oscillator.start(at);oscillator.stop(at+length+.02);
  }

  function fadeMusic(target,duration){
    const now=ctx.currentTime,gain=musicBus.gain;
    gain.cancelScheduledValues(now);gain.setValueAtTime(gain.value,now);
    gain.linearRampToValueAtTime(target,now+duration);
  }

  function select(id,gesture=false){
    const next=soundtrackId(id);
    if(next!==selectedId){
      selectedId=next;
      ++playAttempt;playPending=false;blocked=false;
      track.pause();track.src=sourceFor(next);track.load?.();
    }
    if(gesture)resume(true);
    return selectedId;
  }

  function preview(){
    track.currentTime=0;
    resume(true);
  }

  function resume(gesture=false){
    if(!active){active=true;fadeMusic(musicLevel,.38);}
    if(!track.paused||(playPending&&!gesture)||(blocked&&!gesture))return;
    const attempt=++playAttempt;
    blocked=false;playPending=true;
    try{
      Promise.resolve(track.play()).then(()=>{if(attempt!==playAttempt)return;playPending=false;if(!active)fadeMusic(0,.1);},()=>{if(attempt!==playAttempt)return;playPending=false;blocked=true;});
    }catch{if(attempt===playAttempt){playPending=false;blocked=true;}}
  }

  function pause(){
    if(!active)return;
    active=false;fadeMusic(0,.22);
  }

  function duck(){
    if(!active)return;
    const now=ctx.currentTime,gain=musicBus.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value,now);
    gain.linearRampToValueAtTime(.045,now+.025);
    gain.setValueAtTime(.045,now+.19);
    gain.linearRampToValueAtTime(musicLevel,now+.48);
  }

  function celebrate(){
    if(ctx.state!=='running')return false;
    duck();
    const at=ctx.currentTime+.04;
    for(const [i,midi] of [72,76,79,84].entries()){
      note(midi,at+i*.17,.48,.10,{type:'triangle',attack:.009,release:.3});
      note(midi+12,at+i*.17+.05,.24,.025,{attack:.005,release:.14});
    }
    for(const midi of [60,64,67,72])note(midi,at+.76,1.15,.048,{attack:.06,release:.65});
    for(const [i,midi] of [88,91,96].entries())note(midi,at+.88+i*.15,.34,.024,{type:'triangle',attack:.008,release:.2});
    return true;
  }

  function stop(){
    pause();track.pause();
    for(const oscillator of playing){try{oscillator.stop();}catch{}}
    playing.clear();
  }

  return{resume,pause,duck,celebrate,stop,select,preview,getSelected:()=>selectedId};
}
