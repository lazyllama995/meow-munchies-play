/** Classic 33-hole peg solitaire. Jump orthogonally over one adjacent ball. */
export const SIZE = 7;

const DIRECTIONS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const COLORS = ['mint', 'pink', 'orange'];
const authoredHints = new WeakMap();

/** Stones are fixed supports. Shells travel with their ball and need two hits. */
export const isMovable = peg => !!peg && peg.type !== 'stone';
export const pegHardness = peg => peg?.type === 'stone' ? Infinity
  : peg?.type === 'shell' ? (peg.durability ?? 2) : 1;
export const jumpEffect = peg => pegHardness(peg) === Infinity ? 'stone'
  : pegHardness(peg) > 1 ? 'crack' : 'capture';

/** Color and remaining shell strength both matter to orders and hint caches. */
export const puzzleKey = pegs => pegs.map(peg => `${peg.id}:${peg.color}:${peg.type || 'ball'}:${pegHardness(peg)}`).sort().join('|');
const ALL_CELLS = Object.freeze(Array.from({ length: SIZE * SIZE }, (_, index) => {
  const x = index % SIZE;
  const y = Math.floor(index / SIZE);
  return Object.freeze({ id: `${x},${y}`, x, y });
}).filter(({ x, y }) => (x >= 2 && x <= 4) || (y >= 2 && y <= 4)));
const CLASSIC_IDS = new Set(ALL_CELLS.map(cell => cell.id));

function coordinates(id) {
  if (typeof id !== 'string' || !/^[0-6],[0-6]$/.test(id)) {
    throw new TypeError(`Invalid cell id: ${String(id)}.`);
  }
  return id.split(',').map(Number);
}

function occupancy(pegs, allowed = CLASSIC_IDS) {
  if (!Array.isArray(pegs)) throw new TypeError('Pegs must be an array.');
  const occupied = new Set();
  for (const peg of pegs) {
    coordinates(peg?.id);
    if (!allowed.has(peg.id)) throw new Error(`Peg ${peg.id} is outside this board.`);
    if (occupied.has(peg.id)) throw new Error(`Duplicate peg at ${peg.id}.`);
    if (peg.type !== undefined && !['shell', 'stone'].includes(peg.type)) throw new TypeError('Invalid peg type.');
    if (peg.type !== 'stone' && !COLORS.includes(peg.color)) throw new TypeError(`Invalid peg color: ${String(peg.color)}.`);
    if (peg.type === 'shell' && ![1, 2].includes(peg.durability ?? 2)) throw new TypeError('A shell needs one or two hits.');
    occupied.add(peg.id);
  }
  return occupied;
}

function boardCells(level) {
  if (!Array.isArray(level?.cells) || !level.cells.length) {
    throw new TypeError('A level needs at least one cell.');
  }
  const cells = new Set();
  for (const cell of level.cells) {
    const [x, y] = coordinates(cell?.id);
    if (cell.x !== x || cell.y !== y) throw new Error(`Cell coordinates do not match ${cell.id}.`);
    if (cells.has(cell.id)) throw new Error(`Duplicate board cell ${cell.id}.`);
    cells.add(cell.id);
  }
  return cells;
}

function boardMoves(cells) {
  const moves = [];
  for (const from of cells) {
    const [x, y] = coordinates(from);
    for (const [dx, dy] of DIRECTIONS) {
      const over = `${x + dx},${y + dy}`;
      const to = `${x + 2 * dx},${y + 2 * dy}`;
      if (cells.has(over) && cells.has(to)) moves.push({ from, over, to });
    }
  }
  return moves;
}

function validateState(level, pegs) {
  const cells = boardCells(level);
  const occupied = occupancy(pegs, cells);
  for (const id of occupied) {
    if (!cells.has(id)) throw new Error(`Peg ${id} is outside this board.`);
  }
  return { cells, occupied };
}

function keyFromIds(ids) {
  return [...ids].sort().join('|');
}

/** Stable rules key: normal decorative colors do not affect classic rules. */
export function positionKey(pegs) {
  const occupied = occupancy(pegs);
  const special = pegs.filter(peg => peg.type).map(peg => `${peg.id}:${peg.type}:${pegHardness(peg)}`).sort();
  return keyFromIds(occupied) + (special.length ? ';' + special.join('|') : '');
}

