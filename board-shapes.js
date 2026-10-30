import { SIZE, LEVELS } from './game-rules.js';

// Every contour occupies the same 7 × 7 frame. Missing sockets never cause
// the remaining rows or columns to be stretched or packed closer together.
function contour(id, name, predicate) {
  const cells = Object.freeze(Array.from({length: SIZE * SIZE}, (_, n) => {
    const x = n % SIZE, y = Math.floor(n / SIZE);
    return Object.freeze({id: `${x},${y}`, x, y});
  }).filter(predicate));
  return Object.freeze({id, name, cells});
}
const pattern = (id, name, rows) => contour(id, name, ({x,y}) => rows[y][x] === '#');

export const BOARD_SHAPES = Object.freeze({
  cross: Object.freeze({id: 'cross', name: 'Cross', cells: LEVELS[0].cells}),
  diamond: contour('diamond', 'Diamond', ({x, y}) => Math.abs(x - 3) + Math.abs(y - 3) <= 3),
  hourglass: contour('hourglass', 'Reloj de arena', ({x, y}) => Math.abs(x - 3) <= Math.max(1, Math.abs(y - 3))),
  butterfly: pattern('butterfly', 'Mariposa', ['.#####.','#######','.#####.','..###..','.#####.','#######','.#####.']),
  oval: pattern('oval', 'Oval', ['..###..','.#####.','#######','#######','#######','.#####.','..###..']),
  balloon: pattern('balloon', 'Globo', ['..###..','.#####.','#######','#######','.#####.','..###..','..###..']),
  clover: pattern('clover', 'Clover', ['.##.##.','#######','#######','.#####.','#######','#######','.##.##.']),
  pinwheel: pattern('pinwheel', 'Molinillo', ['...###.','##.###.','#####..','#######','..#####','.###.##','.###...']),
  star: pattern('star', 'Estrella', ['...#...','.#####.','.#####.','#######','.#####.','.#####.','...#...']),
  crown: pattern('crown', 'Corona', ['##.#.##','#######','#######','#######','#######','.#####.','.#####.']),
});

export const CHAPTER_BOARDS = Object.freeze(['cross','diamond','hourglass','butterfly','oval','balloon','clover','pinwheel','star','crown']);

// Ten distinct contours for the first region. Unpublished regions keep their
// existing board; their saved progress and levels remain untouched.
export function chapterBoard(chapter) {
  return BOARD_SHAPES[CHAPTER_BOARDS[chapter - 1]] || BOARD_SHAPES.cross;
}
