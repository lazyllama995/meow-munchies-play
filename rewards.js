export const REWARDS_KEY = 'meow-munchies-rewards-v1';

const count = value => Number.isSafeInteger(value) ? Math.max(0, Math.min(value, 999)) : 0;
const chaptersFor = completed => Math.floor(count(completed) / 10);

export function normalizeRewards(saved, completed) {
  const chapters = chaptersFor(completed);
  if (saved?.version !== 1) return { version: 1, hints: 5 + chapters, undos: 10, awardedChapters: chapters };
  const awardedChapters = count(saved.awardedChapters);
  return {
    version: 1,
    hints: count(saved.hints) + Math.max(0, chapters - awardedChapters),
    undos: Number.isSafeInteger(saved.undos) ? count(saved.undos) : 10,
    awardedChapters: Math.max(chapters, awardedChapters),
  };
}

export function spendHint(rewards) {
  return rewards.hints > 0 ? { ...rewards, hints: rewards.hints - 1 } : rewards;
}

export function spendUndo(rewards) {
  return rewards.undos > 0 ? { ...rewards, undos: rewards.undos - 1 } : rewards;
}

export function grantUndo(rewards, amount = 1) {
  return { ...rewards, undos: count(rewards.undos + amount) };
}

export function grantVideoReward(rewards, kind) {
  return kind === 'hint' ? { ...rewards, hints: rewards.hints + 1 } : rewards;
}