/** Return all legal orthogonal jumps without changing the level or its pegs. */
export function getMoves(level, pegs = level?.pegs) {
  const { cells, occupied } = validateState(level, pegs);
  const fixed = new Set(pegs.filter(peg => !isMovable(peg)).map(peg => peg.id));
  return boardMoves(cells).filter(move => occupied.has(move.from)
    && !fixed.has(move.from) && occupied.has(move.over) && !occupied.has(move.to));
}

/**
 * Apply a two-cell orthogonal jump and return fresh peg objects. The jumping
 * peg keeps its color. All three positions must belong to the supplied board.
 * Legacy callers without a level retain the classic 33-hole cross.
 */
export function applyMove(pegs, move, level = null) {
  const cells = level ? boardCells(level) : CLASSIC_IDS;
  const occupied = occupancy(pegs, cells);
  if (!move || typeof move !== 'object') throw new TypeError('A move is required.');
  const [fx, fy] = coordinates(move.from);
  const [ox, oy] = coordinates(move.over);
  const [tx, ty] = coordinates(move.to);
  if (![move.from, move.over, move.to].every(id => cells.has(id))) {
    throw new Error('A move cannot use a missing cell of this board.');
  }
  const straight = (Math.abs(tx - fx) === 2 && ty === fy)
    || (Math.abs(ty - fy) === 2 && tx === fx);
  if (!straight || ox !== (fx + tx) / 2 || oy !== (fy + ty) / 2) {
    throw new Error('A move must jump over one adjacent peg in a straight line.');
  }
  if (!occupied.has(move.from) || !occupied.has(move.over) || occupied.has(move.to)) {
    throw new Error('A move needs two pegs and an empty landing cell.');
  }
  if (!isMovable(pegs.find(peg => peg.id === move.from))) throw new Error('A stone cannot move.');
  const effect = jumpEffect(pegs.find(peg => peg.id === move.over));
  return pegs.filter(peg => peg.id !== move.over || effect !== 'capture').map(peg => ({
    ...peg, id: peg.id === move.from ? move.to : peg.id,
    ...(peg.id === move.over && effect === 'crack' ? {durability: 1} : {}),
  }));
}

function bit(id) {
  const [x, y] = coordinates(id);
  return 1n << BigInt(y * SIZE + x);
}

function maskFromIds(ids) {
  let mask = 0n;
  for (const id of ids) mask |= bit(id);
  return mask;
}

/**
 * Return a legal hint, or null if no move exists. Authored solution states use
 * their known winning continuation. Other states get a search capped at 512
 * positions and approximately 8 ms; if that budget is exhausted, the first
 * legal move is returned. An off-path hint is not a promise of solvability.
 */
export function getHint(level, pegs = level?.pegs) {
  const { cells, occupied } = validateState(level, pegs);
  // Campaigns use the color-aware solver. Keep this general hint safe for
  // custom practice boards too; the classic bitboard assumes every hit eats.
  if (pegs.some(peg => peg.type)) return getMoves(level, pegs)[0] || null;
  const moves = boardMoves(cells);
  const legal = moves.filter(move => occupied.has(move.from)
    && occupied.has(move.over) && !occupied.has(move.to));
  if (!legal.length) return null;
  const known = authoredHints.get(level);
  const canonical = known?.byKey.get(keyFromIds(occupied));
  if (canonical) return { ...canonical };

  const encoded = moves.map(move => ({
    move, from: bit(move.from), over: bit(move.over), to: bit(move.to),
  }));
  const initial = maskFromIds(occupied);
  const target = level.target ? bit(level.target) : null;
  const deadline = Date.now() + 8;
  const dead = new Set();
  let visited = 0;
  let exhausted = false;
  function canFinish(state) {
    if (state !== 0n && (state & (state - 1n)) === 0n) return target === null || state === target;
    if (known?.masks.has(state)) return true;
    if (++visited > 512 || Date.now() >= deadline) {
      exhausted = true;
      return false;
    }
    if (dead.has(state)) return false;
    for (const candidate of encoded) {
      if ((state & candidate.from) && (state & candidate.over) && !(state & candidate.to)) {
        if (canFinish(state ^ candidate.from ^ candidate.over ^ candidate.to)) return true;
        if (exhausted) return false;
      }
    }
    dead.add(state);
    return false;
  }
  for (const candidate of encoded) {
    if ((initial & candidate.from) && (initial & candidate.over) && !(initial & candidate.to)) {
      if (canFinish(initial ^ candidate.from ^ candidate.over ^ candidate.to)) return { ...candidate.move };
      if (exhausted) break;
    }
  }
  return { ...legal[0] };
}

