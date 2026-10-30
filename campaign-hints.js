import {solveGoal,goalComplete} from './campaign.js';
import {applyMove,puzzleKey} from './game-rules.js';
const authored=new WeakMap();
function knownFor(level){
 if(authored.has(level))return authored.get(level);
 const known=new Map();
 for(const solution of level.knownSolutions||[level.solution]){
  let pegs=level.pegs;
  for(const move of solution){
   const key=puzzleKey(pegs);if(!known.has(key))known.set(key,move);
   pegs=applyMove(pegs,move,level);
  }
 }
 authored.set(level,known);return known;
}
export function answerPosition(level,pegs){
 if(goalComplete(level,pegs))return{status:'won',move:null,visited:0};
 const move=knownFor(level).get(puzzleKey(pegs));
 return move?{status:'found',move,visited:0}:solveGoal(level,pegs);
}
export function checkPosition(level,pegs,history=[]){
 const answer=answerPosition(level,pegs);
 if(answer.status!=='dead')return answer;
 const restoreSteps=recoverySteps(level,pegs,history);
 return restoreSteps?{...answer,restoreSteps}:answer;
}
// Only a position with a proved winning continuation is a recovery point.
// Repeated stone cycles and unknown/budget results do not qualify.
export function recoverySteps(level,pegs,history=[]){
 const tried=new Set([puzzleKey(pegs)]);
 for(let i=history.length-1;i>=0;i--){
  const key=puzzleKey(history[i]);if(tried.has(key))continue;tried.add(key);
  const previous=answerPosition(level,history[i]);
  if(previous.status==='found'||previous.status==='won')return history.length-i;
 }
 return 0;
}
