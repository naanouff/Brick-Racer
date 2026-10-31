/**
 * @file gen-mairie-layers.mjs
 * @description Generate mairie.layers.json socle + statue stub (FC4).
 * Usage: node scripts/brick/gen-mairie-layers.mjs
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const W = 24;
const D = 12;
const FZ = D - 1;
/**
 * H=24P: 1 plate base + 1 plate trim + 3 brick plinth (9) + 1 plate white top
 * + 1 tile plaque band equiv via brick face + statue ~10P in ops/layers
 * Budget: base 1 + sand body 3 brick (9) + white cap plate 1 + statue brick courses 4 (12) + trim plates 1
 * = 1+9+1+12+1 = 24.
 */

const empty = () => Array.from({ length: D }, () => Array.from({ length: W }, () => '.'));
const paint = (grid, x, z, ch) => {
  if (z >= 0 && z < D && x >= 0 && x < W) grid[z][x] = ch;
};
const fillRect = (g, x0, z0, x1, z1, ch) => {
  for (let z = z0; z < z1; z++) {
    for (let x = x0; x < x1; x++) paint(g, x, z, ch);
  }
};
const rowsOf = (grid) => grid.map((r) => r.join(''));

const layers = [];

// Dark gray base plate full footprint
{
  const g = empty();
  fillRect(g, 0, 0, W, D, 'D');
  layers.push({ kind: 'plate', rows: rowsOf(g) });
}

// White bottom bevel (inset)
{
  const g = empty();
  fillRect(g, 1, 1, W - 1, D - 1, 'W');
  layers.push({ kind: 'plate', rows: rowsOf(g) });
}

// Sand plinth solid (3 brick courses) with MAIRIE plaque on face
for (let c = 0; c < 3; c++) {
  const g = empty();
  fillRect(g, 2, 2, W - 2, D - 2, 'S');
  // front face plaque area
  if (c === 1) {
    for (let x = 7; x <= 16; x++) paint(g, x, FZ - 1, 'W');
  }
  if (c === 1) {
    // black letter bars
    for (let x = 8; x <= 15; x += 2) paint(g, x, FZ - 1, 'K');
  }
  layers.push({ kind: 'brick', rows: rowsOf(g) });
}

// White top platform
{
  const g = empty();
  fillRect(g, 3, 3, W - 3, D - 3, 'W');
  layers.push({ kind: 'plate', rows: rowsOf(g) });
}

// Headless statue (brick courses) centered — no head
const CX = 11;
const CZ = 5;
for (let c = 0; c < 4; c++) {
  const g = empty();
  if (c === 0) {
    // legs: black left / red right (viewer)
    paint(g, CX, CZ, 'K');
    paint(g, CX + 1, CZ, 'R');
  } else if (c === 1) {
    // hips / lower torso
    paint(g, CX, CZ, 'K');
    paint(g, CX + 1, CZ, 'R');
    paint(g, CX - 1, CZ, 'Y');
    paint(g, CX + 2, CZ, 'Y');
  } else if (c === 2) {
    // torso yellow + scarf
    paint(g, CX, CZ, 'Y');
    paint(g, CX + 1, CZ, 'Y');
    paint(g, CX - 1, CZ, 'R');
    paint(g, CX + 2, CZ, 'W');
    paint(g, CX, CZ - 1, 'Y');
    paint(g, CX + 1, CZ + 1, 'Y');
  } else {
    // shoulders / neck stump (no head)
    paint(g, CX, CZ, 'Y');
    paint(g, CX + 1, CZ, 'Y');
    paint(g, CX - 1, CZ, 'Y');
    paint(g, CX + 2, CZ, 'Y');
    paint(g, CX, CZ - 1, 'D'); // broken neck hint
  }
  layers.push({ kind: 'brick', rows: rowsOf(g) });
}

const doc = {
  id: 'landmark.mairie',
  version: 1,
  title: 'Mairie — socle + statue tête manquante (24×12 × 24P)',
  footprint: [W, D],
  legend: {
    S: 'sand',
    W: 'white',
    D: 'dark_gray',
    K: 'black',
    R: 'red',
    Y: 'yellow',
  },
  options: {
    runningBond: false,
    capTiles: false,
  },
  layers,
  ops: [],
  notes: 'Plaque MAIRIE: tuiles blanches + barres ; print ultérieur. Statue sans tête (FC4).',
};

const out = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../src/racer/hub/brick/layers/mairie.layers.json'
);
writeFileSync(out, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
console.log(`[gen-mairie] ${out} · ${layers.length} layers`);
