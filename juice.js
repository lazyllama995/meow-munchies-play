// Presentation-only "juice": bursts, rings, glows, flying stars and screen
// shake drawn on an overlay canvas above the board. Nothing here touches the
// rules, the order or the saves; every effect is skipped with reduced motion.
const PALETTE={
  mint:['#5fe0b0','#b9ffe4','#2fae86'],
  pink:['#ff7f93','#ffd0d8','#e04d68'],
  orange:['#ffb63f','#ffe7a6','#e98a1c'],
  shell:['#fff0d2','#ffffff','#e3c79a'],
  gold:['#ffd75e','#fff6c8','#f2a93b'],
};
const tone=color=>PALETTE[color]||PALETTE.gold;
const rand=(a,b)=>a+Math.random()*(b-a);
const easeOut=t=>1-Math.pow(1-t,3);
// Phone budget: every live particle costs a save/translate/draw per frame. Past the cap,
// new bursts emit fewer particles; the win cannons (confettiCannons) always fire in full.
const MAX_PARTS=260;

export function createJuice(game,{reduced}){
  const canvas=document.createElement('canvas');
  canvas.id='fx';canvas.setAttribute('aria-hidden','true');
  game.append(canvas);
  const ctx=canvas.getContext('2d');
  let W=390,H=844,parts=[],rings=[],flashes=[],flyers=[],shake={power:0,age:0,life:0},screenFlash=null,spot={x:0,y:0,r:0,a:0,want:0,grow:0};

  function resize(w,h,dpr){W=w;H=h;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
  function clear(){parts=[];rings=[];flashes=[];flyers=[];screenFlash=null;spot.a=spot.want=spot.grow=0;shake.life=0;game.style.translate='';}

  // kind: star | candy | glow | dust | spark | confetti
  function burst(x,y,color,{count=10,speed=160,kind='star',size=[4,8],life=[.45,.8],gravity=520,spread=Math.PI*2,angle=-Math.PI/2,up=.3}={}){
    if(reduced())return;
    count=Math.min(count,MAX_PARTS-parts.length);if(count<=0)return;
    const [main,light,deep]=tone(color);
    for(let i=0;i<count;i++){
      const a=spread>=Math.PI*2?Math.PI*2*(i+Math.random()*.6)/count:angle+(Math.random()-.5)*spread;
      const f=speed*rand(.55,1.15);
      parts.push({x,y,vx:Math.cos(a)*f,vy:Math.sin(a)*f-speed*up,kind,age:0,life:rand(...life),size:rand(...size),
        rot:Math.random()*6.3,spin:rand(-9,9),gravity,drag:kind==='dust'?3.2:kind==='glow'?2.2:1.1,
        color:[main,light,deep][i%3===2&&kind!=='glow'?1:0],edge:deep,flip:Math.random()*6.3});
    }
  }
  function ring(x,y,color,{from=8,to=60,life=.4,width=5}={}){if(!reduced())rings.push({x,y,color:tone(color)[1],from,to,life,width,age:0});}
  function glow(x,y,color,{radius=80,life=.35}={}){if(!reduced())flashes.push({x,y,color:tone(color)[0],radius,life,age:0});}
  // Dims everything but a circle that follows one moment (the order's last ball). Call it every
  // frame: it eases in and out at the same speed on any frame rate and fades once the calls stop.
  function spotlight(x,y,r,alpha=.42){if(reduced())return;spot.x=x;spot.y=y;spot.r=r;spot.want=alpha;spot.grow=0;}
  // The release: the lit circle widens from (x,y) past the screen edges while the dimming fades.
  function irisOut(x,y){if(reduced()||!spot.a)return;spot.x=x;spot.y=y;spot.want=0;spot.grow=Math.max(W,H)*2.4;}
  function flashScreen(color='#fff8e6',alpha=.35,life=.28){if(!reduced())screenFlash={color,alpha,life,age:0};}
  function kick(power=4,life=.28){if(reduced())return;if(power>=shake.power*(1-shake.age/Math.max(shake.life,.01)))shake={power,age:0,life};}
  // A glowing star that flies to a DOM target (an order chip) and calls back on arrival.
  function fly(x,y,color,target,onArrive){
    if(reduced()||!target){onArrive?.();return;}
    const r=target.getBoundingClientRect(),g=game.getBoundingClientRect();
    const tx=r.left-g.left+r.width*.5,ty=r.top-g.top+r.height*.5;
    flyers.push({x0:x,y0:y,tx,ty,cx:x+(tx-x)*.25+rand(-60,60),cy:Math.min(y,ty)-rand(30,80),color,age:0,life:.48+Math.random()*.08,onArrive,trail:[]});
  }
  // Sugar-crush style cannons from both bottom corners.
  function confettiCannons(){
    if(reduced())return;
    const colors=['mint','pink','orange','gold'];
    for(const side of [-1,1]){
      const x=side<0?-6:W+6,y=H*.78;
      for(let i=0;i<34;i++){
        const a=-Math.PI/2-side*rand(.18,.62),f=rand(520,860),c=tone(colors[i%4]);
        parts.push({x,y,vx:Math.cos(a)*f,vy:Math.sin(a)*f,kind:i%5===0?'star':'confetti',age:-rand(0,.18),life:rand(1.5,2.3),size:rand(5,9),rot:Math.random()*6.3,spin:rand(-12,12),gravity:640,drag:1.6,color:c[0],edge:c[2],flip:Math.random()*6.3});
      }
    }
  }

  function step(dt){
    if(dt===0){if(shake.life>0)game.style.translate='';return;}
    for(const p of parts){p.age+=dt;if(p.age<0)continue;const k=Math.exp(-p.drag*dt);p.vx*=k;p.vy=p.vy*k+p.gravity*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.spin*dt;p.flip+=dt*11;}
    parts=parts.filter(p=>p.age<p.life&&p.y<H+40);
    for(const r of rings)r.age+=dt;rings=rings.filter(r=>r.age<r.life);
    for(const f of flashes)f.age+=dt;flashes=flashes.filter(f=>f.age<f.life);
    if(screenFlash){screenFlash.age+=dt;if(screenFlash.age>=screenFlash.life)screenFlash=null;}
    spot.a+=(spot.want-spot.a)*Math.min(1,dt*(spot.grow?6:12));spot.r+=spot.grow*dt;spot.want=0;if(spot.a<.004)spot.a=spot.grow=0;
    for(const f of flyers){
      f.age+=dt;const t=Math.min(1,f.age/f.life),e=t*t*(3-2*t),u=1-e;
      f.x=u*u*f.x0+2*u*e*f.cx+e*e*f.tx;f.y=u*u*f.y0+2*u*e*f.cy+e*e*f.ty;
      f.trail.unshift({x:f.x,y:f.y});if(f.trail.length>9)f.trail.pop();
      if(t>=1&&!f.done){f.done=true;burst(f.tx,f.ty,f.color,{count:9,speed:120,size:[3,6],life:[.3,.55],gravity:260});ring(f.tx,f.ty,f.color,{from:6,to:34,life:.3,width:4});f.onArrive?.();}
    }
    flyers=flyers.filter(f=>!f.done);
    if(shake.life>0){
      shake.age+=dt;const t=shake.age/shake.life;
      if(t>=1){shake.life=0;shake.power=0;game.style.translate='';}
      else{const a=shake.power*(1-t)*(1-t);game.style.translate=`${(Math.sin(shake.age*83)*a).toFixed(2)}px ${(Math.cos(shake.age*67)*a*.8).toFixed(2)}px`;}
    }
  }

  function star(size){
    ctx.beginPath();
    for(let i=0;i<10;i++){const r=i%2?size*.45:size,a=-Math.PI/2+i*Math.PI/5;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}
    ctx.closePath();
  }
  function render(){
    ctx.clearRect(0,0,W,H);
    if(!parts.length&&!rings.length&&!flashes.length&&!flyers.length&&!screenFlash&&!spot.a)return;
    if(spot.a>0){const r=spot.r*.6,g=ctx.createRadialGradient(spot.x,spot.y,r,spot.x,spot.y,r+Math.max(W,H));g.addColorStop(0,'rgba(40,20,30,0)');g.addColorStop(.12,'rgba(40,20,30,.6)');g.addColorStop(1,'rgb(40,20,30)');ctx.save();ctx.globalAlpha=spot.a;ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.restore();}
    ctx.save();ctx.globalCompositeOperation='lighter';
    for(const f of flashes){
      const t=f.age/f.life,r=f.radius*(.55+.45*easeOut(t)),g=ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,r);
      g.addColorStop(0,`rgba(255,250,225,${.85*(1-t)})`);g.addColorStop(.35,f.color+Math.round(150*(1-t)).toString(16).padStart(2,'0'));g.addColorStop(1,'rgba(255,220,150,0)');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(f.x,f.y,r,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
    for(const r of rings){
      const t=r.age/r.life;ctx.save();ctx.globalAlpha=(1-t)*.9;ctx.strokeStyle=r.color;ctx.lineWidth=r.width*(1-t*.7);
      ctx.shadowColor=r.color;ctx.shadowBlur=10;ctx.beginPath();ctx.arc(r.x,r.y,r.from+(r.to-r.from)*easeOut(t),0,Math.PI*2);ctx.stroke();ctx.restore();
    }
    for(const p of parts){
      if(p.age<0)continue;
      const t=p.age/p.life,fade=t>.7?1-(t-.7)/.3:1;
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.globalAlpha=fade;
      if(p.kind==='star'){
        const s=p.size*(t<.15?t/.15:1);ctx.fillStyle=p.color;ctx.shadowColor=p.color;ctx.shadowBlur=8;star(s);ctx.fill();
        ctx.shadowBlur=0;ctx.fillStyle='#fffbea';star(s*.42);ctx.fill();
      }else if(p.kind==='candy'){
        const s=p.size;ctx.fillStyle=p.color;ctx.strokeStyle=p.edge;ctx.lineWidth=1.2;
        ctx.beginPath();ctx.roundRect(-s,-s*.45,s*2,s*.9,s*.45);ctx.fill();ctx.stroke();
        ctx.fillStyle='rgba(255,255,255,.7)';ctx.beginPath();ctx.roundRect(-s*.7,-s*.3,s*.9,s*.22,s*.1);ctx.fill();
      }else if(p.kind==='confetti'){
        const s=p.size;ctx.scale(1,Math.cos(p.flip));ctx.fillStyle=Math.cos(p.flip)>0?p.color:p.edge;ctx.fillRect(-s*.5,-s,s,s*2);
      }else if(p.kind==='dust'){
        const s=p.size*(1+t*1.4);ctx.globalAlpha=fade*.5*(1-t);ctx.fillStyle='#fff3dc';ctx.beginPath();ctx.arc(0,0,s,0,Math.PI*2);ctx.fill();
      }else if(p.kind==='heart'){
        const s=p.size;ctx.rotate(-p.rot+Math.sin(p.age*6)*.3);ctx.fillStyle=p.color;ctx.beginPath();ctx.moveTo(0,s*.9);ctx.bezierCurveTo(-s*1.4,-s*.1,-s*.6,-s*1.1,0,-s*.35);ctx.bezierCurveTo(s*.6,-s*1.1,s*1.4,-s*.1,0,s*.9);ctx.fill();
      }else if(p.kind==='spark'){
        ctx.rotate(-p.rot+Math.atan2(p.vy,p.vx));const len=Math.min(22,Math.hypot(p.vx,p.vy)*.045)+2;
        ctx.strokeStyle=p.color;ctx.lineWidth=p.size*.5;ctx.lineCap='round';ctx.shadowColor=p.color;ctx.shadowBlur=6;
        ctx.beginPath();ctx.moveTo(-len,0);ctx.lineTo(len*.3,0);ctx.stroke();
      }else{
        ctx.globalCompositeOperation='lighter';const g=ctx.createRadialGradient(0,0,0,0,0,p.size*2);
        g.addColorStop(0,'rgba(255,255,240,.95)');g.addColorStop(.4,p.color);g.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,p.size*2,0,Math.PI*2);ctx.fill();
      }
      ctx.restore();
    }
    for(const f of flyers){
      const [main]=tone(f.color);
      ctx.save();ctx.globalCompositeOperation='lighter';
      for(const [i,q] of f.trail.entries()){ctx.globalAlpha=.5*(1-i/9);ctx.fillStyle=main;ctx.beginPath();ctx.arc(q.x,q.y,7*(1-i/10),0,Math.PI*2);ctx.fill();}
      ctx.restore();
      ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.age*9);ctx.fillStyle=main;ctx.shadowColor=main;ctx.shadowBlur=14;star(11);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#fffdf0';star(4.5);ctx.fill();ctx.restore();
    }
    if(screenFlash){const t=screenFlash.age/screenFlash.life;ctx.save();ctx.globalAlpha=screenFlash.alpha*(1-t)*(1-t);ctx.fillStyle=screenFlash.color;ctx.fillRect(0,0,W,H);ctx.restore();}
  }
  return {canvas,resize,clear,burst,ring,glow,spotlight,irisOut,flashScreen,kick,fly,confettiCannons,step,render};
}
