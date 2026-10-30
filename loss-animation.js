import {jumpEffect} from './game-rules.js';
const clamp=value=>Math.max(0,Math.min(1,value));
export function rewindFrame(step,progress,{center,mouth,pitch,reduced=false}){
  const t=clamp(progress),ease=t*t*(3-2*t),a=center(step.move.to),b=center(step.move.from);
  const mover=step.before.find(peg=>peg.id===step.move.from),over=step.before.find(peg=>peg.id===step.move.over);
  const effect=jumpEffect(over),sprites=[];
  const add=(peg,from,to,alpha=1,scale=1,arc=0)=>sprites.push({peg,
    x:reduced?(t<.5?from.x:to.x):from.x+(to.x-from.x)*ease,
    y:reduced?(t<.5?from.y:to.y):from.y+(to.y-from.y)*ease-Math.sin(t*Math.PI)*arc,
    alpha:reduced?Math.abs(2*t-1):alpha,scale});
  add(mover,a,b,1,1,reduced?0:pitch*.45);
  if(effect==='capture')add(over,mouth,center(over.id),Math.min(1,t*4),reduced?1:.35+.65*ease,reduced?0:pitch*.7);
  if(effect==='crack'){
    const p=center(over.id),bare=step.after.find(peg=>peg.id===over.id);
    sprites.push({peg:bare,x:p.x,y:p.y,alpha:1-ease,scale:1});
    sprites.push({peg:over,x:p.x,y:p.y,alpha:ease,scale:1+(reduced?0:Math.sin(t*Math.PI)*.08)});
  }
  return{sprites,hidden:new Set([step.move.from,step.move.to,...(effect==='crack'?[over.id]:[])])};
}
export function lossDragonPose({elapsed,rewinding=false,reduced=false}){
  const age=Math.max(0,elapsed),duration=reduced?.9:2.45,settle=Math.max(0,1-age/duration);
  // Give the defeat reaction enough time to read before the decision popup arrives.
  if(age>=duration)return{frame:0,sx:1,sy:1,lift:0,rotation:0};
  // Reduced motion changes the expression without moving the character.
  if(reduced)return{frame:3,sx:1,sy:1,lift:0,rotation:0};
  const sigh=Math.sin(Math.min(1,age/(duration-.08))*Math.PI);
  return{frame:3,sx:1+sigh*.035,sy:1-sigh*.065,lift:-sigh*10,
    rotation:Math.sin(age*11)*7*settle};
}
