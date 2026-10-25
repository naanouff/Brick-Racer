/**
 * @file minifigUnwrap.test.ts
 * @description UV unwrap + MeshMaps bake for minifig parts (BRICK-MF3a/b/e).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  GDomain,
  GProcExecutor,
  bootstrapGProcRuntime,
  type GProcGraph,
} from '@naanouff/w3dts-gproc';
import { MINIFIG_GPROC_GRAPHS } from '../src/racer/minifig/gprocGraphs';
import { registerMinifigGprocNodes } from '../src/racer/minifig/registerMinifigGprocNodes';
import { unwrapMinifigPart } from '../src/racer/minifig/unwrapPart';
import { isW3dtsMonoAvailable } from '../w3dtsMonoAliases';

const publicDir = resolve(__dirname, '../public');

function readPublic(url: string): string {
  return readFileSync(resolve(publicDir, url.replace(/^\//, '')), 'utf8');
}

describe('minifig unwrap + meshmaps', () => {
  it.skipIf(!isW3dtsMonoAvailable())('writes UV in [0,1] and color after bake for every part', () => {
    bootstrapGProcRuntime();
    registerMinifigGprocNodes();

    for (const ref of MINIFIG_GPROC_GRAPHS) {
      const graph = JSON.parse(readPublic(ref.url)) as GProcGraph;
      expect(
        graph.nodes.some((n) => n.type === 'UnwrapMinifigPart'),
        `${ref.id} unwrap`
      ).toBe(true);
      expect(
        graph.nodes.some((n) => n.type === 'BakeMeshMaps'),
        `${ref.id} bake`
      ).toBe(true);

      const result = GProcExecutor.executeDetailed(graph, {});
      expect(result.errors, `${ref.id}: ${JSON.stringify(result.errors)}`).toEqual([]);
      expect(result.ok, ref.id).toBe(true);
      const geo = result.geometry;
      expect(geo, ref.id).toBeTruthy();
      if (!geo) continue;

      const uv = geo.getAttribute(GDomain.Point, 'uv')?.materialize();
      const color = geo.getAttribute(GDomain.Point, 'color')?.materialize();
      expect(uv, `${ref.id} uv`).toBeTruthy();
      expect(color, `${ref.id} color`).toBeTruthy();
      if (!uv || !color) continue;

      for (let i = 0; i < uv.length; i++) {
        expect(Number.isFinite(uv[i]!), `${ref.id} uv finite`).toBe(true);
      }
      for (let i = 0; i < color.length; i++) {
        expect(Number.isFinite(color[i]!), `${ref.id} color finite`).toBe(true);
      }
    }
  });

  it.skipIf(!isW3dtsMonoAvailable())('sets mirrorU on left arm graph; head print U mirrors', () => {
    bootstrapGProcRuntime();
    registerMinifigGprocNodes();

    const leftArm = JSON.parse(readPublic('/gproc/minifig-arm-l-generator.json')) as GProcGraph;
    expect(
      leftArm.nodes.find((n) => n.type === 'UnwrapMinifigPart')?.properties?.mirrorU
    ).toBe(true);

    const headGraph = JSON.parse(readPublic('/gproc/minifig-head-generator.json')) as GProcGraph;
    const headGeo = GProcExecutor.executeDetailed(headGraph, {}).geometry;
    expect(headGeo).toBeTruthy();
    if (!headGeo) return;

    const uvA = unwrapMinifigPart(headGeo, 'minifig-head', { mirrorU: false })
      .getAttribute(GDomain.Point, 'uv')!
      .materialize();
    const uvB = unwrapMinifigPart(headGeo, 'minifig-head', { mirrorU: true })
      .getAttribute(GDomain.Point, 'uv')!
      .materialize();

    expect(uvA.length).toBe(uvB.length);
    let flipped = 0;
    for (let i = 0; i < uvA.length; i += 2) {
      if (Math.abs(uvA[i]! + uvB[i]!) < 1e-3) flipped += 1;
    }
    expect(flipped).toBe(uvA.length / 2);
  });

  it.skipIf(!isW3dtsMonoAvailable())('limbs use world-scaled UV (not a single parked texel)', () => {
    bootstrapGProcRuntime();
    registerMinifigGprocNodes();
    const armGraph = JSON.parse(readPublic('/gproc/minifig-arm-r-generator.json')) as GProcGraph;
    const geo = GProcExecutor.executeDetailed(armGraph, {}).geometry;
    expect(geo).toBeTruthy();
    if (!geo) return;
    const uv = unwrapMinifigPart(geo, 'minifig-arm-r', { mirrorU: false })
      .getAttribute(GDomain.Point, 'uv')!
      .materialize();
    const uSet = new Set<number>();
    for (let i = 0; i < uv.length; i += 2) uSet.add(Math.round(uv[i]! * 100));
    expect(uSet.size).toBeGreaterThan(8);
  });
});
