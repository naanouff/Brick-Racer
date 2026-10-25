/**
 * @file minifigGprocAabb.test.ts
 * @description Per-part AABB vs dimensions + L/R symmetry (BRICK-MF2e).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  GDomain,
  GProcExecutor,
  bootstrapGProcRuntime,
  type GProcGraph,
  type GeometrySet,
} from '@naanouff/w3dts-gproc';
import {
  ARM,
  HAND,
  HEAD,
  HIPS,
  LEG,
  NECK,
  TORSO,
  shoulderLateralX,
} from '../src/racer/minifig/dimensions';
import { registerMinifigGprocNodes } from '../src/racer/minifig/registerMinifigGprocNodes';
import { isW3dtsMonoAvailable } from '../w3dtsMonoAliases';

const publicDir = resolve(__dirname, '../public');

function readGraph(file: string): GProcGraph {
  return JSON.parse(readFileSync(resolve(publicDir, 'gproc', file), 'utf8')) as GProcGraph;
}

function aabbSize(geo: GeometrySet): [number, number, number] {
  const posAttr = geo.getAttribute(GDomain.Point, 'position');
  if (!posAttr) throw new Error('no position attribute');
  const data = posAttr.materialize();
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  for (let i = 0; i + 2 < data.length; i += 3) {
    const x = data[i]!;
    const y = data[i + 1]!;
    const z = data[i + 2]!;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }
  return [maxX - minX, maxY - minY, maxZ - minZ];
}

function execSize(file: string): [number, number, number] {
  const graph = readGraph(file);
  const result = GProcExecutor.executeDetailed(graph, {});
  expect(result.ok, `${file}: ${JSON.stringify(result.errors)}`).toBe(true);
  expect(result.geometry, file).toBeTruthy();
  return aabbSize(result.geometry!);
}

describe.skipIf(!isW3dtsMonoAvailable())('minifig gproc AABB', () => {
  beforeAll(() => {
    bootstrapGProcRuntime();
    registerMinifigGprocNodes();
  });

  it('head height matches HEAD barrel + stud (tolerance)', () => {
    const [, h] = execSize('minifig-head-generator.json');
    const expected = HEAD.height + HEAD.studHeight;
    expect(h).toBeGreaterThan(expected * 0.85);
    expect(h).toBeLessThan(expected * 1.25);
    expect(h).toBeGreaterThan(HEAD.radius * 1.5);
  });

  it('torso matches TORSO cotes (tiny bevel must not change the silhouette)', () => {
    const [w, h, d] = execSize('minifig-torso-generator.json');
    expect(d).toBeCloseTo(TORSO.depth, 2);
    expect(w).toBeCloseTo(Math.max(TORSO.widthBottom, 2 * shoulderLateralX()), 2);
    expect(h).toBeGreaterThan(TORSO.height);
    expect(h).toBeLessThan(TORSO.height + NECK.height);
  });

  it('hips span near HIPS.width', () => {
    const [w] = execSize('minifig-hips-generator.json');
    expect(w).toBeGreaterThan(HIPS.width * 0.85);
    expect(w).toBeLessThan(HIPS.width * 1.35);
  });

  it('leg height near thigh + foot', () => {
    const [, h] = execSize('minifig-leg-r-generator.json');
    const expected = LEG.thighHeight + LEG.footHeight;
    expect(h).toBeGreaterThan(expected * 0.75);
    expect(h).toBeLessThan(expected * 1.35);
  });

  it('arm L/R are symmetric in AABB size', () => {
    const r = execSize('minifig-arm-r-generator.json');
    const l = execSize('minifig-arm-l-generator.json');
    for (let i = 0; i < 3; i++) {
      expect(Math.abs(r[i]! - l[i]!)).toBeLessThan(0.02);
    }
    expect(r[1]).toBeGreaterThan(ARM.upperLength * 0.6);
  });

  it.each([
    'minifig-head-generator.json',
    'minifig-torso-generator.json',
    'minifig-arm-r-generator.json',
    'minifig-arm-l-generator.json',
    'minifig-hand-generator.json',
    'minifig-hips-generator.json',
    'minifig-leg-r-generator.json',
    'minifig-leg-l-generator.json',
    'minifig-hat-generator.json',
    'minifig-wrench-generator.json',
  ])('%s vertex normals agree with triangle winding and face outward', (file) => {
    expect(windingAgreement(file)).toBeGreaterThan(0.98);
    expect(boundaryFacing(file).inward, file).toBe(0);
  });

  it.each([
    ['minifig-arm-r-generator.json', 1],
    ['minifig-arm-l-generator.json', -1],
  ] as const)('%s normals point out at the shoulder dome top and outer side', (file, side) => {
    const geo = execGeo(file);
    const p = geo.getAttribute(GDomain.Point, 'position')!.materialize();
    const n = geo.getAttribute(GDomain.Point, 'normal')!.materialize();
    let top = 0;
    let outer = 0;
    for (let i = 0; i < p.length; i += 3) {
      if (p[i + 1]! > p[top + 1]!) top = i;
      if (p[i]! * side > p[outer]! * side) outer = i;
    }
    expect(n[top + 1]!).toBeGreaterThan(0.9);
    expect(n[outer]! * side).toBeGreaterThan(0.9);
  });

  it('closed parts wind outward (positive volume close to the analytic one)', () => {
    const ring =
      Math.PI * (HAND.outerRadius ** 2 - HAND.innerRadius ** 2) * HAND.length;
    const hand = signedVolume('minifig-hand-generator.json');
    expect(hand).toBeGreaterThan(ring * 0.6);
    expect(hand).toBeLessThan(ring * 1.1);

    const barrel = Math.PI * HEAD.radius ** 2 * HEAD.height;
    const head = signedVolume('minifig-head-generator.json');
    expect(head).toBeGreaterThan(barrel * 0.7);
    expect(head).toBeLessThan(barrel * 1.1);
  });
});

function execGeo(file: string): GeometrySet {
  const result = GProcExecutor.executeDetailed(readGraph(file), {});
  expect(result.ok, `${file}: ${JSON.stringify(result.errors)}`).toBe(true);
  return result.geometry!;
}

/** Triangles lying flat on an AABB face must wind toward the outside of that face. */
function boundaryFacing(file: string): { outward: number; inward: number } {
  const geo = execGeo(file);
  const p = geo.getAttribute(GDomain.Point, 'position')!.materialize();
  const idx = geo.getAttribute(GDomain.Face, 'indices')!.materialize();
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3)
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k]!, p[i + k]!);
      hi[k] = Math.max(hi[k]!, p[i + k]!);
    }
  let outward = 0;
  let inward = 0;
  for (let t = 0; t + 2 < idx.length; t += 3) {
    const v = [idx[t]! * 3, idx[t + 1]! * 3, idx[t + 2]! * 3];
    const e1 = [0, 1, 2].map((k) => p[v[1]! + k]! - p[v[0]! + k]!);
    const e2 = [0, 1, 2].map((k) => p[v[2]! + k]! - p[v[0]! + k]!);
    const n = [
      e1[1]! * e2[2]! - e1[2]! * e2[1]!,
      e1[2]! * e2[0]! - e1[0]! * e2[2]!,
      e1[0]! * e2[1]! - e1[1]! * e2[0]!,
    ];
    for (let k = 0; k < 3; k++) {
      for (const [bound, sign] of [
        [lo[k]!, -1],
        [hi[k]!, 1],
      ] as const) {
        if (!v.every((o) => Math.abs(p[o + k]! - bound) < 1e-4)) continue;
        if (Math.abs(n[k]!) < 1e-12) continue;
        if (Math.sign(n[k]!) === sign) outward++;
        else inward++;
      }
    }
  }
  return { outward, inward };
}

