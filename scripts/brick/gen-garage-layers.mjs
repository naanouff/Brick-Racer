/**
 * @file gen-garage-layers.mjs
 * @description Generate garage.layers.json (FC1 shell + FC2 details).
 * Usage: node scripts/brick/gen-garage-layers.mjs
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const W = 24;
const D = 24;
/** Door height in brick courses (~21P ≈ 20P). */
const DOOR_H = 7;
const DOOR_W = 8;
const DOOR_X0 = Math.floor((W - DOOR_W) / 2); // 8
const DOOR_X1 = DOOR_X0 + DOOR_W; // 16

/**
 * Height 42P:
 * 1 plate floor + 7 door + 1 lintel + 3 tile sign + 4 wall + 2 plate roof
 * = 1 + 21 + 3 + 3 + 12 + 2 = 42.
 */
const WALL_AFTER_SIGN = 4;

const empty = () => Array.from({ length: D }, () => Array.from({ length: W }, () => '.'));
const paint = (grid, x, z, ch) => {
  if (z >= 0 && z < D && x >= 0 && x < W) grid[z][x] = ch;
};
const rowsOf = (grid) => grid.map((r) => r.join(''));

function wallRing(ch, { doorCourse = false } = {}) {
  const g = empty();
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      const edge = z === 0 || z === D - 1 || x === 0 || x === W - 1;
      if (!edge) continue;
      const onDoorFace = z === D - 1 && x >= DOOR_X0 && x < DOOR_X1;
      if (doorCourse && onDoorFace) continue;
      paint(g, x, z, ch);
    }
  }
  return g;
}

const layers = [];

// Floor + oil stains (black) near door
{
  const g = empty();
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) paint(g, x, z, 'D');
  }
  const oil = [
    [10, D - 2],
    [11, D - 2],
    [12, D - 3],
    [13, D - 2],
    [14, D - 3],
    [9, D - 3],
    [15, D - 2],
    [2, D - 1],
    [3, D - 2],
    [20, D - 1],
    [21, D - 2],
  ];
  for (const [x, z] of oil) paint(g, x, z, 'K');
  layers.push({ kind: 'plate', rows: rowsOf(g) });
}

// Door courses + plinth / stripes
for (let c = 0; c < DOOR_H; c++) {
  let body = 'T';
  if (c === 0) body = 'D';
  if (c === 6) body = 'D'; // mid stripe start
  const g = wallRing(body, { doorCourse: true });
  paint(g, DOOR_X0 - 1, D - 1, 'Y');
  paint(g, DOOR_X1, D - 1, 'Y');
  // oil / grime at base corners on face
  if (c === 0) {
    paint(g, 1, D - 1, 'K');
    paint(g, 2, D - 1, 'K');
    paint(g, W - 2, D - 1, 'K');
    paint(g, W - 3, D - 1, 'K');
    paint(g, 0, D - 2, 'K');
    paint(g, W - 1, D - 2, 'K');
  }
  layers.push({ kind: 'brick', rows: rowsOf(g) });
}

// Yellow lintel
{
  const g = wallRing('T', { doorCourse: false });
  for (let x = DOOR_X0 - 1; x <= DOOR_X1; x++) paint(g, x, D - 1, 'Y');
  layers.push({ kind: 'brick', rows: rowsOf(g) });
}

// Sign: 3 tile plates — white field + black letter bars (print later)
for (let t = 0; t < 3; t++) {
  const g = wallRing('T', { doorCourse: false });
  for (let x = DOOR_X0 - 1; x <= DOOR_X1; x++) paint(g, x, D - 1, 'W');
  // crude letter bars for « ON JUGERA TON BUILD » silhouette
  if (t === 1) {
    for (let x = DOOR_X0; x < DOOR_X1; x += 2) paint(g, x, D - 1, 'K');
  }
  layers.push({ kind: 'tile', rows: rowsOf(g) });
}

// Upper wall + gray band near top
for (let c = 0; c < WALL_AFTER_SIGN; c++) {
  let body = 'T';
  if (c >= WALL_AFTER_SIGN - 2) body = 'D';
  layers.push({ kind: 'brick', rows: rowsOf(wallRing(body, { doorCourse: false })) });
}

// Roof deck + parapet
{
  const deck = empty();
  for (let z = 1; z < D - 1; z++) {
    for (let x = 1; x < W - 1; x++) paint(deck, x, z, 'D');
  }
  layers.push({ kind: 'plate', rows: rowsOf(deck) });
  layers.push({ kind: 'plate', rows: rowsOf(wallRing('D', { doorCourse: false })) });
}

const doc = {
  id: 'landmark.garage',
  version: 1,
  title: 'Garage Bolt — ON JUGERA TON BUILD (24×24 × 42P)',
  footprint: [W, D],
  legend: {
    T: 'terracotta',
    D: 'dark_gray',
    Y: 'yellow',
    W: 'white',
    K: 'black',
  },
  options: {
    runningBond: true,
    capTiles: false,
  },
  layers,
  ops: [],
  notes: 'Enseigne: tuiles blanches + barres noires ; print lettres ultérieur (FC2).',
};

const out = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../src/racer/hub/brick/layers/garage.layers.json'
);
writeFileSync(out, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
console.log(`[gen-garage] ${out} · ${layers.length} layers`);
