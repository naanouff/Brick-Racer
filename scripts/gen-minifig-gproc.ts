/**
 * @file gen-minifig-gproc.ts
 * @description Write public/gproc/minifig-*-generator.json (BRICK-MF2b).
 *
 * Run: pnpm gen:minifig
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildArmLGraph, buildArmRGraph } from './minifig-gproc/parts/arm.ts';
import { buildHandGraph } from './minifig-gproc/parts/hand.ts';
import { buildHatGraph } from './minifig-gproc/parts/hat.ts';
import { buildHeadGraph } from './minifig-gproc/parts/head.ts';
import { buildHipsGraph } from './minifig-gproc/parts/hips.ts';
import { buildLegLGraph, buildLegRGraph } from './minifig-gproc/parts/leg.ts';
import { buildTorsoGraph } from './minifig-gproc/parts/torso.ts';
import { buildWrenchGraph } from './minifig-gproc/parts/wrench.ts';
import type { GProcGraph } from './minifig-gproc/graphBuilder.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'public/gproc');

const graphs: GProcGraph[] = [
  buildHeadGraph(),
  buildTorsoGraph(),
  buildArmRGraph(),
  buildArmLGraph(),
  buildHandGraph(),
  buildHipsGraph(),
  buildLegRGraph(),
  buildLegLGraph(),
  buildHatGraph(),
  buildWrenchGraph(),
];

mkdirSync(outDir, { recursive: true });
for (const g of graphs) {
  const path = resolve(outDir, `${g.id}.json`);
  writeFileSync(path, `${JSON.stringify(g, null, 2)}\n`, 'utf8');
  console.log(`wrote ${path}`);
}
console.log(`gen:minifig — ${graphs.length} graphs`);
