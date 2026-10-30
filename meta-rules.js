// Rules for the café meta layer: café coins as the soft currency, Cat Diamonds,
// the pachinko prizes, surprise boxes and the shop. Pure functions only, so the
// numbers can be tuned and tested without a browser.
export const META_KEY = 'meow-munchies-meta-v1';

export const RARITIES = {
  comun: { label: 'Common', weight: 60, duplicate: 10 },
  rara: { label: 'Rare', weight: 28, duplicate: 25 },
  epica: { label: 'Epic', weight: 10, duplicate: 60 },
  legendaria: { label: 'Legendary', weight: 2, duplicate: 150 },
};
// Saved IDs stay stable for existing players, while the collection is now a cast of café cats.
export const DRAGONS = [
  { id: 'menta', name: 'Minty', rarity: 'comun' },
  { id: 'fresa', name: 'Berry', rarity: 'comun' },
  { id: 'mandarina', name: 'Tangerine', rarity: 'comun' },
  { id: 'limon', name: 'Lemon Drop', rarity: 'comun' },
  { id: 'arandano', name: 'Bluebell', rarity: 'comun' },
  { id: 'pistacho', name: 'Pistachio', rarity: 'comun' },
  { id: 'chicle', name: 'Bubblegum', rarity: 'rara' },
  { id: 'regaliz', name: 'Licorice', rarity: 'rara' },
  { id: 'caramelo', name: 'Caramel', rarity: 'rara' },
  { id: 'cereza', name: 'Cherry', rarity: 'epica' },
  { id: 'algodon', name: 'Cotton Candy', rarity: 'epica' },
  { id: 'dorado', name: 'Golden Whiskers', rarity: 'legendaria' },
].map(cat => ({ ...cat, art: `assets/meow-munchies/cats/${cat.id}.png` }));

export const PRICES = { golden: 60, goldenPack: 150, life: 50, hint: 40, undo: 20 };
export const PACHINKO_LAYOUT_PRICE = 20;
export const PACHINKO_LAYOUTS = 3;
export const SHOP = [
  { id: 'goldenPack', title: 'Diamond Trio', detail: 'Three drops at a café discount', price: PRICES.goldenPack, gives: { golden: 3 } },
  { id: 'golden', title: 'Diamond', detail: 'One Pachinkat drop', price: PRICES.golden, gives: { golden: 1 } },
  { id: 'life', title: 'Restore Lives', detail: 'Restore all lives', price: PRICES.life, gives: { life: 'all' } },
  { id: 'hint', title: 'Meow Hints', detail: 'Get 10 hints', price: PRICES.hint, gives: { hint: 10 } },
  { id: 'undo', title: 'Undo Pack', detail: 'Get 5 Undos', price: PRICES.undo, gives: { undo: 5 } },
];

// Slots under the pachinko, left to right. Eggs sit off-centre so they are
// reachable but not the most common landing.
export const SLOTS = [
  { kind: 'balls', amount: 25 },
  { kind: 'egg' },
  { kind: 'balls', amount: 5 },
  { kind: 'balls', amount: 10 },
  { kind: 'balls', amount: 5 },
  { kind: 'egg' },
  { kind: 'balls', amount: 25 },
];
// After this many drops without an egg, the next drop is a lucky one.
export const PITY_DROPS = 4;
export const WELCOME = { balls: 50, golden: 1 };
export const DAILY_GIFT = { balls: 15 };
export const GREEN_BALL_COIN_VALUE = 2;
export const FIRST_WIN_BONUS = 5;

const int = (value, max = 99999) => Number.isSafeInteger(value) ? Math.max(0, Math.min(value, max)) : 0;
const isDayKey = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
};

