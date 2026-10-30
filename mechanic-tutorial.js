export const MECHANIC_HELP = {
  shell: {
    title: 'A Wrapped Munchie!',
    copy: 'The first jump opens the wrapper and leaves the treat on its plate. The second serves it to Miso.',
    tip: 'The treat stays in place after the wrapper opens. Jump over it once more to serve it.',
    labels: ['Jump over it', 'Wrapper opened!', 'Jump again', 'Served to Miso!'],
  },
  stone: {
    title: 'A Ceramic Saucer!',
    copy: 'You can jump over it as many times as you want. The saucer always stays in place.',
    tip: 'It cannot move and does not count toward the order. Use it to reach other treats.',
    labels: ['Jump over it', 'The saucer stays', 'Jump back again', 'It remains a support'],
  },
};
export const MECHANIC_SEEN_KEY = 'meow-munchies-mechanics-v1';
export function readSeenMechanics(raw) {
  try {
    const saved = JSON.parse(raw);
    return new Set(saved?.version === 1 && Array.isArray(saved.seen)
      ? saved.seen.filter(name => Object.hasOwn(MECHANIC_HELP, name)) : []);
  } catch { return new Set(); }
}
export function unseenMechanics(pegs, seen) {
  return ['shell','stone'].filter(type => !seen.has(type) && pegs.some(peg => peg.type === type));
}
