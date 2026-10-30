import {searchOrder} from './order-search.js';
import data from './campaign-data.js';
import extendedData from './campaign-41-200-data.js';
import { MECHANIC_LEVELS } from './campaign-mechanics.js';
import { BOARD_LEVELS } from './campaign-board-data.js';
import { chapterBoard } from './board-shapes.js';
import { boardTopology } from './board-topology.js';
import { getMoves } from './game-rules.js';

export function clarifyAnyColorOrder(level) {
  if (!level.goal.any) return level;
  const counts = new Map();
  for (const peg of level.pegs) counts.set(peg.color, (counts.get(peg.color) || 0) + 1);
  const color = [...counts.keys()].reduce((best, candidate) => counts.get(candidate) > counts.get(best) ? candidate : best);
  return {
    ...level,
    goal: { colors: { [color]: level.goal.any } },
    pegs: level.pegs.map(peg => ({ ...peg, color })),
  };
}

export const CAMPAIGN = [...data,...extendedData].map(level => {
  const board = chapterBoard(Math.ceil(level.id / 10));
  return {...clarifyAnyColorOrder(level), ...MECHANIC_LEVELS[level.id], ...BOARD_LEVELS[level.id], boardShape: board.id, cells: board.cells};
});
const edibleCount = pegs => pegs.filter(peg => peg.type !== 'stone').length;
const count = (pegs, color) => pegs.filter(peg => peg.type !== 'stone' && peg.color === color).length;

export function goalProgress(level, pegs) {
  const goals = level.goal.any ? [['any', level.goal.any]] : Object.entries(level.goal.colors);
  return goals.map(([color, total]) => ({
    color, total,
    collected: Math.max(0, Math.min(total, color === 'any'
      ? edibleCount(level.pegs) - edibleCount(pegs) : count(level.pegs, color) - count(pegs, color))),
  }));
}
export const goalComplete = (level, pegs) => goalProgress(level, pegs).every(g => g.collected >= g.total);

export function normalizeProgress(value) {
  const completed = value?.version === 1 && Number.isInteger(value.completed)
    ? Math.max(0, Math.min(CAMPAIGN.length, value.completed)) : 0;
  return { version: 1, completed };
}
export function completeLevel(progress, index) {
  const current = normalizeProgress(progress);
  if (Number.isInteger(index) && index >= 0 && index <= current.completed && index < CAMPAIGN.length) {
    current.completed = Math.max(current.completed, index + 1);
  }
  return current;
}

const bitCount = mask => { let n=0; for (;mask;mask&=mask-1n)n++; return n; };

/** Color-aware, bounded search. A budget exit never claims a position is dead.
 * Runs in hint-worker.js in the browser so touch and rendering remain responsive. */
export function solveGoal(level, pegs, limit = 200000) {
  getMoves(level, pegs); // Validate board and current positions with the real rules.
  if (goalComplete(level, pegs)) return {status:'won', move:null, visited:0};
  if (pegs.some(peg => peg.type)) return searchOrder(level, pegs, {limit});
  const {maskOf, moves: allMoves, width} = boardTopology(level.cells);
  const colors = Object.keys(level.goal.colors || {});
  const allowed = colors.map(c => count(level.pegs,c) - level.goal.colors[c]);
  const initial = maskOf(pegs), targets = colors.map(c => maskOf(pegs.filter(p => p.color === c)));
  const dead = new Set(); let visited=0, exhausted=false;
  const key = (mask, ts) => ts.reduce((result,t,i) => result | (t << BigInt(width*(i+1))), mask);
  const won = (mask, ts) => level.goal.any
    ? level.pegs.length-bitCount(mask) >= level.goal.any
    : ts.every((t,i) => bitCount(t) <= allowed[i]);
  function search(mask, ts) {
    if (won(mask,ts)) return [];
    const k=key(mask,ts); if(dead.has(k))return null;
    if (++visited>limit) {exhausted=true;return null;}
    for (const m of allMoves) {
      if (!(mask&m.f) || !(mask&m.o) || (mask&m.t))continue;
      const nextTargets=ts.map(t => (t&~m.f&~m.o) | ((t&m.f)?m.t:0n));
      const tail=search(mask^m.f^m.o^m.t,nextTargets);
      if(tail)return [{from:m.from,over:m.over,to:m.to},...tail];
      if(exhausted)return null;
    }
    dead.add(k);return null;
  }
  const solution=search(initial,targets);
  return {status:solution?'found':exhausted?'budget':'dead', move:solution?.[0] || null, visited};
}
