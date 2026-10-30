// The golden-ball pachinko: a pin board drawn on its own canvas with simple
// circle physics. The player aims along the top rail and lets go to drop.
import { SLOTS } from './meta-rules.js';

const PIN_ROWS = 9;
const GRAVITY = 1250;
const SPEED = 1.05;
const TERMINAL = 500;
const STEP = 1 / 480; // fixed step in real seconds: the same physics at 30, 60 or 120 Hz
const STALL = .5;      // real seconds without a new low point before the ball gets a kick
const MAX_FALL = 7;   // real seconds; a ball still above the slots then lands where it is
const PIN_TONES = [['#d9f2e7', '#67ad98'], ['#ffd9df', '#d96c82'], ['#ffe8ba', '#d99c45']];
export const PACHINKAT_FORMS = ['CLASSIC CASCADE', 'YARN HOURGLASS', 'DIAMOND DROP'];

// Half-width of the playable peg silhouette at a normalized vertical position.
// These profiles are deliberately different, while staying broad enough that a
// Diamond always has multiple routes and cannot be sealed above the reward slots.
export function pachinkatFormHalfWidth(style, t) {
  const y = Math.max(0, Math.min(1, Number(t) || 0));
  if (style === 1) return .18 + .32 * Math.abs(y * 2 - 1); // broad ends, narrow waist
  if (style === 2) return .16 + .34 * (1 - Math.abs(y * 2 - 1)); // narrow ends, broad centre
  return .18 + .32 * y; // traditional widening cascade
}

const slotSignature = order => order.map(index => `${SLOTS[index].kind}:${SLOTS[index].amount || 0}`).join('|');
export function shuffledPachinkatSlots(seed, previous = []) {
  const slots = Array.from({ length: SLOTS.length }, (_, index) => index);
  let state = (Number(seed) || 1) >>> 0;
  const random = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  // Duplicate-value holes can make a real permutation look unchanged. Rotate
  // until the visible prize sequence differs from the board just played.
  if (previous.length === slots.length) {
    const before = slotSignature(previous);
    for (let attempts = 0; attempts < slots.length && slotSignature(slots) === before; attempts++) slots.push(slots.shift());
  }
  return slots;
}

