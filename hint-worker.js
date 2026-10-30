import {explainLoss} from './loss-feedback.js';
import {CAMPAIGN} from './campaign.js';
import {LEVELS} from './game-rules.js';
import {answerPosition,checkPosition,recoverySteps} from './campaign-hints.js';
import LEVEL_600 from './level-600-data.js';
const challenge={...LEVEL_600,cells:LEVELS[0].cells};
self.onmessage=({data})=>{
 try{
  const level=data.challenge?challenge:CAMPAIGN[data.index];
  if(data.purpose==='recover'){
   const restoreSteps=recoverySteps(level,data.pegs,data.history);
   self.postMessage({request:data.request,status:'recovered',restoreSteps});return;
  }
  const answer=data.purpose==='check'?checkPosition(level,data.pegs,data.history):answerPosition(level,data.pegs);
  if(data.purpose==='check'&&answer.status==='dead')answer.loss=explainLoss(level,data.pegs,{provenDead:true});
  self.postMessage({request:data.request,...answer});
 }catch{self.postMessage({request:data.request,status:'error',move:null});}
};