/** Reverse the authored path from one peg, guaranteeing a solvable start. */
function createLevel(id, name, path, options = {}) {
  const solution = path.split(' ').map(step => {
    const [from, to] = step.split('>');
    const [fx, fy] = coordinates(from);
    const [tx, ty] = coordinates(to);
    const over = `${(fx + tx) / 2},${(fy + ty) / 2}`;
    coordinates(over);
    if (![from, over, to].every(cell => CLASSIC_IDS.has(cell))) {
      throw new Error(`Authored jump outside the classic board for level ${id}.`);
    }
    if (!((Math.abs(tx - fx) === 2 && ty === fy) || (Math.abs(ty - fy) === 2 && tx === fx))) {
      throw new Error(`Invalid authored jump for level ${id}.`);
    }
    return Object.freeze({ from, over, to });
  });
  const occupied = new Set([solution.at(-1).to]);
  for (const move of [...solution].reverse()) {
    if (!occupied.has(move.to) || occupied.has(move.from) || occupied.has(move.over)) {
      throw new Error(`Invalid reverse construction for level ${id}.`);
    }
    occupied.delete(move.to);
    occupied.add(move.from);
    occupied.add(move.over);
  }
  const pegs = Object.freeze([...occupied].sort().map((cell, index) => Object.freeze({
    id: cell, color: COLORS[(index + id - 1) % COLORS.length],
  })));
  const level = Object.freeze({ id, name, cells: ALL_CELLS, pegs, solution: Object.freeze(solution), ...options });
  const byKey = new Map();
  const masks = new Set();
  // Precompute all rotations and reflections too, so each of the four classic
  // opening directions has a known continuation without running a solver.
  for (let symmetry = 0; symmetry < 8; symmetry++) {
    const transform = id => {
      let [x, y] = coordinates(id);
      if (symmetry >= 4) x = SIZE - 1 - x;
      for (let turn = 0; turn < symmetry % 4; turn++) [x, y] = [SIZE - 1 - y, x];
      return `${x},${y}`;
    };
    let state = pegs.map(peg => ({ ...peg, id: transform(peg.id) }));
    for (const original of solution) {
      const move = Object.freeze({ from: transform(original.from), over: transform(original.over), to: transform(original.to) });
      const key = positionKey(state);
      if (!byKey.has(key)) byKey.set(key, move);
      masks.add(maskFromIds(state.map(peg => peg.id)));
      state = applyMove(state, move);
    }
    masks.add(maskFromIds(state.map(peg => peg.id)));
  }
  authoredHints.set(level, { byKey, masks });
  return level;
}

export const LEVELS = Object.freeze([
  createLevel(1, 'Solitario clásico', '3,1>3,3 1,2>3,2 2,0>2,2 4,0>2,0 1,4>1,2 4,2>4,0 6,2>4,2 5,4>5,2 6,4>6,2 2,3>2,1 2,0>2,2 2,5>2,3 2,3>2,1 0,2>2,2 0,4>0,2 3,2>1,2 0,2>2,2 2,1>2,3 4,3>4,1 4,0>4,2 2,3>4,3 4,3>4,1 6,2>4,2 4,1>4,3 3,4>5,4 4,6>4,4 2,6>4,6 4,3>4,5 4,6>4,4 5,4>3,4 3,5>3,3', { target: '3,3', kind: 'classic' }),
  createLevel(2, 'Práctica · Tres saltos', '1,2>3,2 3,2>3,4 3,4>5,4', { kind: 'practice' }),
  createLevel(3, 'Práctica · Seis bolas', '2,6>4,6 4,3>4,5 4,6>4,4 5,4>3,4 3,5>3,3', { kind: 'practice' }),
  createLevel(4, 'Práctica · Ocho bolas', '3,4>5,4 4,6>4,4 2,6>4,6 4,3>4,5 4,6>4,4 5,4>3,4 3,5>3,3', { kind: 'practice' }),
  createLevel(5, 'Práctica · Diez bolas', '6,2>4,2 4,1>4,3 3,4>5,4 4,6>4,4 2,6>4,6 4,3>4,5 4,6>4,4 5,4>3,4 3,5>3,3', { kind: 'practice' }),
]);