/** Divergence-theorem volume; positive when triangles wind outward. */
function signedVolume(file: string): number {
  const geo = execGeo(file);
  const p = geo.getAttribute(GDomain.Point, 'position')!.materialize();
  const idx = geo.getAttribute(GDomain.Face, 'indices')!.materialize();
  let v = 0;
  for (let t = 0; t + 2 < idx.length; t += 3) {
    const [a, b, c] = [idx[t]! * 3, idx[t + 1]! * 3, idx[t + 2]! * 3];
    v +=
      p[a]! * (p[b + 1]! * p[c + 2]! - p[b + 2]! * p[c + 1]!) -
      p[a + 1]! * (p[b]! * p[c + 2]! - p[b + 2]! * p[c]!) +
      p[a + 2]! * (p[b]! * p[c + 1]! - p[b + 1]! * p[c]!);
  }
  return v / 6;
}

/** Fraction of triangles whose vertex normals point along the winding normal. */
function windingAgreement(file: string): number {
  const geo = execGeo(file);
  const p = geo.getAttribute(GDomain.Point, 'position')!.materialize();
  const n = geo.getAttribute(GDomain.Point, 'normal')!.materialize();
  const idx = geo.getAttribute(GDomain.Face, 'indices')!.materialize();
  let agree = 0;
  let total = 0;
  for (let t = 0; t + 2 < idx.length; t += 3) {
    const [a, b, c] = [idx[t]! * 3, idx[t + 1]! * 3, idx[t + 2]! * 3];
    const e1 = [p[b]! - p[a]!, p[b + 1]! - p[a + 1]!, p[b + 2]! - p[a + 2]!];
    const e2 = [p[c]! - p[a]!, p[c + 1]! - p[a + 1]!, p[c + 2]! - p[a + 2]!];
    const fx = e1[1]! * e2[2]! - e1[2]! * e2[1]!;
    const fy = e1[2]! * e2[0]! - e1[0]! * e2[2]!;
    const fz = e1[0]! * e2[1]! - e1[1]! * e2[0]!;
    if (Math.hypot(fx, fy, fz) < 1e-9) continue;
    const dot = fx * (n[a]! + n[b]! + n[c]!) + fy * (n[a + 1]! + n[b + 1]! + n[c + 1]!) + fz * (n[a + 2]! + n[b + 2]! + n[c + 2]!);
    total++;
    if (dot > 0) agree++;
  }
  return agree / total;
}
