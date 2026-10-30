export const LIVES_KEY = 'meow-munchies-lives-v1';
export const MAX_LIVES = 5;
export const LIFE_RECHARGE_MS = 30 * 60 * 1000;

// An absolute deadline lets lives recharge while the game is closed.
export function normalizeLives(saved, now = Date.now()) {
  if (saved?.version !== 1) return { version: 1, count: MAX_LIVES, nextAt: 0 };
  let count = Number.isInteger(saved.count) ? Math.max(0, Math.min(MAX_LIVES, saved.count)) : MAX_LIVES;
  let nextAt = Number.isSafeInteger(saved.nextAt) && saved.nextAt > 0 ? saved.nextAt : now + LIFE_RECHARGE_MS;
  if (count === MAX_LIVES) return { version: 1, count, nextAt: 0 };
  if (nextAt <= now) {
    const recovered = Math.floor((now - nextAt) / LIFE_RECHARGE_MS) + 1;
    count = Math.min(MAX_LIVES, count + recovered);
    nextAt = count === MAX_LIVES ? 0 : nextAt + recovered * LIFE_RECHARGE_MS;
  }
  return { version: 1, count, nextAt };
}

export function spendLife(saved, now = Date.now()) {
  const lives = normalizeLives(saved, now);
  if (!lives.count) return lives;
  return { ...lives, count: lives.count - 1, nextAt: lives.nextAt || now + LIFE_RECHARGE_MS };
}

export function grantLife(saved, now = Date.now()) {
  const lives = normalizeLives(saved, now);
  const count = Math.min(MAX_LIVES, lives.count + 1);
  return { ...lives, count, nextAt: count === MAX_LIVES ? 0 : lives.nextAt };
}

export function lifeCountdown(lives, now = Date.now()) {
  const seconds = Math.max(0, Math.ceil((lives.nextAt - now) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
