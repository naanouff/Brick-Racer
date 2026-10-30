/**
 * @file ldrawGeometry.test.ts
 * @description CL2a: LDraw parse (type 1/3/4, cache, cycles) + game-space conversion.
 */

import { describe, expect, it } from 'vitest';
import { bakeLdrawAgingTexture, LDRAW_AGING_SIZE } from '../src/racer/hub/brick/ldraw/ldrawAgingBake';
import { P, S } from '../src/racer/hub/brick/brickUnits';
import {
  LdrawGeometryCache,
  buildLdrawPreviewGeometry,
  normalizeLdrawRef,
} from '../src/racer/hub/brick/ldraw/ldrawGeometry';

function reader(files: Record<string, string>) {
  const reads: string[] = [];
  const read = (ref: string): string | null => {
    reads.push(ref);
    return files[ref] ?? null;
  };
  return { read, reads };
}

describe('LdrawGeometryCache', () => {
  it('normalizes refs (backslash, case)', () => {
    expect(normalizeLdrawRef(' S\\3001S01.DAT ')).toBe('s/3001s01.dat');
  });

  it('reads triangles, splits quads, skips lines and optional lines', () => {
    const { read } = reader({
      'part.dat': [
        '0 header',
        '2 24 0 0 0 1 0 0',
        '3 16 0 0 0 1 0 0 0 0 1',
        '4 16 0 0 0 1 0 0 1 1 0 0 1 0',
        '5 24 0 0 0 1 0 0 0 1 0 0 0 1',
      ].join('\n'),
    });
    const tris = new LdrawGeometryCache(read).triangles('part.dat')!;
    expect(tris.length / 9).toBe(3);
  });

  it('applies type-1 matrices (x\' = a x + b y + c z + X)', () => {
    const { read } = reader({
      'top.dat': '1 16 10 0 0 0 0 1 0 1 0 1 0 0 s\\sub.dat',
      's/sub.dat': '3 16 1 0 0 0 2 0 0 0 3',
    });
    const tris = Array.from(new LdrawGeometryCache(read).triangles('top.dat')!);
    // a b c = 0 0 1 ; d e f = 0 1 0 ; g h i = 1 0 0  → swaps x and z, then +10 on x.
    expect(tris).toEqual([10, 0, 1, 10, 2, 0, 13, 0, 0]);
  });

  it('caches shared sub-files and survives cycles / missing files', () => {
    const { read, reads } = reader({
      'a.dat': [
        '1 16 0 0 0 1 0 0 0 1 0 0 0 1 stud.dat',
        '1 16 20 0 0 1 0 0 0 1 0 0 0 1 stud.dat',
        '1 16 0 0 0 1 0 0 0 1 0 0 0 1 missing.dat',
        '1 16 0 0 0 1 0 0 0 1 0 0 0 1 a.dat',
      ].join('\n'),
      'stud.dat': '3 16 0 0 0 1 0 0 0 0 1',
    });
    const tris = new LdrawGeometryCache(read).triangles('a.dat')!;
    expect(tris.length / 9).toBe(2);
    expect(reads.filter((r) => r === 'stud.dat')).toHaveLength(1);
  });

  it('returns null for an unknown part', () => {
    const { read } = reader({});
    expect(new LdrawGeometryCache(read).triangles('nope.dat')).toBeNull();
  });
});

describe('buildLdrawPreviewGeometry', () => {
  // Brick 2x4 body box corners in LDU: X ±40, Z ±20, Y 0 (top) .. 24 (bottom).
  const body = Float32Array.from([
    -40, 24, -20, 40, 24, -20, 40, 24, 20,
    -40, 0, -20, 40, 0, 20, 40, 0, -20,
  ]);

  it('maps LDraw to game axes: long side on Z, Y up, grounded, centered', () => {
    const g = buildLdrawPreviewGeometry(body);
    expect(g.size[0]).toBeCloseTo(2 * S);
    expect(g.size[1]).toBeCloseTo(3 * P);
    expect(g.size[2]).toBeCloseTo(4 * S);
    let minY = Infinity;
    let minX = Infinity;
    let maxX = -Infinity;
    for (let v = 0; v < g.indices.length; v++) {
      minY = Math.min(minY, g.vertices[v * 20 + 1]!);
      minX = Math.min(minX, g.vertices[v * 20]!);
      maxX = Math.max(maxX, g.vertices[v * 20]!);
    }
    expect(minY).toBeCloseTo(0);
    expect(minX).toBeCloseTo(-maxX);
  });

  it('emits both faces and drops degenerate triangles', () => {
    const withDegenerate = Float32Array.from([...body, 0, 0, 0, 0, 0, 0, 1, 1, 1]);
    const g = buildLdrawPreviewGeometry(withDegenerate);
    expect(g.triangleCount).toBe(2);
    expect(g.indices.length).toBe(2 * 2 * 3);
    // Two disjoint triangles: 6 corners × 2 sides.
    expect(g.vertices.length).toBe(12 * 20);
  });

  it('box-projects a horizontal face so both U and V vary', () => {
    const g = buildLdrawPreviewGeometry(body);
    const uv = (corner: number) => {
      const o = g.indices[corner]! * 20;
      return [g.vertices[o + 3]!, g.vertices[o + 4]!] as const;
    };
    const us = [0, 1, 2].map((i) => uv(i)[0]);
    const vs = [0, 1, 2].map((i) => uv(i)[1]);
    expect(Math.max(...us) - Math.min(...us)).toBeGreaterThan(0.5);
    expect(Math.max(...vs) - Math.min(...vs)).toBeGreaterThan(0.5);
  });
});