export function createPachinko(canvas, { reduced, onTick, onHit, onLand }) {
  const ctx = canvas.getContext('2d');
  const diamondArt = typeof Image === 'function' ? new Image() : null;
  if (diamondArt) diamondArt.src = 'assets/ui/meta/cat-diamond-v1.webp';
  const boxArt = typeof Image === 'function' ? new Image() : null;
  if (boxArt) boxArt.src = 'assets/ui/meta/cat-bonbon-box-closed-v2.png';
  let W = 300, H = 400, dpr = 1, pins = [], dividers = [], slotTop = 0, slotW = 0, ballR = 9, left = 0, right = 0;
  let shake = 0, flash = 0;
  let aimX = 0.5, aiming = false, ball = null, lucky = false, sparks = [], slotGlow = new Array(SLOTS.length).fill(0), raf = 0, last = 0, visible = false, armed = false;
  let acc = 0, staleLayout = false, layoutStyle = 0, shuffleSeed = 1, slotOrder = shuffledPachinkatSlots(1);

  const noise = value => {
    const n = Math.sin((value + shuffleSeed * 37.17) * 91.713) * 43758.5453;
    return n - Math.floor(n);
  };

  function layout() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return; // not on screen: keep the last good board
    W = Math.max(200, rect.width); H = Math.max(260, rect.height);
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    left = 10; right = W - 10;
    slotTop = H - 70; slotW = (right - left) / SLOTS.length;
    ballR = Math.max(9, Math.min(13, W / 30));
    const pinR = Math.max(4.5, W / 62);
    // The last pin row sits a whole ball above the divider tops, so a ball can never
    // rest between a pin and a divider (it did, above both egg slots).
    const top = 70, bottom = slotTop - 2 * ballR - pinR - 9;
    pins = [];
    const cols = 9, gapX = (right - left) / cols;
    // A short board loses rows rather than packing them so tight that the ball can
    // wedge between a pin and the two diagonal pins above it.
    const minGapY = Math.sqrt(Math.max(0, (2 * ballR + 2 * pinR + 3) ** 2 - (gapX / 2) ** 2));
    const rows = Math.max(3, Math.min(PIN_ROWS, Math.floor((bottom - top) / minGapY) + 1)), gapY = (bottom - top) / (rows - 1);
    for (let row = 0; row < rows; row++) {
      const odd = row % 2, y = top + row * gapY, tone = PIN_TONES[row % PIN_TONES.length];
      // Every row has a pin on each wall that kicks the ball back in. Odd rows have no
      // pin half a gap from the wall: that gap was narrower than the ball, which could
      // rest between the wall and the pin.
      const xs = [left, right], halfWidth = pachinkatFormHalfWidth(layoutStyle, rows === 1 ? 0 : row / (rows - 1));
      for (let col = 1; col < (odd ? cols - 1 : cols); col++) {
        const x = left + (col + (odd ? .5 : 0)) * gapX + (noise(row * 13 + col) - .5) * gapX * .24;
        if (Math.abs((x - left) / (right - left) - .5) <= halfWidth + .025)
          xs.push(Math.max(left + pinR + 2, Math.min(right - pinR - 2, x)));
      }
      for (const x of xs) pins.push({ x, y, r: pinR, glow: 0, tone });
    }
    // Dividers start at the slot line, where the ball is paid.
    dividers = [];
    for (let i = 1; i < SLOTS.length; i++) dividers.push({ x: left + i * slotW, y1: slotTop, y2: H - 6 });
    staleLayout = false;
  }

  const aimPosition = () => left + ballR + aimX * (right - left - 2 * ballR);
  function setAim(clientX) {
    const rect = canvas.getBoundingClientRect();
    aimX = Math.max(0, Math.min(1, (clientX - rect.left - left - ballR) / (right - left - 2 * ballR)));
  }
  canvas.addEventListener('pointerdown', event => { if (!armed || ball) return; aiming = true; setAim(event.clientX); canvas.setPointerCapture?.(event.pointerId); });
  canvas.addEventListener('pointermove', event => { if (aiming) setAim(event.clientX); });
  const release = () => { if (!aiming) return; aiming = false; drop(); };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', () => { aiming = false; });

  let pending = null;
  function arm(isLucky, onDrop) { armed = true; lucky = isLucky; pending = onDrop; }
  function disarm() { armed = false; pending = null; }
  function drop() {
    if (!armed || ball) return false;
    const start = pending; armed = false; pending = null;
    if (start && start() === false) return false;
    ball = { x: aimPosition(), y: 30, vx: (Math.random() - .5) * 40, vy: 0, age: 0, trail: [], hits: 0, rot: 0, squash: 0, low: 30, stall: 0, kicks: 0, lucky };
    burst(ball.x, 30, '#ffd75e', 10, 140); flash = .5;
    return true;
  }

  function burst(x, y, color, count, speed) {
    if (reduced()) return;
    for (let i = 0; i < count; i++) {
      const a = Math.PI * 2 * i / count + Math.random() * .4, f = speed * (.5 + Math.random() * .7);
      sparks.push({ x, y, vx: Math.cos(a) * f, vy: Math.sin(a) * f - speed * .4, age: 0, life: .5 + Math.random() * .4, color, size: 3 + Math.random() * 4 });
    }
  }

  // Near a slot that holds an egg the ball slows down, to build suspense.
  function nearEgg(b) {
    if (reduced() || b.y < slotTop - 4 * ballR) return false;
    const slot = Math.max(0, Math.min(SLOTS.length - 1, Math.floor((b.x - left) / slotW)));
    return b.lucky || SLOTS[slotOrder[slot]].kind === 'egg';
  }

  // The ball is paid as soon as its centre crosses the slot line.
  function land(quiet) {
    const b = ball; ball = null;
    const slot = Math.max(0, Math.min(SLOTS.length - 1, Math.floor((b.x - left) / slotW))), rewardSlot = slotOrder[slot];
    const cx = left + (slot + .5) * slotW, golden = b.lucky || SLOTS[rewardSlot].kind === 'egg';
    slotGlow[slot] = 1; lucky = false;
    if (!quiet) {
      burst(cx, slotTop + 20, golden ? '#ffd75e' : '#5fe0b0', golden ? 40 : 18, golden ? 340 : 260);
      if (!reduced()) { shake = golden ? 1 : .45; flash = golden ? 1 : .4; }
    }
    if (staleLayout) layout();
    onLand?.(rewardSlot, b.lucky, { x: cx, y: slotTop }, quiet);
    // Every completed play deals a fresh cabinet: peg routes and physical reward
    // holes both move, while rewardSlot keeps the visual and paid prize identical.
    shuffleSeed++; slotOrder = shuffledPachinkatSlots(shuffleSeed, slotOrder); layout();
  }

  // `quiet` fast-forwards a ball off screen: no sounds, haptics or sparks.
  function step(dt, quiet = false) {
    for (const pin of pins) { pin.glow = Math.max(0, pin.glow - dt * 3); pin.pop = Math.max(0, (pin.pop || 0) - dt * 6); }
    shake = Math.max(0, shake - dt * 2.5); flash = Math.max(0, flash - dt * 2);
    for (let i = 0; i < slotGlow.length; i++) slotGlow[i] = Math.max(0, slotGlow[i] - dt * .9);
    for (const s of sparks) { s.age += dt; s.vy += 700 * dt; s.x += s.vx * dt; s.y += s.vy * dt; }
    sparks = sparks.filter(s => s.age < s.life);
    if (!ball) return;
    const b = ball, t = dt * SPEED * (!quiet && nearEgg(b) ? .4 : 1);
    b.age += dt; b.squash = Math.max(0, b.squash - dt * 8); b.rot += b.vx * t / ballR;
    b.vy = Math.min(b.vy + GRAVITY * t, TERMINAL); b.x += b.vx * t; b.y += b.vy * t;
    b.vx *= Math.exp(-.25 * t);
    if (b.x < left + ballR) { b.x = left + ballR; b.vx = Math.abs(b.vx) * .6; }
    if (b.x > right - ballR) { b.x = right - ballR; b.vx = -Math.abs(b.vx) * .6; }
    for (const pin of pins) {
      const dx = b.x - pin.x, dy = b.y - pin.y, d = Math.hypot(dx, dy), min = ballR + pin.r;
      if (d >= min || d === 0) continue;
      const nx = dx / d, ny = dy / d; b.x = pin.x + nx * min; b.y = pin.y + ny * min;
      const along = b.vx * nx + b.vy * ny;
      if (along < 0) {
        b.vx -= 1.45 * along * nx; b.vy -= 1.45 * along * ny; b.vy = Math.max(b.vy, -260);
        // A small nudge keeps balls from balancing on top of a pin.
        if (Math.abs(nx) < .2) b.vx += (Math.random() < .5 ? -1 : 1) * 70;
        b.vx = Math.max(-260, Math.min(260, b.vx));
        if (pin.glow < .4 && !quiet) {
          b.hits++; onTick?.(); onHit?.(b.hits);
          if (!reduced()) {
            for (let k = 0; k < 3; k++) sparks.push({ x: pin.x + nx * pin.r, y: pin.y + ny * pin.r, vx: nx * 120 + (Math.random() - .5) * 90, vy: ny * 120 - 60, age: 0, life: .3, color: pin.tone[1], size: 2 + Math.random() * 2 });
          }
        }
        pin.glow = 1; pin.pop = 1; b.squash = 1;
      }
    }
    // Dividers are rounded posts: a ball touching the top cap rolls off to a side.
    for (const wall of dividers) {
      const cy = Math.max(wall.y1, Math.min(wall.y2, b.y)), dx = b.x - wall.x, dy = b.y - cy, d = Math.hypot(dx, dy), min = ballR + 2.5;
      if (d >= min) continue;
      const nx = d > .01 ? dx / d : (Math.random() < .5 ? -1 : 1), ny = d > .01 ? dy / d : 0;
      b.x = wall.x + nx * min; b.y = cy + ny * min;
      const along = b.vx * nx + b.vy * ny;
      if (along < 0) { b.vx -= 1.4 * along * nx; b.vy -= 1.4 * along * ny; }
      if (Math.abs(nx) < .35) b.vx += (nx < 0 ? -1 : 1) * 90;
    }
    // Safety net: a ball that stops reaching new low points (speed alone misses a ball
    // that jitters in place) gets a kick; after three kicks, or MAX_FALL, it lands.
    if (b.y > b.low + 1) { b.low = b.y; b.stall = 0; }
    else if ((b.stall += dt) > STALL) {
      b.stall = 0; b.kicks++;
      b.vx = (b.x < left + slotW ? 1 : b.x > right - slotW ? -1 : Math.random() < .5 ? -1 : 1) * 150; b.vy = -140;
    }
    if (!quiet && !reduced()) { b.trail.unshift({ x: b.x, y: b.y }); if (b.trail.length > 10) b.trail.pop(); }
    if (b.y > slotTop || b.age > MAX_FALL || b.kicks > 2) land(quiet);
  }

  function goldBall(x, y, r, alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha;
    if (diamondArt?.complete && diamondArt.naturalWidth) {
      ctx.drawImage(diamondArt, x - r * 1.22, y - r * 1.22, r * 2.44, r * 2.44);
      ctx.restore(); return;
    }
    const g = ctx.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r);
    g.addColorStop(0, '#fffbe2'); g.addColorStop(.35, '#ffd75e'); g.addColorStop(1, '#c9821c');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(x - r * .32, y - r * .38, r * .28, r * .18, -.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(137,79,24,.48)';
    for (const [dx, dy] of [[-.3,-.2],[-.1,-.34],[.14,-.32],[.32,-.16]]) { ctx.beginPath(); ctx.arc(x+r*dx,y+r*dy,r*.09,0,Math.PI*2); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(x,y+r*.16,r*.28,r*.22,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
  function egg(x, y, s) {
    if(boxArt?.complete&&boxArt.naturalWidth){ctx.drawImage(boxArt,x-s*1.18,y-s*.96,s*2.36,s*1.9);return;}
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#f37782'; ctx.strokeStyle = '#a83f58'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(-s * .82, -s * .62, s * 1.64, s * 1.3, s * .18); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd75e'; ctx.fillRect(-s * .14, -s * .62, s * .28, s * 1.3); ctx.fillRect(-s * .82, -s * .15, s * 1.64, s * .28);
    ctx.strokeStyle = '#ffd75e'; ctx.lineWidth = s * .18;
    ctx.beginPath(); ctx.arc(-s * .2, -s * .72, s * .24, Math.PI * .08, Math.PI * 1.05); ctx.stroke();
    ctx.beginPath(); ctx.arc(s * .2, -s * .72, s * .24, Math.PI * -.05, Math.PI * .92); ctx.stroke();
    ctx.restore();
  }
  function render(time) {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - .5) * 10 * shake, (Math.random() - .5) * 8 * shake);
    // Light beams rise from a slot that just paid.
    for (let i = 0; i < SLOTS.length; i++) if (slotGlow[i] > 0 && !reduced()) {
      const x = left + i * slotW, beam = ctx.createLinearGradient(0, slotTop, 0, 0);
      beam.addColorStop(0, `rgba(255,215,94,${slotGlow[i] * .55})`); beam.addColorStop(1, 'rgba(255,215,94,0)');
      ctx.fillStyle = beam; ctx.fillRect(x + 2, 0, slotW - 4, slotTop);
    }
    // While the ball nears a slot that holds an egg, a spotlight builds suspense.
    if (ball && !reduced() && ball.y > slotTop - 5 * ballR) {
      const slot = Math.max(0, Math.min(SLOTS.length - 1, Math.floor((ball.x - left) / slotW)));
      if (lucky || SLOTS[slot].kind === 'egg') {
        const g = ctx.createRadialGradient(left + (slot + .5) * slotW, slotTop + 30, 4, left + (slot + .5) * slotW, slotTop + 30, slotW * 1.6);
        g.addColorStop(0, 'rgba(255,230,140,.55)'); g.addColorStop(1, 'rgba(255,230,140,0)'); ctx.fillStyle = g; ctx.fillRect(0, slotTop - slotW * 2, W, H);
      }
    }
    for (let i = 0; i < SLOTS.length; i++) {
      const x = left + i * slotW, slot = lucky ? { kind: 'egg' } : SLOTS[slotOrder[i]], isEgg = slot.kind === 'egg';
      ctx.fillStyle = isEgg ? '#ffe7a8' : i % 2 ? '#e3f6ee' : '#fbe0e1';
      ctx.beginPath();ctx.roundRect(x + 2, slotTop + 3, slotW - 4, H - slotTop - 8, 10);ctx.fill();
      if (slotGlow[i] > 0) { ctx.fillStyle = `rgba(255,215,94,${slotGlow[i] * .8})`;ctx.beginPath();ctx.roundRect(x + 2, slotTop + 3, slotW - 4, H - slotTop - 8, 10);ctx.fill(); }
      const cx = x + slotW / 2, cy = slotTop + (H - slotTop) * .42;
      if (isEgg) egg(cx, cy, Math.min(13, slotW * .32));
      else {
        ctx.fillStyle='rgba(85,56,47,.16)';ctx.beginPath();ctx.ellipse(cx,cy-10,6,4.5,0,0,Math.PI*2);ctx.fill();
        for(const [dx,dy] of [[-5,-16],[-1,-18],[4,-17]]){ctx.beginPath();ctx.arc(cx+dx,cy+dy,2,0,Math.PI*2);ctx.fill();}
        ctx.fillStyle = '#2f6f62'; ctx.font = `800 ${Math.round(Math.min(17, slotW * .4))}px ui-rounded, system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(slot.amount), cx, cy);
      }
      ctx.fillStyle = isEgg ? '#9a6a1d' : '#4c8a7c'; ctx.font = `700 ${Math.round(Math.min(10, slotW * .22))}px ui-rounded, system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.fillText(isEgg ? 'box' : 'treats', cx, H - 16);
    }
    ctx.fillStyle = '#b98769';
    for (const wall of dividers) {ctx.beginPath();ctx.roundRect(wall.x-2.5,wall.y1,5,wall.y2-wall.y1,3);ctx.fill();ctx.beginPath();ctx.arc(wall.x,wall.y1,3.2,0,Math.PI*2);ctx.fill();}
    // Paw pegs flash gold when hit. Their collision remains the same circle.
    for (const pin of pins) {
      if (pin.glow > 0 && !reduced()) { ctx.fillStyle = `rgba(255,215,94,${pin.glow * .6})`; ctx.beginPath(); ctx.arc(pin.x, pin.y, pin.r * 2.6, 0, Math.PI * 2); ctx.fill(); }
      const [light, deep] = pin.glow > .2 ? ['#fff4c2', '#e9a531'] : pin.tone, r = pin.r * (1 + (reduced() ? 0 : Math.sin((1 - (pin.pop || 0)) * Math.PI) * .45 * (pin.pop || 0)));
      ctx.save();ctx.translate(pin.x,pin.y);
      ctx.fillStyle='rgba(91,56,44,.18)';ctx.beginPath();ctx.ellipse(0,r*.3,r*1.08,r*.88,0,0,Math.PI*2);ctx.fill();
      const g = ctx.createLinearGradient(0,-r,0,r);g.addColorStop(0,light);g.addColorStop(1,deep);ctx.fillStyle=g;
      ctx.beginPath();ctx.ellipse(0,r*.28,r*.78,r*.64,0,0,Math.PI*2);ctx.fill();
      for(const [dx,dy] of [[-.62,-.45],[-.2,-.7],[.28,-.68],[.66,-.38]]){ctx.beginPath();ctx.arc(r*dx,r*dy,r*.27,0,Math.PI*2);ctx.fill();}
      ctx.fillStyle='rgba(255,255,255,.58)';ctx.beginPath();ctx.ellipse(-r*.22,-r*.05,r*.22,r*.13,-.4,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    if (armed && !ball) {
      const x = aimPosition(), bob = reduced() ? 0 : Math.sin(time * 5) * 2;
      ctx.strokeStyle = 'rgba(201,155,99,.45)'; ctx.setLineDash([4, 6]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, 44); ctx.lineTo(x, 66); ctx.stroke(); ctx.setLineDash([]);
      goldBall(x, 30 + bob, ballR);
    }
    if (ball) {
      ball.trail.forEach((q, i) => goldBall(q.x, q.y, ballR * (1 - i / 12), .25 * (1 - i / 10)));
      const squash = reduced() ? 0 : ball.squash * .18;
      ctx.save(); ctx.translate(ball.x, ball.y); ctx.scale(1 + squash, 1 - squash); goldBall(0, 0, ballR);
      ctx.restore();
    }
    for (const s of sparks) {
      ctx.save(); ctx.globalAlpha = 1 - s.age / s.life; ctx.fillStyle = s.color; ctx.translate(s.x, s.y); ctx.rotate(s.age * 8);
      ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? s.size * .45 : s.size, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.fill(); ctx.restore();
    }
    ctx.restore();
    if (flash > 0 && !reduced()) { ctx.fillStyle = `rgba(255,248,214,${flash * .35})`; ctx.fillRect(0, 0, W, H); }
  }
  function frame(stamp) {
    if (!visible) { raf = 0; return; }
    const dt = last ? Math.min(.1, (stamp - last) / 1000) : 0; last = stamp;
    for (acc += dt; acc >= STEP; acc -= STEP) step(STEP);
    render(stamp / 1000);
    raf = requestAnimationFrame(frame);
  }
  // A ball still falling when the board is left finishes at once, quietly: its golden
  // ball is already spent, so it pays now rather than when (or if) the board is seen again.
  function settle() { for (let i = 0; ball && i <= MAX_FALL / STEP + 1; i++) step(STEP, true); }
  // Never rebuild the board under a falling ball: the new size waits for the landing.
  function relayout() { if (ball) staleLayout = true; else layout(); }
  function setLayout(style){layoutStyle=Math.max(0,Math.min(2,Number(style)||0));shuffleSeed++;slotOrder=shuffledPachinkatSlots(shuffleSeed,slotOrder);relayout();if(visible&&!ball)render(performance.now()/1000);}
  function show() { visible = true; relayout(); last = 0; acc = 0; if (!raf) raf = requestAnimationFrame(frame); }
  function hide() { visible = false; settle(); }
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => { if (!visible) return; relayout(); if (!ball) render(performance.now() / 1000); }).observe(canvas);
  // iOS stops animation frames in the background and may close the page there.
  document.addEventListener('visibilitychange', () => { if (document.hidden) settle(); });
  addEventListener('pagehide', settle);
  return { show, hide, layout: relayout, setLayout, settle, arm, disarm, drop, isBusy: () => !!ball, isArmed: () => armed };
}
