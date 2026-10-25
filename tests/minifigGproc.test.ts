/**
 * @file minifigGproc.test.ts
 * @description Minifig GPROC graphs execute (BRICK-MF1b / MF2).
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GProcExecutor, bootstrapGProcRuntime, type GProcGraph } from '@naanouff/w3dts-gproc';
import { MINIFIG_GPROC_GRAPHS } from '../src/racer/minifig/gprocGraphs';
import { registerMinifigGprocNodes } from '../src/racer/minifig/registerMinifigGprocNodes';
import { buildMinifigLabSpec } from '../src/racer/levels/minifigLab';
import { isW3dtsMonoAvailable } from '../w3dtsMonoAliases';

const publicDir = resolve(__dirname, '../public');

function readPublic(url: string): string {
  return readFileSync(resolve(publicDir, url.replace(/^\//, '')), 'utf8');
}

describe('minifig gproc assets', () => {
  it('ships all minifig generator JSON files under public/gproc', () => {
    expect(MINIFIG_GPROC_GRAPHS.length).toBe(10);
    for (const ref of MINIFIG_GPROC_GRAPHS) {
      expect(existsSync(resolve(publicDir, ref.url.replace(/^\//, ''))), ref.id).toBe(true);
    }
  });

  it('wires minifig graphs into minifig-lab geometryGraphs', () => {
    const spec = buildMinifigLabSpec();
    const ids = new Set(spec.geometryGraphs.map((g) => g.id));
    expect(ids.has('minifig_head')).toBe(true);
    expect(ids.has('minifig_torso')).toBe(true);
    expect(ids.has('minifig_hips')).toBe(true);
    expect(ids.has('minifig_arm_l')).toBe(true);
    expect(ids.has('minifig_leg_r')).toBe(true);
  });

  it('uses an orbital camera in minifig-lab', () => {
    const spec = buildMinifigLabSpec();
    const cam = spec.entities.find((e) => e.id === 'MinifigLabCamera');
    const ctrl = cam?.components.find((c) => c.type === 'cameraController');
    expect(ctrl && ctrl.type === 'cameraController' && ctrl.mode).toBe('orbital');
    expect(
      ctrl && ctrl.type === 'cameraController' && ctrl.orbitalLeftMouseMode
    ).toBe('rotate');
  });

  it.skipIf(!isW3dtsMonoAvailable())('every minifig generator executes', () => {
    bootstrapGProcRuntime();
    registerMinifigGprocNodes();
    for (const ref of MINIFIG_GPROC_GRAPHS) {
      const graph = JSON.parse(readPublic(ref.url)) as GProcGraph;
      const result = GProcExecutor.executeDetailed(graph, {});
      expect(result.errors, `${ref.id}: ${JSON.stringify(result.errors)}`).toEqual([]);
      expect(result.ok, ref.id).toBe(true);
      expect(result.geometry, ref.id).toBeTruthy();
    }
  });
});