describe('buildLdrawPreviewGeometry UVs', () => {
  const uvAt = (g: ReturnType<typeof buildLdrawPreviewGeometry>, index: number) => {
    const o = g.indices[index]! * 20;
    return {
      uv0: [g.vertices[o + 3]!, g.vertices[o + 4]!] as const,
      uv1: [g.vertices[o + 5]!, g.vertices[o + 6]!] as const,
      index: g.indices[index]!,
    };
  };

  it('keeps UV0 continuous across a smooth edge and split on a hard edge', () => {
    const quad = Float32Array.from([
      0, 0, 0, 20, 0, 0, 0, 0, 20,
      20, 0, 0, 20, 0, 20, 0, 0, 20,
    ]);
    const smooth = buildLdrawPreviewGeometry(quad);
    // Shared corner (20,0,0) is index 1 of face A and index 0 of face B (front starts at 6).
    expect(uvAt(smooth, 1).index).toBe(uvAt(smooth, 6).index);

    const hard = buildLdrawPreviewGeometry(quad, Float32Array.from([20, 0, 0, 0, 0, 20]));
    expect(uvAt(hard, 1).index).not.toBe(uvAt(hard, 6).index);
  });

  it('uses the same UV0 density on a horizontal and a vertical edge', () => {
    const horizontal = [0, 0, 0, 0, 0, 20, 20, 0, 20];
    const vertical = [0, 0, 0, 0, 0, 20, 0, 8, 0];
    const g = buildLdrawPreviewGeometry(Float32Array.from([...horizontal, ...vertical]));
    const len = (a: readonly [number, number], b: readonly [number, number]) =>
      Math.hypot(a[0] - b[0], a[1] - b[1]);
    const h = len(uvAt(g, 0).uv0, uvAt(g, 1).uv0);
    const v = len(uvAt(g, 6).uv0, uvAt(g, 7).uv0);
    expect(h).toBeCloseTo(S / 0.1);
    expect(v).toBeCloseTo(h);
  });

  it('packs UV1 into [0,1] without overlapping charts', () => {
    const g = buildLdrawPreviewGeometry(
      Float32Array.from([
        -40, 24, -20, 40, 24, -20, 40, 24, 20,
        -40, 0, -20, 40, 0, 20, 40, 0, -20,
      ])
    );
    const box = (corners: number[]) => {
      let minU = Infinity;
      let minV = Infinity;
      let maxU = -Infinity;
      let maxV = -Infinity;
      for (const c of corners) {
        const { uv1 } = uvAt(g, c);
        expect(uv1[0]).toBeGreaterThanOrEqual(0);
        expect(uv1[0]).toBeLessThanOrEqual(1);
        expect(uv1[1]).toBeGreaterThanOrEqual(0);
        expect(uv1[1]).toBeLessThanOrEqual(1);
        minU = Math.min(minU, uv1[0]);
        minV = Math.min(minV, uv1[1]);
        maxU = Math.max(maxU, uv1[0]);
        maxV = Math.max(maxV, uv1[1]);
      }
      return { minU, minV, maxU, maxV };
    };
    const a = box([0, 1, 2]);
    const b = box([6, 7, 8]);
    const overlap = a.minU < b.maxU && b.minU < a.maxU && a.minV < b.maxV && b.minV < a.maxV;
    expect(overlap).toBe(false);
  });

  it('bakes convexity on a hard edge and leaves a flat face clean', () => {
    const color = (g: ReturnType<typeof buildLdrawPreviewGeometry>, index: number) => {
      const o = g.indices[index]! * 20 + 16;
      return [g.vertices[o]!, g.vertices[o + 1]!, g.vertices[o + 2]!, g.vertices[o + 3]!] as const;
    };
    const fold = buildLdrawPreviewGeometry(
      Float32Array.from([0, 0, 0, 20, 0, 0, 10, 0, 20, 0, 0, 0, 20, 0, 0, 10, -20, 0])
    );
    let maxConvex = 0;
    for (let i = 0; i < 6; i++) maxConvex = Math.max(maxConvex, color(fold, i)[1]);
    expect(maxConvex).toBeGreaterThan(0.4);

    const flat = buildLdrawPreviewGeometry(
      Float32Array.from([0, 0, 0, 20, 0, 0, 0, 0, 20, 20, 0, 0, 20, 0, 20, 0, 0, 20])
    );
    for (let i = 0; i < flat.indices.length; i++) {
      const [r, g] = color(flat, i);
      expect(r).toBeLessThan(0.05);
      expect(g).toBeLessThan(0.05);
    }
  });

  it('bakes a UV1 map with the crease band, not the whole face', () => {
    const fold = buildLdrawPreviewGeometry(
      Float32Array.from([0, 0, 0, 20, 0, 0, 10, 0, 20, 0, 0, 0, 20, 0, 0, 10, -20, 0])
    );
    const bake = bakeLdrawAgingTexture(fold.vertices, fold.indices, fold.triangleCount);
    expect(bake.size).toBe(LDRAW_AGING_SIZE);
    expect(bake.rgba.length).toBe(LDRAW_AGING_SIZE * LDRAW_AGING_SIZE * 4);

    const uv = (index: number): [number, number] => {
      const o = fold.indices[index]! * 20 + 5;
      return [fold.vertices[o]!, fold.vertices[o + 1]!];
    };
    const a = uv(0);
    const b = uv(1);
    const c = uv(2);
    const cu = (a[0] + b[0] + c[0]) / 3;
    const cv = (a[1] + b[1] + c[1]) / 3;
    const x = Math.min(bake.size - 1, Math.floor(cu * bake.size));
    const y = Math.min(bake.size - 1, Math.floor(cv * bake.size));
    const center = y * bake.size + x;
    expect(bake.coverage[center]).toBe(1);
    expect(bake.rgba[center * 4 + 1]!).toBeLessThan(20);

    let covered = 0;
    let creased = 0;
    let maxEdge = 0;
    for (let i = 0; i < bake.coverage.length; i++) {
      if (!bake.coverage[i]) continue;
      covered++;
      const g = bake.rgba[i * 4 + 1]!;
      if (g > maxEdge) maxEdge = g;
      if (g > 100) creased++;
    }
    expect(covered).toBeGreaterThan(50);
    expect(maxEdge).toBeGreaterThan(150);
    expect(creased).toBeGreaterThan(0);
    expect(creased / covered).toBeLessThan(0.4);

    const flat = buildLdrawPreviewGeometry(
      Float32Array.from([0, 0, 0, 20, 0, 0, 0, 0, 20, 20, 0, 0, 20, 0, 20, 0, 0, 20])
    );
    const clean = bakeLdrawAgingTexture(flat.vertices, flat.indices, flat.triangleCount);
    let maxR = 0;
    let maxG = 0;
    for (let i = 0; i < clean.coverage.length; i++) {
      if (!clean.coverage[i]) continue;
      if (clean.rgba[i * 4]! > maxR) maxR = clean.rgba[i * 4]!;
      if (clean.rgba[i * 4 + 1]! > maxG) maxG = clean.rgba[i * 4 + 1]!;
    }
    expect(maxR).toBeLessThan(8);
    expect(maxG).toBeLessThan(8);
  });

  it('ray-traced AO darkens the floor at a wall foot and leaves open floor clear', () => {
    // Floor 4×4 studs (y = 0) with a 3-plate wall standing on its x = 0 edge.
    // A slab 2 LDU below closes the floor, like a real part (its underside is not visible).
    const floor = [0, 0, 0, 80, 0, 0, 80, 0, 80, 0, 0, 0, 80, 0, 80, 0, 0, 80];
    const slab = [0, 2, 0, 80, 2, 0, 80, 2, 80, 0, 2, 0, 80, 2, 80, 0, 2, 80];
    const wall = [0, 0, 0, 0, -24, 0, 0, -24, 80, 0, 0, 0, 0, -24, 80, 0, 0, 80];
    const g = buildLdrawPreviewGeometry(Float32Array.from([...floor, ...wall, ...slab]));
    const bake = bakeLdrawAgingTexture(g.vertices, g.indices, g.triangleCount);
    const aoAtUv1 = (u: number, v: number) => {
      const x = Math.min(bake.size - 1, Math.floor(u * bake.size));
      const y = Math.min(bake.size - 1, Math.floor(v * bake.size));
      return bake.rgba[(y * bake.size + x) * 4 + 2]!;
    };
    // Floor UV1: find the floor-face corners nearest/farthest from the wall (game Z = LDraw X).
    let nearUv: [number, number] | null = null;
    let farUv: [number, number] | null = null;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < 3; i++) {
      const o = g.indices[i]! * 20;
      const z = g.vertices[o + 2]!;
      const uv: [number, number] = [g.vertices[o + 5]!, g.vertices[o + 6]!];
      if (z < minZ) [minZ, nearUv] = [z, uv];
      if (z > maxZ) [maxZ, farUv] = [z, uv];
    }
    expect(nearUv && farUv).toBeTruthy();
    // Step a little inside the chart from each corner toward the other.
    const lerp = (a: [number, number], b: [number, number], t: number) =>
      [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] as const;
    const near = aoAtUv1(...lerp(nearUv!, farUv!, 0.015));
    const far = aoAtUv1(...lerp(farUv!, nearUv!, 0.04));
    expect(far).toBeGreaterThan(240);
    expect(near).toBeLessThan(far - 25);
  });
});

