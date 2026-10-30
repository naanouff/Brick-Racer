/**
 * @file ldrawMeshCache.ts
 * @description Shared LDraw → uploaded W3DTS Mesh cache (CL preview + MF2 minifig).
 */

import { Mesh, type Engine } from '@naanouff/w3dts-core';
import { LDRAW_AGING_SIZE } from '../ldraw/ldrawAgingBake';
import {
  bakeLdrawMesh,
  type LdrawBakedMesh,
} from '../ldraw/ldrawBakedMesh';
import type { LdrawMeshAnchor } from '../ldraw/ldrawGeometry';

export type LdrawUploadedMesh = {
  mesh: Mesh;
  triangleCount: number;
  size: [number, number, number];
  vertices: Float32Array;
  indices: Uint32Array;
  aging: Uint8Array;
  coverage: Uint8Array;
};

const cache = new Map<string, LdrawUploadedMesh>();

export type EnsureLdrawMeshOpts = {
  /** Cache + mesh name key (usually the LDraw design id). */
  key: string;
  /** Prefer a pre-baked mesh from IPC `ldrawPartMesh` (CL5). */
  baked?: LdrawBakedMesh;
  /** Fallback when `baked` is absent (tests / IPC triangles only). */
  triangles?: Float32Array;
  edges?: Float32Array;
  /** Mesh resource name prefix. Default `catalog.ldraw`. */
  meshNamePrefix?: string;
  /**
   * `ground-center` for catalog preview.
   * `origin` keeps the LDraw origin at mesh zero (minifig assembly).
   */
  anchor?: LdrawMeshAnchor;
};

function cacheKeyFor(key: string, anchor: LdrawMeshAnchor): string {
  return anchor === 'origin' ? `${key}@origin` : key;
}

function uploadBaked(
  engine: Engine,
  key: string,
  anchor: LdrawMeshAnchor,
  baked: LdrawBakedMesh,
  meshNamePrefix: string
): LdrawUploadedMesh {
  const prefix = meshNamePrefix;
  const mesh = new Mesh(
    baked.vertices,
    baked.indices,
    anchor === 'origin' ? `${prefix}.${key}.origin` : `${prefix}.${key}`
  );
  engine.resourceManager.uploadMesh(mesh);
  const entry: LdrawUploadedMesh = {
    mesh,
    triangleCount: baked.triangleCount,
    size: baked.size,
    vertices: baked.vertices,
    indices: baked.indices,
    aging: baked.aging,
    coverage: baked.coverage,
  };
  cache.set(cacheKeyFor(key, anchor), entry);
  return entry;
}

/**
 * Build (or reuse) an uploaded LDraw mesh.
 * Prefer `baked` from the main-process disk cache; fall back to local bake from triangles.
 */
export function ensureLdrawUploadedMesh(
  engine: Engine,
  opts: EnsureLdrawMeshOpts
): LdrawUploadedMesh | null {
  const anchor = opts.anchor ?? 'ground-center';
  const cacheKey = cacheKeyFor(opts.key, anchor);
  let entry = cache.get(cacheKey);
  if (entry && entry.aging.byteLength !== LDRAW_AGING_SIZE * LDRAW_AGING_SIZE * 4) {
    cache.delete(cacheKey);
    entry = undefined;
  }
  if (entry) return entry;

  const prefix = opts.meshNamePrefix ?? 'catalog.ldraw';
  if (opts.baked && opts.baked.triangleCount > 0) {
    return uploadBaked(engine, opts.key, anchor, opts.baked, prefix);
  }

  if (!opts.triangles || opts.triangles.length < 9) return null;
  const baked = bakeLdrawMesh(opts.triangles, opts.edges ?? new Float32Array(0), anchor);
  if (!baked) return null;
  return uploadBaked(engine, opts.key, anchor, baked, prefix);
}

/** Mesh source for `ensureLdrawUploadedMesh`: baked by main, or raw triangles to bake here. */
export type LdrawPartSource =
  | { baked: LdrawBakedMesh }
  | { triangles: Float32Array; edges: Float32Array };

export type FetchLdrawPartResult =
  | { ok: true; source: LdrawPartSource }
  | { ok: false; error: string };

/**
 * Fetch one part over IPC. Prefers the disk-cached bake (`ldrawPartMesh`); an older preload
 * without it still works through `ldrawPartTriangles`. Null when no LDraw IPC exists.
 */
export async function fetchLdrawPart(
  ldrawId: string,
  anchor: LdrawMeshAnchor
): Promise<FetchLdrawPartResult | null> {
  const api = typeof window !== 'undefined' ? window.brickRacer : undefined;
  if (api?.ldrawPartMesh) {
    const res = await api.ldrawPartMesh(ldrawId, anchor);
    return res.ok ? { ok: true, source: { baked: res.mesh } } : { ok: false, error: res.error };
  }
  if (api?.ldrawPartTriangles) {
    const res = await api.ldrawPartTriangles(ldrawId);
    return res.ok
      ? { ok: true, source: { triangles: res.triangles, edges: res.edges } }
      : { ok: false, error: res.error };
  }
  return null;
}

/** True when either LDraw IPC channel is exposed. */
export function hasLdrawIpc(): boolean {
  const api = typeof window !== 'undefined' ? window.brickRacer : undefined;
  return Boolean(api?.ldrawPartMesh || api?.ldrawPartTriangles);
}

export function getCachedLdrawMesh(key: string): LdrawUploadedMesh | null {
  return cache.get(key) ?? null;
}

/** Test / HMR helper. */
export function clearLdrawMeshCache(): void {
  cache.clear();
}
