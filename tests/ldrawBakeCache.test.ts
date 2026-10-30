/**
 * @file ldrawBakeCache.test.ts
 * @description CL5b/d: disk cache hit/miss + header invalidation.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearLdrawBakeInflight,
  hashLdrawSource,
  ldrawCachePath,
  ldrawPartMesh,
} from '../src/main/ldrawBakeCache';
import { encodeLdrawBakedMesh, LDRAW_BAKE_VERSION } from '../src/racer/hub/brick/ldraw/ldrawBakedMesh';
import * as ldrawMain from '../src/main/ldrawMain';

const square = Float32Array.from([
  0, 0, 0, 20, 0, 0, 20, 0, 20,
  0, 0, 0, 20, 0, 20, 0, 0, 20,
]);
const emptyEdges = new Float32Array(0);

let cacheDir: string;

afterEach(() => {
  clearLdrawBakeInflight();
  vi.restoreAllMocks();
  if (cacheDir) {
    try {
      rmSync(cacheDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

describe('ldrawPartMesh disk cache', () => {
  it('bakes on miss then reads on hit without re-bake', async () => {
    cacheDir = mkdtempSync(path.join(tmpdir(), 'ldraw-cache-'));
    vi.spyOn(ldrawMain, 'ldrawPartTriangles').mockReturnValue({
      ok: true,
      ldrawId: 'test-sq',
      triangles: square,
      edges: emptyEdges,
    });

    const bakeMod = await import('../src/racer/hub/brick/ldraw/ldrawBakedMesh');
    const bakeSpy = vi.spyOn(bakeMod, 'bakeLdrawMesh');

    const first = await ldrawPartMesh('test-sq', 'ground-center', cacheDir);
    expect(first.ok).toBe(true);
    expect(bakeSpy).toHaveBeenCalledTimes(1);
    const file = ldrawCachePath('ground-center', 'test-sq', cacheDir);
    expect(readFileSync(file).byteLength).toBeGreaterThan(64);

    bakeSpy.mockClear();
    const second = await ldrawPartMesh('test-sq', 'ground-center', cacheDir);
    expect(second.ok).toBe(true);
    expect(bakeSpy).not.toHaveBeenCalled();
    if (first.ok && second.ok) {
      expect(second.mesh.triangleCount).toBe(first.mesh.triangleCount);
      expect(Array.from(second.mesh.aging)).toEqual(Array.from(first.mesh.aging));
    }
  });

  it('re-bakes when the on-disk version is stale', async () => {
    cacheDir = mkdtempSync(path.join(tmpdir(), 'ldraw-cache-'));
    vi.spyOn(ldrawMain, 'ldrawPartTriangles').mockReturnValue({
      ok: true,
      ldrawId: 'test-sq',
      triangles: square,
      edges: emptyEdges,
    });

    const first = await ldrawPartMesh('test-sq', 'origin', cacheDir);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const hash = hashLdrawSource(square, emptyEdges);
    const stale = encodeLdrawBakedMesh(first.mesh, {
      sourceHash: hash,
      version: LDRAW_BAKE_VERSION + 99,
    });
    writeFileSync(ldrawCachePath('origin', 'test-sq', cacheDir), stale);

    const bakeMod = await import('../src/racer/hub/brick/ldraw/ldrawBakedMesh');
    const bakeSpy = vi.spyOn(bakeMod, 'bakeLdrawMesh');
    const again = await ldrawPartMesh('test-sq', 'origin', cacheDir);
    expect(again.ok).toBe(true);
    expect(bakeSpy).toHaveBeenCalled();
  });
});
