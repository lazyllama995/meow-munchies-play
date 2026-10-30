// Synthesised sound effects for moves, captures and rewards. Every cue is a
// short list of notes on one shared bus, tuned to C major so ball pops, order
// chips, chain stingers and the victory fanfare in music.js agree.
//
// Note: [from Hz, to Hz, seconds, volume, delay s, wave, attack s]
//   wave: 'sine' (default) | 'triangle' | 'noise' (band-passed hiss; from/to
//   glide the band centre, so it makes whooshes, crackles and risers).
// Level guide: a sine at .07 sits at the music bed (about -27 LUFS); keep each
// cue's simultaneous sum under .16 and sustained partials under 2.4 kHz
// (sparkles shorter than 60 ms may reach 3.2 kHz).
export const SFX = Object.freeze({
  // Touch and drag
  pick: [[440, 523, .06, .075], [1047, 1047, .05, .018, .012]],
  hover: [[1175, 1245, .03, .022]],
  invalid: [[262, 247, .07, .06, 0, 'triangle'], [196, 185, .12, .053, .07, 'triangle']],
  stoneTap: [[300, 180, .04, .095, 0, 'triangle'], [280, 170, .05, .07, .085, 'triangle']],
  // The jump
  takeoff: [[500, 1600, .16, .14, 0, 'noise', .07], [523, 784, .08, .05]],
  land: [[220, 110, .11, .11], [660, 440, .05, .035]],
  // What happens to the ball that is jumped over
  pop: [[392, 1047, .05, .12], [1047, 1047, .14, .05, .035], [2093, 2093, .05, .012, .04]],
  plop: [[392, 262, .08, .068, 0, 'triangle']],
  shellCrack: [[2600, 1400, .07, .087, 0, 'noise', .004], [740, 370, .06, .072, 0, 'triangle'], [3000, 1800, .03, .058, .045, 'noise', .003]],
  shellBreak: [[1800, 900, .09, .065, 0, 'noise', .004], [620, 310, .05, .04, .01, 'triangle']],
  stoneBump: [[392, 262, .05, .06, 0, 'triangle'], [150, 90, .09, .08]],
  // The order and the dragon
  collect: [[523, 523, .18, .068, 0, 'triangle'], [1047, 1047, .12, .024]],
  colorDone: [[784, 784, .1, .052], [1047, 1047, .38, .063, .08], [1319, 1319, .3, .029, .08], [2093, 2093, .16, .012, .08]],
  chain2: [[659, 659, .09, .058, .05], [784, 784, .14, .058, .11]],
  chain3: [[784, 784, .08, .058, .05], [880, 880, .08, .058, .1], [1047, 1047, .16, .058, .15]],
  chain4: [[880, 880, .08, .058, .05], [1047, 1047, .08, .058, .1], [1175, 1175, .08, .05, .15], [1319, 1319, .2, .058, .2]],
  chain5: [[1047, 1047, .07, .058, .05], [1175, 1175, .07, .05, .09], [1319, 1319, .07, .05, .13], [1568, 1568, .08, .05, .17], [2093, 2093, .26, .03, .21], [1047, 1047, .3, .045, .21, 'triangle']],
  orderDone: [[784, 784, .1, .075, .06, 'triangle'], [988, 988, .1, .075, .12, 'triangle'], [1175, 1175, .12, .075, .18, 'triangle'], [1568, 1568, .3, .052, .24], [900, 2600, .22, .075, .1, 'noise', .16]],
  finaleRise: [[350, 1800, .9, .06, 0, 'noise', .75], [392, 784, .9, .03, 0, 'triangle', .7]],
  // Shared with level transitions, the loss flow and the trial meta layer.
  crack: [[480, 160, .075, .11, 0, 'triangle'], [760, 280, .11, .055, 0, 'triangle']],
  jump: [[300, 820, .15, .07, 0, 'triangle'], [600, 1200, .1, .02, .03]],
  win: [[660, 880, .25, .09], [990, 1320, .3, .045]],
  heartbreak: [[523, 392, .16, .07], [392, 247, .34, .065]],
  tick: [[1180, 1320, .035, .025]],
  hit: [[660, 880, .05, .035]],
  jackpot: [[523, 1046, .18, .07], [659, 1318, .22, .05], [784, 1568, .3, .045]],
  coin: [[880, 1320, .12, .06], [1320, 1760, .12, .035]],
  egg: [[392, 784, .28, .08], [784, 1175, .34, .05]],
});