describe('buildLdrawPreviewGeometry normals', () => {
  // Two triangles sharing the edge (0,0,0)-(20,0,0); same edge direction in both,
  // i.e. inconsistent winding as LDraw often has without BFC.
  const flat = [0, 0, 0, 20, 0, 0, 10, 0, 20];
  const fold = (y: number, z = -20) => Float32Array.from([...flat, 0, 0, 0, 20, 0, 0, 10, y, z]);

  const normalAt = (g: ReturnType<typeof buildLdrawPreviewGeometry>, index: number) => {
    const o = g.indices[index]! * 20 + 7;
    return [g.vertices[o]!, g.vertices[o + 1]!, g.vertices[o + 2]!] as const;
  };
  const absDot = (a: readonly number[], b: readonly number[]) =>
    Math.abs(a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!);

  it('smooths a shallow fold across the shared edge (welded, orientation-free)', () => {
    const g = buildLdrawPreviewGeometry(fold(-3));
    // Front corner 0 of face A (index 0) and face B (index 6) are the same vertex.
    const a = normalAt(g, 0);
    const b = normalAt(g, 6);
    expect(absDot(a, b)).toBeCloseTo(1, 5);
    expect(Math.abs(a[1])).toBeLessThan(0.999);
    // 4 welded vertices, one smoothing group each, × 2 sides.
    expect(g.vertices.length).toBe(8 * 20);
  });

  it('keeps folds sharper than the crease angle hard', () => {
    const g = buildLdrawPreviewGeometry(fold(-20, 0));
    expect(Math.abs(normalAt(g, 0)[1])).toBeCloseTo(1, 5);
    expect(absDot(normalAt(g, 0), normalAt(g, 6))).toBeLessThan(0.5);
    expect(g.vertices.length).toBe(12 * 20);
  });

  it('keeps type-2 edges hard even on a shallow fold', () => {
    const g = buildLdrawPreviewGeometry(fold(-3), Float32Array.from([0, 0, 0, 20, 0, 0]));
    expect(Math.abs(normalAt(g, 0)[1])).toBeCloseTo(1, 5);
    expect(g.vertices.length).toBe(12 * 20);
  });

  it('back faces get the opposite normal', () => {
    const g = buildLdrawPreviewGeometry(fold(-3));
    const front = normalAt(g, 0);
    const back = normalAt(g, 3);
    expect(front[0] + back[0]).toBeCloseTo(0);
    expect(front[1] + back[1]).toBeCloseTo(0);
    expect(front[2] + back[2]).toBeCloseTo(0);
  });
});

describe('LdrawGeometryCache edges', () => {
  it('collects type-2 edges through sub-file matrices', () => {
    const { read } = reader({
      'top.dat': '1 16 10 0 0 1 0 0 0 1 0 0 0 1 sub.dat',
      'sub.dat': '2 24 0 0 0 1 2 3\n5 24 0 0 0 1 0 0 0 1 0 0 0 1',
    });
    const geo = new LdrawGeometryCache(read).geometry('top.dat')!;
    expect(Array.from(geo.edges)).toEqual([10, 0, 0, 11, 2, 3]);
  });
});
