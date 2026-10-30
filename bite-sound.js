// "Crunchy bite" by fvcalderan, CC0: https://opengameart.org/content/crunchy-bite
// Converted from the original Ogg to MP3 for iPhone Safari compatibility.
import { CHOMP, MUNCH, PARTY_BEATS } from './dragon-animation.js';

let biteData;
const loadBiteData = () => biteData ||= fetch(new URL('./assets/crunchy-bite.mp3', import.meta.url))
  .then(response => {
    if (!response.ok) throw new Error(`Bite sound: ${response.status}`);
    return response.arrayBuffer();
  })
  .catch(() => null);

// Ways the dragon can eat. Each one replays the same crunch with its own pitch,
// timing and layering, so consecutive bites never sound identical.
// rate: playback speed, offset/length: seconds of the sample, then optional
// extra crunches and a soft gulp after the bite.
export const BITE_VARIANTS = [
  { name: 'crunch', rate: 1.02 },
  { name: 'crispy', rate: 1.14, length: .26 },
  { name: 'chomp', rate: .9, volume: 1 },
  { name: 'double', rate: 1.06, length: .14, echo: { delay: .1, rate: .97, volume: .7 } },
  { name: 'gulp', rate: 1.08, length: .2, gulp: { delay: .17 } },
  { name: 'nibble', rate: 1.2, offset: .03, length: .12, echo: { delay: .08, rate: 1.26, volume: .55, length: .1 } },
];

// A soft munch when the dragon's jaw closes again after the chomp (dragon-animation.js).
export const CHEWS = [{ delay: CHOMP + MUNCH, rate: .82, volume: .22, offset: .04, length: .07 }];
// The bite that completes the order: a big chomp with a second crunch, two "mmm"
// munches while the dragon crouches, and a gulp as it leaps for joy.
export const FEAST = { rate: .88, volume: 1, echo: { delay: .11, rate: 1.02, volume: .6, length: .14 }, chews: [.22, .31], gulp: PARTY_BEATS[0] };

// Picks a variant at random but never the same one twice in a row.
export function nextBiteVariant(previous, random = Math.random) {
  const choices = BITE_VARIANTS.map((_, index) => index).filter(index => index !== previous);
  return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
}

export function createBiteSound(ctx) {
  let sample = null;
  loadBiteData().then(data => {
    if (data) ctx.decodeAudioData(data.slice(0)).then(buffer => { sample = buffer; }, () => {});
  });

  const active = new Set(), chewing = new Set();
  let lastBite = -Infinity, lastVariant = -1;

  function track(node, gain) {
    active.add(node);
    node.onended = () => { active.delete(node); chewing.delete(node); node.disconnect(); gain.disconnect(); };
  }
  function crunch(at, rate, volume, offset = 0, length = 0) {
    const source = ctx.createBufferSource(), gain = ctx.createGain();
    source.buffer = sample; source.playbackRate.value = rate;
    const duration = (length || sample.duration - offset) / rate;
    gain.gain.setValueAtTime(.0001, at);
    gain.gain.linearRampToValueAtTime(volume, at + .008);
    gain.gain.setValueAtTime(volume, at + Math.min(.17, duration * .6));
    gain.gain.linearRampToValueAtTime(.0001, at + duration);
    source.connect(gain).connect(ctx.destination);
    track(source, gain);
    if (length) source.start(at, offset, length); else source.start(at, offset);
    return source;
  }
  function gulp(at) {
    const oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(260, at);
    oscillator.frequency.exponentialRampToValueAtTime(120, at + .13);
    gain.gain.setValueAtTime(.0001, at);
    gain.gain.linearRampToValueAtTime(.16, at + .02);
    gain.gain.exponentialRampToValueAtTime(.0001, at + .15);
    oscillator.connect(gain).connect(ctx.destination);
    track(oscillator, gain);
    oscillator.start(at); oscillator.stop(at + .16);
  }

  // kind: 'dragon' | 'feast' (the order's last bite) | 'logo'. munch: false while more
  // food is in the air, because the dragon keeps its mouth open for it.
  function play(kind = 'dragon', streak = 1, munch = true) {
    if (ctx.state !== 'running') return false;
    const at = ctx.currentTime;
    const repeated = at - lastBite < .11;
    lastBite = at;
    // A new bite cuts the munches still scheduled for the previous one.
    for (const source of chewing) { try { source.stop(); } catch {} }
    chewing.clear();

    if (sample) {
      const lift = Math.min(streak - 1, 4) * .025, volume = repeated ? .68 : .95;
      if (kind === 'logo') { crunch(at, .96 + lift, volume); return true; }
      const detune = 1 + (Math.random() - .5) * .06;
      if (kind === 'feast') {
        crunch(at, FEAST.rate * detune, FEAST.volume);
        crunch(at + FEAST.echo.delay, FEAST.echo.rate * detune, FEAST.echo.volume, 0, FEAST.echo.length);
        FEAST.chews.forEach((delay, i) => chewing.add(crunch(at + delay, (.84 - i * .03) * detune, .24 - i * .05, .04, .07)));
        gulp(at + FEAST.gulp);
        return true;
      }
      lastVariant = nextBiteVariant(lastVariant);
      const variant = BITE_VARIANTS[lastVariant];
      crunch(at, variant.rate * detune + lift, Math.min(1, volume * (variant.volume || 1)), variant.offset, variant.length);
      if (variant.echo) crunch(at + variant.echo.delay, variant.echo.rate * detune + lift, volume * variant.echo.volume, 0, variant.echo.length || variant.length);
      if (variant.gulp) gulp(at + variant.gulp.delay);
      if (munch) for (const chew of CHEWS) chewing.add(crunch(at + chew.delay, chew.rate * detune, chew.volume, chew.offset, chew.length));
      return true;
    }

    // A short fallback for the first tap if the file is still decoding.
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(270, at);
    oscillator.frequency.exponentialRampToValueAtTime(95, at + .16);
    gain.gain.setValueAtTime(.0001, at);
    gain.gain.linearRampToValueAtTime(.14, at + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, at + .18);
    oscillator.connect(gain).connect(ctx.destination);
    track(oscillator, gain);
    oscillator.start(at); oscillator.stop(at + .19);
    return true;
  }

  function stop() {
    for (const source of active) { try { source.stop(); } catch {} }
    active.clear(); chewing.clear();
  }

  return { play, stop };
}