export function normalizeMeta(saved) {
  const base = { version: 1, balls: 0, golden: 0, eggs: 0, dragons: {}, goldenLevels: [], paidLevels: [], dryDrops: 0, lastGift: '', giftStreak: 0, welcomed: false, fresh: [], dropping: false, pachinkoLayout: 0 };
  if (saved?.version !== 1) return base;
  const dragons = {};
  for (const dragon of DRAGONS) { const n = int(saved.dragons?.[dragon.id], 999); if (n) dragons[dragon.id] = n; }
  const levels = list => [...new Set((Array.isArray(list) ? list : []).filter(n => Number.isInteger(n) && n > 0 && n <= 600))].sort((a, b) => a - b);
  const lastGift = typeof saved.lastGift === 'string' ? saved.lastGift.slice(0, 10) : '';
  return {
    version: 1,
    balls: int(saved.balls), golden: int(saved.golden, 999), eggs: int(saved.eggs, 999), dragons,
    goldenLevels: levels(saved.goldenLevels), paidLevels: levels(saved.paidLevels),
    dryDrops: int(saved.dryDrops, 99), lastGift: isDayKey(lastGift) ? lastGift : '',
    giftStreak: Math.min(7, int(saved.giftStreak, 7)),
    welcomed: saved.welcomed === true,
    fresh: (Array.isArray(saved.fresh) ? saved.fresh : []).filter(id => dragons[id]),
    dropping: saved.dropping === true,
    pachinkoLayout: int(saved.pachinkoLayout, PACHINKO_LAYOUTS - 1),
  };
}

export function changePachinkoLayout(meta) {
  if (meta.balls < PACHINKO_LAYOUT_PRICE || meta.dropping) return null;
  return { ...meta, balls: meta.balls - PACHINKO_LAYOUT_PRICE, pachinkoLayout: (meta.pachinkoLayout + 1) % PACHINKO_LAYOUTS };
}

export function welcome(meta) {
  if (meta.welcomed) return meta;
  return { ...meta, welcomed: true, balls: meta.balls + WELCOME.balls, golden: meta.golden + WELCOME.golden };
}

// The golden ball is a plain ball whose colour the order never asks for, so
// capturing it (or not) cannot change the order or whether the level is solvable.
// It prefers a ball the authored solution already eats, and is the same every time.
export function goldenBallFor(level) {
  if (!level || level.kind !== 'campaign' || !level.goal?.colors) return null;
  const wanted = new Set(Object.keys(level.goal.colors));
  const candidates = level.pegs.filter(peg => !peg.type && !wanted.has(peg.color)).map(peg => peg.id).sort();
  if (!candidates.length) return null;
  const eaten = new Set();
  if (Array.isArray(level.solution)) {
    const at = new Map(level.pegs.map(peg => [peg.id, peg.id]));
    for (const move of level.solution) {
      const origin = at.get(move.over), mover = at.get(move.from);
      if (origin) eaten.add(origin);
      at.delete(move.over); at.delete(move.from);
      if (mover) at.set(move.to, mover);
    }
  }
  const preferred = candidates.filter(id => eaten.has(id));
  const pool = preferred.length ? preferred : candidates;
  return pool[level.id % pool.length];
}
export function withGoldenBall(level, pegs) {
  const golden = goldenBallFor(level);
  return golden ? pegs.map(peg => peg.id === golden ? { ...peg, golden: true } : peg) : pegs;
}

// A missing flag alone is not a capture: the mode may have been enabled after
// this attempt began. Recovery keeps/restores the same marked snapshots.
export function goldenWasEaten(pegs, history) {
  return !pegs.some(peg => peg.golden) && history.some(snapshot => snapshot.some(peg => peg.golden));
}

// Paid once, when the order is complete: balls for every ball the dragon ate,
// a bonus the first time a level is won, and the golden ball the first time it is eaten.
export function levelReward(meta, { levelId, eaten, goldenEaten }) {
  const firstWin = !meta.paidLevels.includes(levelId);
  const balls = int(eaten, 99) * GREEN_BALL_COIN_VALUE + (firstWin ? FIRST_WIN_BONUS : 0);
  const golden = goldenEaten && !meta.goldenLevels.includes(levelId) ? 1 : 0;
  return { balls, golden, firstWin };
}
export function applyLevelReward(meta, levelId, reward) {
  return {
    ...meta,
    balls: meta.balls + reward.balls,
    golden: meta.golden + reward.golden,
    paidLevels: reward.firstWin ? [...meta.paidLevels, levelId].sort((a, b) => a - b) : meta.paidLevels,
    goldenLevels: reward.golden ? [...meta.goldenLevels, levelId].sort((a, b) => a - b) : meta.goldenLevels,
  };
}