// When the bus is full, a cue may silence older cues of lower priority.
export const SFX_PRIORITY = Object.freeze({
  hover: 0, tick: 0, hit: 0,
  pick: 1, invalid: 1, stoneTap: 1, takeoff: 1, land: 1, plop: 1, stoneBump: 1, shellCrack: 1, shellBreak: 1, jump: 1, crack: 1,
  pop: 2, collect: 2, chain2: 2, chain3: 2, chain4: 2, chain5: 2, coin: 2,
  colorDone: 3, heartbreak: 3, egg: 3, jackpot: 3,
  orderDone: 4, finaleRise: 4, win: 4,
});
// Minimum seconds between two plays of the same cue (drag ticks, double taps).
export const SFX_GAP = Object.freeze({ hover: .05, pick: .04, invalid: .12, stoneTap: .15, tick: .02 });
// Thuds, whooshes and cracks vary a little each time; tuned notes never do.
const JITTER = new Set(['takeoff', 'land', 'plop', 'stoneBump', 'stoneTap', 'shellCrack', 'shellBreak', 'invalid']);
// The music dips under these, like it does under the bite.
export const SFX_DUCKS = new Set(['colorDone', 'orderDone']);

// Pink, mint and orange pop on C, E and G: a full order rings a major chord.
export const COLOR_STEP = Object.freeze({ pink: 0, mint: 4, orange: 7 });
const LADDER = [0, 2, 4, 7, 9];
// The order chip climbs a pentatonic ladder as it fills and lands on the octave.
export function collectStep(collected, total) {
  if (collected >= total) return 12;
  if (total <= 1 || collected <= 1) return 0;
  return LADDER[Math.round((collected - 1) * 4 / (total - 1))];
}
// Bite streaks 2-5 match the bite-combo-2..5 word art.
export const chainKind = streak => streak >= 2 ? `chain${Math.min(streak, 5)}` : null;

export const MAX_VOICES = 16;
const NOISE_GAIN = 3.2; // band-passed noise is quieter than a sine of the same peak

export function createSfx(ctx, { level = 1 } = {}) {
  const bus = ctx.createGain();
  bus.gain.value = level;
  bus.connect(ctx.destination);
  const voices = new Map(), last = Object.create(null);
  let noise = null;

  function noiseBuffer() {
    if (noise) return noise;
    noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * .5), ctx.sampleRate);
    const data = noise.getChannelData(0);
    let seed = 2463534242;
    for (let i = 0; i < data.length; i++) { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; data[i] = (seed >>> 0) / 2147483647.5 - 1; }
    return noise;
  }
  function silence(source, at) {
    const voice = voices.get(source);
    voices.delete(source);
    try { voice.gain.gain.cancelScheduledValues(at); voice.gain.gain.setTargetAtTime(.0001, at, .008); source.stop(at + .05); } catch {}
  }
  // Older, less important voices make room; a cue that cannot fit is skipped.
  function makeRoom(count, priority, at) {
    if (voices.size + count <= MAX_VOICES) return true;
    for (const [source, voice] of voices) {
      if (voices.size + count <= MAX_VOICES) break;
      if (voice.priority < priority) silence(source, at);
    }
    return voices.size + count <= MAX_VOICES || priority >= 4 && voices.size + count <= MAX_VOICES + 6;
  }
  function voice([from, to, duration, volume, wait = 0, wave = 'sine', attack], priority, shift, now) {
    const at = now + wait, gain = ctx.createGain();
    let source, band = null;
    if (wave === 'noise') {
      source = ctx.createBufferSource(); source.buffer = noiseBuffer(); source.loop = true;
      band = ctx.createBiquadFilter(); band.type = 'bandpass'; band.Q.value = 1.2;
      band.frequency.setValueAtTime(from, at); band.frequency.exponentialRampToValueAtTime(to, at + duration);
      source.connect(band).connect(gain); volume *= NOISE_GAIN;
    } else {
      source = ctx.createOscillator(); source.type = wave;
      source.frequency.setValueAtTime(from * shift, at);
      if (to !== from) source.frequency.exponentialRampToValueAtTime(to * shift, at + duration);
      source.connect(gain);
    }
    const rise = Math.min(attack ?? (wave === 'noise' ? duration * .4 : .006), duration * .8);
    gain.gain.setValueAtTime(.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + rise);
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    gain.connect(bus);
    voices.set(source, { priority, gain });
    source.onended = () => { voices.delete(source); source.disconnect(); band?.disconnect(); gain.disconnect(); };
    if (band) source.start(at, Math.random() * .4); else source.start(at);
    source.stop(at + duration + .02);
  }

  // step: semitones (colour, chip ladder, meta counters); delay: seconds.
  function play(kind = 'pick', step = 0, delay = 0) {
    if (ctx.state !== 'running') return false;
    const notes = SFX[kind] || SFX.pick, priority = SFX_PRIORITY[kind] ?? 1, now = ctx.currentTime + delay;
    if (now - (last[kind] ?? -Infinity) < (SFX_GAP[kind] || 0)) return false;
    if (!makeRoom(notes.length, priority, ctx.currentTime)) return false;
    last[kind] = now;
    const shift = 2 ** (Math.max(-12, Math.min(step, 16)) / 12) * (JITTER.has(kind) ? 1 + (Math.random() - .5) * .06 : 1);
    for (const note of notes) voice(note, priority, shift, now);
    return true;
  }
  function stop() {
    for (const source of voices.keys()) { try { source.stop(); } catch {} }
    voices.clear();
  }
  return { play, stop, get voices() { return voices.size; } };
}
