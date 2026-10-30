const cached = new WeakMap();

// Hints compile each shared contour once, including its missing middle cells.
// Compact bit widths keep small chapter boards as cheap as the classic cross.
export function boardTopology(cells) {
  if (cached.has(cells)) return cached.get(cells);
  const bits = new Map(cells.map((cell, i) => [cell.id, 1n << BigInt(i)]));
  const moves = cells.flatMap(({id, x, y}) => [[1,0],[0,1],[-1,0],[0,-1]].flatMap(([dx,dy]) => {
    const over = `${x+dx},${y+dy}`, to = `${x+2*dx},${y+2*dy}`;
    return bits.has(over) && bits.has(to) ? [{from: id, over, to, f: bits.get(id), o: bits.get(over), t: bits.get(to)}] : [];
  }));
  const maskOf = pegs => pegs.reduce((mask, peg) => {
    const bit = bits.get(peg.id);
    if (bit === undefined) throw new Error(`Position ${peg.id} is outside this board.`);
    return mask | bit;
  }, 0n);
  const graph = {bits, moves, maskOf, width: cells.length};
  cached.set(cells, graph);
  return graph;
}
