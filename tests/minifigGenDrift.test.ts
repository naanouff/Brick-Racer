/**
 * @file minifigGenDrift.test.ts
 * @description Committed GPROC JSON matches gen:minifig builders (BRICK-MF2e).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildArmLGraph, buildArmRGraph } from '../scripts/minifig-gproc/parts/arm';
import { buildHandGraph } from '../scripts/minifig-gproc/parts/hand';
import { buildHatGraph } from '../scripts/minifig-gproc/parts/hat';
import { buildHeadGraph } from '../scripts/minifig-gproc/parts/head';
import { buildHipsGraph } from '../scripts/minifig-gproc/parts/hips';
import { buildLegLGraph, buildLegRGraph } from '../scripts/minifig-gproc/parts/leg';
import { buildTorsoGraph } from '../scripts/minifig-gproc/parts/torso';
import { buildWrenchGraph } from '../scripts/minifig-gproc/parts/wrench';
import type { GProcGraph } from '../scripts/minifig-gproc/graphBuilder';

const publicDir = resolve(__dirname, '../public/gproc');

const builders: Array<() => GProcGraph> = [
  buildHeadGraph,
  buildTorsoGraph,
  buildArmRGraph,
  buildArmLGraph,
  buildHandGraph,
  buildHipsGraph,
  buildLegRGraph,
  buildLegLGraph,
  buildHatGraph,
  buildWrenchGraph,
];

describe('minifig gen drift', () => {
  it('reproduces every committed minifig-*-generator.json', () => {
    for (const build of builders) {
      const generated = build();
      const path = resolve(publicDir, `${generated.id}.json`);
      const onDisk = JSON.parse(readFileSync(path, 'utf8')) as GProcGraph;
      expect(onDisk, generated.id).toEqual(generated);
    }
  });
});
