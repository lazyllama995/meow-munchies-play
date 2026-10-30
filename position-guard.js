// One reusable worker, superseded whenever the board changes. Analysis never
// blocks dragging, and a timeout is not evidence that a position is impossible.
export class PositionGuard {
  constructor({createWorker,onResult,delay=4500,setTimer=(...args)=>setTimeout(...args),clearTimer=id=>clearTimeout(id)}) {
    Object.assign(this,{createWorker,onResult,delay,setTimer,clearTimer});
    this.worker=null;this.sequence=0;this.pending=false;this.timer=null;
  }
  cancel({dispose=false}={}) {
    this.sequence++;this.clearTimer(this.timer);this.timer=null;
    if(this.pending||dispose){this.worker?.terminate();this.worker=null;}
    this.pending=false;
  }
  check(data) {
    this.cancel();const request=this.sequence;this.pending=true;
    const finish=result=>{
      if(request!==this.sequence||!this.pending)return;
      this.pending=false;this.clearTimer(this.timer);this.timer=null;
      this.onResult({...result,boardKey:data.boardKey,index:data.index});
    };
    try {
      this.worker ||= this.createWorker();
      this.worker.onmessage=({data:result})=>{if(result.request===request)finish(result);};
      this.worker.onerror=()=>{if(request!==this.sequence||!this.pending)return;this.worker?.terminate();this.worker=null;finish({status:'error'});};
      this.timer=this.setTimer(()=>{if(request!==this.sequence||!this.pending)return;this.worker?.terminate();this.worker=null;finish({status:'budget'});},this.delay);
      this.worker.postMessage({...data,purpose:data.purpose||'check',request});
    } catch {this.worker?.terminate();this.worker=null;finish({status:'error'});}
  }
}
