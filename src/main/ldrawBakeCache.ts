/**
 * @file ldrawBakeCache.ts
 * @description Disk cache for baked LDraw meshes (CL5b): hash → LDRC under data/ldraw-cache.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import {
  bakeLdrawMesh,
  decodeLdrawBakedMesh,
  encodeLdrawBakedMesh,
  type LdrawBakedMesh,
} from '../racer/hub/brick/ldraw/ldrawBakedMesh';
import type { LdrawMeshAnchor } from '../racer/hub/brick/ldraw/ldrawGeometry';
import type {
  LdrawBakeWorkerRequest,
  LdrawBakeWorkerResponse,
} from './ldrawBakeWorker';
import { ldrawPartTriangles, resolveRepoRoot } from './ldrawMain';

export type LdrawPartMeshResult =
  | { ok: true; ldrawId: string; anchor: LdrawMeshAnchor; mesh: LdrawBakedMesh }
  | { ok: false; ldrawId: string; anchor: LdrawMeshAnchor; error: string };

/** Concurrent bake workers (each holds a full part + 256² atlas). */
const MAX_WORKERS = Math.max(1, Math.min(4, cpus().length - 1));

const inflight = new Map<string, Promise<LdrawPartMeshResult>>();
let activeWorkers = 0;
const waiting: (() => void)[] = [];

export function hashLdrawSource(triangles: Float32Array, edges: Float32Array): Uint8Array {
  return createHash('sha1')
    .update(Buffer.from(triangles.buffer, triangles.byteOffset, triangles.byteLength))
    .update(Buffer.from(edges.buffer, edges.byteOffset, edges.byteLength))
    .digest();
}

function resolveCacheRoot(): string {
  return path.join(resolveRepoRoot(), 'data/ldraw-cache');
}

export function ldrawCachePath(anchor: LdrawMeshAnchor, ldrawId: string, root = resolveCacheRoot()): string {
  return path.join(root, anchor, `${ldrawId}.bin`);
}

function normalizeAnchor(anchor: unknown): LdrawMeshAnchor {
  return anchor === 'origin' ? 'origin' : 'ground-center';
}

function writeAtomic(filePath: string, data: Uint8Array): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, data);
  renameSync(tmp, filePath);
}

/** Built next to index.js by electron-vite; absent under vitest / the bake script. */
function workerScriptPath(): string | null {
  if (typeof __dirname === 'undefined') return null;
  const script = path.join(__dirname, 'ldrawBakeWorker.js');
  return existsSync(script) ? script : null;
}

async function acquireWorkerSlot(): Promise<void> {
  if (activeWorkers < MAX_WORKERS) {
    activeWorkers++;
    return;
  }
  await new Promise<void>((resolve) => waiting.push(resolve));
}

function releaseWorkerSlot(): void {
  const next = waiting.shift();
  if (next) next();
  else activeWorkers--;
}

function runWorker(script: string, req: LdrawBakeWorkerRequest): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(script);
    let settled = false;
    const settle = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      void worker.terminate();
      fn();
    };
    worker.on('message', (msg: LdrawBakeWorkerResponse) =>
      settle(() => (msg.ok ? resolve(msg.blob) : reject(new Error(msg.error))))
    );
    worker.on('error', (err) => settle(() => reject(err)));
    worker.on('exit', (code) =>
      settle(() => reject(new Error(`worker LDraw arrêté (code ${code})`)))
    );
    worker.postMessage(req);
  });
}

async function bakeBlob(
  triangles: Float32Array,
  edges: Float32Array,
  anchor: LdrawMeshAnchor,
  sourceHash: Uint8Array
): Promise<Uint8Array> {
  const script = workerScriptPath();
  if (!script) {
    const mesh = bakeLdrawMesh(triangles, edges, anchor);
    if (!mesh) throw new Error('mesh vide');
    return encodeLdrawBakedMesh(mesh, { sourceHash });
  }
  await acquireWorkerSlot();
  try {
    return await runWorker(script, { triangles, edges, anchor, sourceHash });
  } finally {
    releaseWorkerSlot();
  }
}

/**
 * Load a baked mesh from disk or bake + write. Concurrent calls for the same key share one promise.
 * `cacheRoot` is injectable for tests.
 */
export function ldrawPartMesh(
  ldrawId: string,
  anchor: unknown = 'ground-center',
  cacheRoot: string = resolveCacheRoot()
): Promise<LdrawPartMeshResult> {
  const id = String(ldrawId ?? '').trim();
  const a = normalizeAnchor(anchor);
  const key = `${a}:${id}:${cacheRoot}`;
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async (): Promise<LdrawPartMeshResult> => {
    if (!id || /[\\/]|\.\./.test(id)) {
      return { ok: false, ldrawId: id, anchor: a, error: 'id LDraw invalide' };
    }
    const src = ldrawPartTriangles(id);
    if (!src.ok) return { ok: false, ldrawId: id, anchor: a, error: src.error };

    const sourceHash = hashLdrawSource(src.triangles, src.edges);
    const file = ldrawCachePath(a, id, cacheRoot);
    if (existsSync(file)) {
      try {
        const mesh = decodeLdrawBakedMesh(new Uint8Array(readFileSync(file)), {
          expectedHash: sourceHash,
        });
        if (mesh) return { ok: true, ldrawId: id, anchor: a, mesh };
      } catch {
        // Unreadable or truncated: re-bake below.
      }
    }

    try {
      const blob = await bakeBlob(src.triangles, src.edges, a, sourceHash);
      writeAtomic(file, blob);
      const mesh = decodeLdrawBakedMesh(blob, { expectedHash: sourceHash });
      if (!mesh) return { ok: false, ldrawId: id, anchor: a, error: 'decode après bake échoué' };
      return { ok: true, ldrawId: id, anchor: a, mesh };
    } catch (err) {
      return {
        ok: false,
        ldrawId: id,
        anchor: a,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}

/** Test helper: clear in-flight map. */
export function clearLdrawBakeInflight(): void {
  inflight.clear();
}
