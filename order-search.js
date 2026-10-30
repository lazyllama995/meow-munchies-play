// Color-aware A* search. Retained supports require a visited-state graph, not
// the old assumption that every jump removes one ball. Runs inside a worker.
import {pegHardness} from './game-rules.js';
import {boardTopology} from './board-topology.js';
const count=m=>{let n=0;for(;m;m&=m-1n)n++;return n;};
class Queue{
 constructor(){this.values=[];}
 push(n){let a=this.values,i=a.length;a.push(n);while(i){const p=(i-1)>>1;if(!this.before(n,a[p]))break;a[i]=a[p];i=p;}a[i]=n;}
 before(a,b){return a.f<b.f||a.f===b.f&&a.h<b.h;}
 pop(){const a=this.values,first=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&this.before(a[c+1],a[c]))c++;if(!this.before(a[c],last))break;a[i]=a[c];i=c;}a[i]=last;}return first;}
 get length(){return this.values.length;}
}
export function searchOrder(level,pegs=level.pegs,{limit=200000,forbid=null,weight=1}={}){
 const {maskOf:mask,moves:candidates,width}=boardTopology(level.cells);
 const colors=level.goal.any?['any']:Object.keys(level.goal.colors);
 const edible=p=>p.type!=='stone';
 const targets=(ps,c)=>ps.filter(p=>edible(p)&&(c==='any'||p.color===c));
 const allowed=colors.map(c=>targets(level.pegs,c).length-(c==='any'?level.goal.any:level.goal.colors[c]));
 if(allowed.some(n=>n<0))return{status:'dead',move:null,visited:0};
 const stones=mask(pegs.filter(p=>p.type==='stone'));
 const initial={m:mask(pegs),s:mask(pegs.filter(p=>p.type==='shell'&&pegHardness(p)>1)),ts:colors.map(c=>mask(targets(pegs,c))),g:0,parent:null};
 const key=n=>n.ts.reduce((k,t,i)=>k|(t<<BigInt(width*(2+i))),n.m|(n.s<<BigInt(width)));
 // Each outstanding target needs a capture. If too few targets are already
 // exposed, the excess also needs a shell crack. This lower bound is admissible.
 const estimate=n=>n.ts.reduce((sum,t,i)=>{const needed=Math.max(0,count(t)-allowed[i]);return sum+needed+Math.max(0,needed-count(t&~n.s));},0);
 initial.h=estimate(initial);initial.f=initial.h*weight;initial.key=key(initial);
 if(!initial.h)return{status:'won',move:null,solution:[],visited:0};
 const queue=new Queue();queue.push(initial);const costs=new Map([[initial.key,0]]);let visited=0;
 while(queue.length){
  const state=queue.pop();if(costs.get(state.key)!==state.g)continue;
  if(!state.h){const solution=[];for(let n=state;n.parent;n=n.parent)solution.push(n.move);solution.reverse();return{status:'found',move:solution[0],solution,visited};}
  if(++visited>limit)return{status:'budget',move:null,visited};
  for(const m of candidates){
   if(!(state.m&m.f)||(stones&m.f)||!(state.m&m.o)||(state.m&m.t))continue;
   if(forbid==='stone'&&(stones&m.o)||forbid==='shell'&&(state.s&m.o))continue;
   const removed=(stones|state.s)&m.o?0n:m.o;
   const next={m:(state.m&~m.f&~removed)|m.t,s:(state.s&~m.f&~m.o)|((state.s&m.f)?m.t:0n),
    ts:state.ts.map(t=>(t&~m.f&~removed)|((t&m.f)?m.t:0n)),g:state.g+1,parent:state,move:{from:m.from,over:m.over,to:m.to}};
   next.key=key(next);if((costs.get(next.key)??Infinity)<=next.g)continue;
   if(costs.size>=limit||queue.length>=limit)return{status:'budget',move:null,visited};
   next.h=estimate(next);next.f=next.g+weight*next.h;costs.set(next.key,next.g);queue.push(next);
  }
 }
 return{status:'dead',move:null,visited};
}
