/**
 * @file minifigAssembleWorld.test.ts
 * @description Assembled figure in world space: feet on the ground, no part sunk into
 * the torso or hips (BRICK-MF2e).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mat4, quat, vec3 } from 'gl-matrix';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  GDomain,
  GProcExecutor,
  bootstrapGProcRuntime,
  type GProcGraph,
} from '@naanouff/w3dts-gproc';
import { assembleMinifigEntities, BOLT_RECIPE, MINIFIG_GPROC_GRAPHS } from '../src/racer/minifig';
import { registerMinifigGprocNodes } from '../src/racer/minifig/registerMinifigGprocNodes';
import {
  HIPS,
  TORSO,
  layoutY,
  torsoHalfDepthAt,
  torsoHalfWidthAt,
} from '../src/racer/minifig/dimensions';
import type { LevelEntity } from '../src/racer/levels/shared/levelTypes';
import { isW3dtsMonoAvailable } from '../w3dtsMonoAliases';

type Cloud = Float32Array;

const graphUrl = new Map(MINIFIG_GPROC_GRAPHS.map((g) => [g.id, g.url]));
const pointsByGraph = new Map<string, Cloud>();

function graphPoints(graphId: string): Cloud {
  let pts = pointsByGraph.get(graphId);
  if (!pts) {
    const url = graphUrl.get(graphId)!;
    const graph = JSON.parse(
      readFileSync(resolve(__dirname, '../public', url.slice(1)), 'utf8')
    ) as GProcGraph;
    const geo = GProcExecutor.executeDetailed(graph, {}).geometry!;
    pts = Float32Array.from(geo.getAttribute(GDomain.Point, 'position')!.materialize());
    pointsByGraph.set(graphId, pts);
  }
  return pts;
}

/** World-space vertices of every GPROC part, keyed by short part name. */
function worldParts(entities: LevelEntity[], rootId: string): Map<string, Cloud> {
  const byId = new Map(entities.map((e) => [e.id, e]));
  const worldOf = (id: string): mat4 => {
    const e = byId.get(id)!;
    const t = e.transform;
    const local = mat4.fromRotationTranslationScale(
      mat4.create(),
      quat.fromValues(t.rotation[0], t.rotation[1], t.rotation[2], t.rotation[3]),
      vec3.fromValues(t.position[0], t.position[1], t.position[2]),
      vec3.fromValues(t.scale[0], t.scale[1], t.scale[2])
    );
    return e.parentId ? mat4.multiply(mat4.create(), worldOf(e.parentId), local) : local;
  };

  const out = new Map<string, Cloud>();
  const v = vec3.create();
  for (const e of entities) {
    const g = e.components.find((c) => c.type === 'gproc');
    if (!g || g.type !== 'gproc') continue;
    const src = graphPoints(g.graphId);
    const W = worldOf(e.id);
    const dst = new Float32Array(src.length);
    for (let i = 0; i < src.length; i += 3) {
      vec3.transformMat4(v, vec3.fromValues(src[i]!, src[i + 1]!, src[i + 2]!), W);
      dst.set(v, i);
    }
    out.set(e.id.slice(rootId.length + '.part.'.length), dst);
  }
  return out;
}

function minAxis(c: Cloud, axis: number): number {
  let m = Infinity;
  for (let i = axis; i < c.length; i += 3) m = Math.min(m, c[i]!);
  return m;
}

function maxAxis(c: Cloud, axis: number): number {
  let m = -Infinity;
  for (let i = axis; i < c.length; i += 3) m = Math.max(m, c[i]!);
  return m;
}

const EPS = 0.01;
const y = layoutY();
const torsoTop = y.torsoBottom + TORSO.height;
const hipsBottom = y.hipsCenter - HIPS.height * 0.5;
const hipsTop = y.hipsCenter + HIPS.height * 0.5;

/** Strictly inside the torso trapezoid or the hips plate (shrunk by EPS). */
function insideBody(x: number, py: number, z: number): boolean {
  if (py > y.torsoBottom + EPS && py < torsoTop - EPS) {
    const f = (py - y.torsoBottom) / TORSO.height;
    if (Math.abs(x) < torsoHalfWidthAt(f) - EPS && Math.abs(z) < torsoHalfDepthAt(f) - EPS) {
      return true;
    }
  }
  return (
    py > hipsBottom + EPS &&
    py < hipsTop - EPS &&
    Math.abs(x) < HIPS.width * 0.5 - EPS &&
    Math.abs(z) < HIPS.depth * 0.5 - EPS
  );
}

function countInsideBody(c: Cloud): number {
  let n = 0;
  for (let i = 0; i < c.length; i += 3) if (insideBody(c[i]!, c[i + 1]!, c[i + 2]!)) n++;
  return n;
}

describe.skipIf(!isW3dtsMonoAvailable())('minifig assembled in world space', () => {
  let parts: Map<string, Cloud>;

  beforeAll(() => {
    bootstrapGProcRuntime();
    registerMinifigGprocNodes();
    const { entities, rootId } = assembleMinifigEntities(BOLT_RECIPE);
    parts = worldParts(entities, rootId);
  });

  it('stands on the ground (feet at y≈0)', () => {
    const lowest = Math.min(...[...parts.values()].map((c) => minAxis(c, 1)));
    expect(lowest).toBeGreaterThan(-0.005);
    expect(lowest).toBeLessThan(0.005);
  });

  it('legs end at the hips, not inside the torso', () => {
    for (const leg of ['leg.L', 'leg.R']) {
      expect(maxAxis(parts.get(leg)!, 1), leg).toBeLessThanOrEqual(hipsTop + EPS);
    }
  });

  it('reaches the target total height', () => {
    const top = Math.max(...[...parts.values()].map((c) => maxAxis(c, 1)));
    expect(top).toBeGreaterThan(y.totalHeight - 0.02);
    expect(top).toBeLessThan(2.2);
  });

  it('keeps arms and hands outside the torso and hips', () => {
    for (const name of ['arm.L', 'arm.R', 'hand.L', 'hand.R']) {
      const c = parts.get(name);
      expect(c, name).toBeTruthy();
      expect(countInsideBody(c!), name).toBe(0);
    }
  });

  it('keeps left and right sides mirrored', () => {
    for (const [l, r] of [
      ['arm.L', 'arm.R'],
      ['hand.L', 'hand.R'],
      ['leg.L', 'leg.R'],
    ] as const) {
      const a = parts.get(l)!;
      const b = parts.get(r)!;
      expect(minAxis(a, 0)).toBeCloseTo(-maxAxis(b, 0), 3);
      expect(minAxis(a, 1)).toBeCloseTo(minAxis(b, 1), 3);
    }
  });
});
