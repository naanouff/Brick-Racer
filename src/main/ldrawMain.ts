/**
 * @file ldrawMain.ts
 * @description Dev IPC: read the local LDraw library and return part triangles in LDU (CL2b).
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { LdrawGeometryCache } from '../racer/hub/brick/ldraw/ldrawGeometry';

/** Above this, preview falls back to a box (non-indexed double-sided vertices get heavy). */
export const LDRAW_MAX_PREVIEW_TRIANGLES = 60_000;

export type LdrawTrianglesResult =
  | { ok: true; ldrawId: string; triangles: Float32Array; edges: Float32Array }
  | { ok: false; ldrawId: string; error: string };

function resolveLibraryRoot(): string | null {
  // electron-vite: __dirname = out/main → repo root is ../..
  const data = path.join(__dirname, '../../data/ldraw');
  for (const candidate of [path.join(data, 'ldraw'), data]) {
    if (existsSync(path.join(candidate, 'parts'))) return candidate;
  }
  return null;
}

let cache: LdrawGeometryCache | null = null;
let cacheRoot: string | null = null;

function geometryCache(root: string): LdrawGeometryCache {
  if (cache && cacheRoot === root) return cache;
  const dirs = [path.join(root, 'parts'), path.join(root, 'p')];
  cache = new LdrawGeometryCache((ref) => {
    for (const dir of dirs) {
      const file = path.join(dir, ref);
      if (existsSync(file)) return readFileSync(file, 'utf8');
    }
    return null;
  });
  cacheRoot = root;
  return cache;
}

export function ldrawPartTriangles(ldrawId: string): LdrawTrianglesResult {
  const id = String(ldrawId ?? '').trim();
  if (!id || /[\\/]|\.\./.test(id)) return { ok: false, ldrawId: id, error: 'id LDraw invalide' };

  const root = resolveLibraryRoot();
  if (!root) {
    return {
      ok: false,
      ldrawId: id,
      error: 'bibliothèque LDraw absente (python scripts/catalog/fetch_sources.py)',
    };
  }
  try {
    const geo = geometryCache(root).geometry(`${id}.dat`);
    if (!geo) return { ok: false, ldrawId: id, error: `${id}.dat introuvable` };
    const count = geo.triangles.length / 9;
    if (count === 0) return { ok: false, ldrawId: id, error: 'aucun triangle' };
    if (count > LDRAW_MAX_PREVIEW_TRIANGLES) {
      return { ok: false, ldrawId: id, error: `trop lourd (${Math.round(count / 1000)}k tri)` };
    }
    return { ok: true, ldrawId: id, triangles: geo.triangles, edges: geo.edges };
  } catch (err) {
    return { ok: false, ldrawId: id, error: err instanceof Error ? err.message : String(err) };
  }
}
