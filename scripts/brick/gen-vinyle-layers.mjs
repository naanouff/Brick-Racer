/**
 * @file gen-vinyle-layers.mjs
 * @description Generate vinyle.layers.json boutique shell (FC3).
 * Usage: node scripts/brick/gen-vinyle-layers.mjs
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const W = 18;
const D = 18;
/** Face = last row (+Z / Face camera). */
const FZ = D - 1;
/**
 * H=36P: 1 plate floor + 11 brick (33) + 2 plate roof = 36.
 * Lower shutter ~ courses 0–4 ; vitrine 5–8 ; enseigne 9–10.
 */
const COURSES = 11;
const WIN_X0 = 2;
const WIN_X1 = 16; // 14 studs wide display
const WIN_C0 = 5;
const WIN_C1 = 9; // exclusive

const empty = () => Array.from({ length: D }, () => Array.from({ length: W }, () => '.'));
const paint = (grid, x, z, ch) => {
  if (z >= 0 && z < D && x >= 0 && x < W) grid[z][x] = ch;
};
const rowsOf = (grid) => grid.map((r) => r.join(''));

function wallRing(ch, { openFace = null } = {}) {
  const g = empty();
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      const edge = z === 0 || z === D - 1 || x === 0 || x === W - 1;
      if (!edge) continue;
      if (
        openFace &&
        z === FZ &&
        x >= openFace.x0 &&
        x < openFace.x1
      ) {
        continue;
      }
      paint(g, x, z, ch);
    }
  }
  return g;
}

function weather(g, ch = 'D') {
  // Speckle side walls
  for (const z of [0, FZ]) {
    /* skip face weathering handled separately */
  }
  for (let z = 1; z < D - 1; z++) {
    if ((z + 3) % 5 === 0) {
      paint(g, 0, z, ch);
      paint(g, W - 1, z, 'K');
    }
    if ((z + 1) % 7 === 0) {
      paint(g, 0, z, 'K');
      paint(g, W - 1, z, ch);
    }
  }
  return g;
}

const layers = [];

// Floor
{
  const g = empty();
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) paint(g, x, z, 'G');
  }
  layers.push({ kind: 'plate', rows: rowsOf(g) });
}

for (let c = 0; c < COURSES; c++) {
  const inWindow = c >= WIN_C0 && c < WIN_C1;
  const inSign = c >= 9;
  let body = 'R';
  if (c === 4) body = 'K'; // black belt
  if (inSign) body = 'R';

  let g;
  if (c < 5) {
    // Lower: black shutter on face, red sides
    g = wallRing('R');
    for (let x = 0; x < W; x++) paint(g, x, FZ, 'K');
    // tiny cyan peepholes at base of shutter
    if (c === 1 || c === 2) {
      paint(g, 4, FZ, 'C');
      paint(g, 5, FZ, 'C');
      paint(g, 12, FZ, 'C');
      paint(g, 13, FZ, 'C');
    }
  } else if (inWindow) {
    g = wallRing('R', { openFace: { x0: WIN_X0, x1: WIN_X1 } });
    // cyan / clear glazing on face
    for (let x = WIN_X0; x < WIN_X1; x++) {
      const pane = (x - WIN_X0) % 4 < 3 ? 'C' : 'D'; // mullions
      paint(g, x, FZ, pane);
    }
    // merchandise one stud inside (tilted look = colored studs)
    const merch = ['K', 'Y', 'R', 'K', 'Y', 'R', 'K', 'Y'];
    for (let i = 0; i < merch.length; i++) {
      paint(g, WIN_X0 + 2 + i, FZ - 1, merch[i]);
    }
  } else if (inSign) {
    g = wallRing('R');
    for (let x = 1; x < W - 1; x++) paint(g, x, FZ, 'R');
    // white « BIENTÔT » strip under sign on course 9
    if (c === 9) {
      for (let x = 6; x <= 11; x++) paint(g, x, FZ, 'W');
    }
    // letter bars on course 10
    if (c === 10) {
      for (let x = 3; x < W - 3; x += 2) paint(g, x, FZ, 'W');
    }
  } else {
    g = wallRing(body);
  }
  weather(g);
  layers.push({ kind: 'brick', rows: rowsOf(g) });
}

// Roof
{
  const deck = empty();
  for (let z = 1; z < D - 1; z++) {
    for (let x = 1; x < W - 1; x++) paint(deck, x, z, 'G');
  }
  // chimney stub
  paint(deck, W - 4, 3, 'D');
  paint(deck, W - 3, 3, 'D');
  paint(deck, W - 4, 4, 'D');
  paint(deck, W - 3, 4, 'D');
  layers.push({ kind: 'plate', rows: rowsOf(deck) });
  layers.push({ kind: 'plate', rows: rowsOf(wallRing('G')) });
}

const doc = {
  id: 'landmark.vinyle',
  version: 1,
  title: 'Boutique Vinyle — BIENTÔT (18×18 × 36P)',
  footprint: [W, D],
  legend: {
    R: 'red',
    K: 'black',
    W: 'white',
    Y: 'yellow',
    C: 'cyan',
    G: 'gray',
    D: 'dark_gray',
  },
  options: {
    runningBond: true,
    capTiles: false,
  },
  layers,
  ops: [],
  notes: 'Enseigne VINYLE / BIENTÔT: barres blanches ; print ultérieur. Vitrine cyan.',
};

const out = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../src/racer/hub/brick/layers/vinyle.layers.json'
);
writeFileSync(out, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
console.log(`[gen-vinyle] ${out} · ${layers.length} layers`);