export function canBuy(meta, item) { return meta.balls >= item.price; }
export function buy(meta, itemId) {
  const item = SHOP.find(entry => entry.id === itemId);
  if (!item || !canBuy(meta, item)) return { meta, item: null };
  return { meta: { ...meta, balls: meta.balls - item.price, golden: meta.golden + (item.gives.golden || 0) }, item };
}

export const isLuckyDrop = meta => meta.dryDrops >= PITY_DROPS;
// The golden ball is spent when it is dropped; `dropping` stays saved until its prize
// is paid, so a page closed mid-fall can give the ball back (see recoverDrop).
export function startDrop(meta) {
  if (meta.golden < 1 || meta.dropping) return null;
  return { meta: { ...meta, golden: meta.golden - 1, dropping: true }, lucky: isLuckyDrop(meta) };
}
export function slotPrize(slotIndex, lucky) {
  const slot = SLOTS[Math.max(0, Math.min(SLOTS.length - 1, slotIndex))];
  return lucky ? { kind: 'egg' } : slot;
}
export function applyPrize(meta, prize) {
  if (prize.kind === 'egg') return { ...meta, eggs: meta.eggs + 1, dryDrops: 0, dropping: false };
  return { ...meta, balls: meta.balls + prize.amount, dryDrops: meta.dryDrops + 1, dropping: false };
}
// A golden ball still saved as falling means the page closed before it landed: give it back.
export function recoverDrop(meta) {
  return meta.dropping ? { ...meta, golden: Math.min(999, meta.golden + 1), dropping: false } : meta;
}

// Two numbers in [0,1): the first picks the rarity, the second the dragon.
export function rollDragon(rarityRoll, pickRoll) {
  const total = Object.values(RARITIES).reduce((sum, r) => sum + r.weight, 0);
  let cursor = rarityRoll * total, rarity = 'comun';
  for (const [key, value] of Object.entries(RARITIES)) { if (cursor < value.weight) { rarity = key; break; } cursor -= value.weight; }
  const pool = DRAGONS.filter(dragon => dragon.rarity === rarity);
  return pool[Math.min(pool.length - 1, Math.floor(pickRoll * pool.length))];
}
export function hatch(meta, rarityRoll, pickRoll) {
  if (meta.eggs < 1) return null;
  const dragon = rollDragon(rarityRoll, pickRoll), owned = meta.dragons[dragon.id] || 0;
  const refund = owned ? RARITIES[dragon.rarity].duplicate : 0;
  return {
    dragon, duplicate: owned > 0, refund,
    meta: { ...meta, eggs: meta.eggs - 1, balls: meta.balls + refund,
      dragons: { ...meta.dragons, [dragon.id]: owned + 1 },
      fresh: owned ? meta.fresh : [...meta.fresh, dragon.id] },
  };
}

export const dayKey = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
export const giftReady = (meta, now) => {
  const today = dayKey(now);
  return isDayKey(today) && (!isDayKey(meta.lastGift) || today > meta.lastGift);
};
// A week of daily gifts that grows each consecutive day; missing a day starts again at day 1.
export const GIFT_LADDER = [
  { balls: 15 }, { balls: 20 }, { balls: 25 }, { balls: 30 }, { balls: 40 }, { balls: 50 }, { balls: 30, golden: 5 },
];
const yesterday = now => { const d = new Date(now || Date.now()); d.setDate(d.getDate() - 1); return dayKey(d); };
// Day (1-7) that the next claim pays.
export function giftDay(meta, now) {
  if (meta.lastGift === dayKey(now)) return meta.giftStreak || 1; // already claimed: today's day
  if (meta.lastGift === yesterday(now)) return meta.giftStreak % GIFT_LADDER.length + 1;
  return 1;
}
export function claimGift(meta, now) {
  if (!giftReady(meta, now)) return meta;
  const day = giftDay(meta, now), gift = GIFT_LADDER[day - 1];
  return { ...meta, lastGift: dayKey(now), giftStreak: day, balls: meta.balls + gift.balls, golden: meta.golden + (gift.golden || 0) };
}
export const collected = meta => DRAGONS.filter(dragon => meta.dragons[dragon.id]).length;
