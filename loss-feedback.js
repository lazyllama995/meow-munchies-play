import {goalProgress,goalComplete,solveGoal} from './campaign.js';
import {searchOrder} from './order-search.js';

// Claude's explanation, adapted to the actual shell/stone state graph. A lack
// of an immediate jump over a ball does not prove that it can never be eaten.
export function genericLoss(level,pegs){
  return {reason:'stuck',colors:goalProgress(level,pegs).filter(g=>g.collected<g.total).map(g=>g.color),balls:[]};
}
export function explainLoss(level,pegs,{provenDead=false,limit=24000,maxMs=250}={}){
  if(goalComplete(level,pegs))return null;
  if(!provenDead&&solveGoal(level,pegs,limit).status!=='dead')return null;
  const fallback=genericLoss(level,pegs);
  const missing=goalProgress(level,pegs).filter(g=>g.collected<g.total);
  const started=performance.now();let remaining=limit,individuallyPossible=true;
  const query=(state,color,total)=>{
    if(remaining<=0||performance.now()-started>maxMs)return {status:'budget'};
    // Start a future-capture order at the current position. Retained supports,
    // moving shells and each shell's remaining durability stay intact.
    const result=searchOrder({...level,pegs:state,goal:{colors:{[color]:total}}},state,{limit:Math.min(6000,remaining)});
    remaining-=Math.max(1,result.visited);return result;
  };
  for(const goal of missing){
    const need=goal.total-goal.collected;
    const balls=pegs.filter(p=>p.type!=='stone'&&(goal.color==='any'||p.color===goal.color));
    const blocked=[];
    for(const ball of balls){
      const marked=pegs.map(p=>({...p,color:p.type==='stone'?'stone':p.id===ball.id?'mint':'orange'}));
      if(query(marked,'mint',1).status==='dead')blocked.push(ball.id);
    }
    if(blocked.length&&balls.length-blocked.length<need)
      return {reason:'blocked',color:goal.color,colors:[goal.color],need,balls:blocked};
    const state=goal.color==='any'?pegs.map(p=>({...p,color:p.type==='stone'?'stone':'mint'})):pegs;
    const color=goal.color==='any'?'mint':goal.color;
    const alone=query(state,color,need);
    if(alone.status==='dead'){
      // Establish the exact maximum, not the result of a greedy sample route.
      let low=0,high=need-1;
      while(low<high){
        const middle=Math.ceil((low+high)/2),answer=query(state,color,middle);
        if(answer.status==='found'||answer.status==='won')low=middle;
        else if(answer.status==='dead')high=middle-1;
        else return fallback;
      }
      return {reason:'few',color:goal.color,colors:[goal.color],need,possible:low,balls:[]};
    }
    if(alone.status!=='found'&&alone.status!=='won')individuallyPossible=false;
  }
  // Claim incompatible colors only if each individual order was proved possible.
  return missing.length>1&&individuallyPossible?{...fallback,reason:'clash'}:fallback;
}
const ballNames={pink:['raspberry macaron','raspberry macarons'],mint:['mint biscuit','mint biscuits'],orange:['apricot mochi','apricot mochi'],any:['treat','treats']};
export function lossMessage(why){
  const [one,many]=ballNames[why.color]||ballNames.any;
  if(why.reason==='blocked')return why.balls.length===1?`This ${one} can no longer be served: no treat can jump over it.`:`These ${many} can no longer be served: no treat can jump over them.`;
  if(why.reason==='few')return `You still need ${why.need} ${why.need===1?one:many}, but from here ${why.possible?'you can collect only '+why.possible:'you cannot collect any'}.`;
  if(why.reason==='clash')return `You can no longer complete the order for ${why.colors.map(c=>ballNames[c][1]).join(' and ')} together.`;
  return why.terminal?'No jumps remain and the order is incomplete.':'The order cannot be completed from here.';
}
