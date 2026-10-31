/**
 * @file thumbAutoBake.ts
 * @description Background queue: bake missing catalog thumbs to public/catalog/thumbs (ED2).
 * Skips ids already on disk (index.json) unless `force` is set.
 */

import { BRICK_CATALOG } from '../../racer/hub/brick/catalog';
import { fetchLdrawPart, hasLdrawIpc } from '../../racer/hub/brick/catalog/ldrawMeshCache';
import { footprintBoxMesh, rasterizePartThumb } from '../../racer/hub/brick/catalog/thumbRaster';
import type { BrickFootprint } from '../../racer/hub/brick/catalog/types';
import { buildLdrawPreviewGeometry } from '../../racer/hub/brick/ldraw/ldrawGeometry';

export type ThumbBakePart = {
  id: string;
  ldrawId: string;
  footprint: BrickFootprint;
};

export type ThumbBakeProgress = {
  busy: boolean;
  queued: number;
  done: number;
  ok: number;
  lastMsg: string | null;
};

type Listener = (p: ThumbBakeProgress) => void;

const known = new Set<string>();
const failed = new Set<string>();
const queue: ThumbBakePart[] = [];
const queuedIds = new Set<string>();
const listeners = new Set<Listener>();

let indexLoaded = false;
let pumping = false;
let done = 0;
let ok = 0;
let lastMsg: string | null = null;
let generation = 0;

function emit(): void {
  const snap: ThumbBakeProgress = {
    busy: pumping,
    queued: queue.length,
    done,
    ok,
    lastMsg,
  };
  for (const l of listeners) l(snap);
}

export function subscribeThumbBake(listener: Listener): () => void {
  listeners.add(listener);
  listener({
    busy: pumping,
    queued: queue.length,
    done,
    ok,
    lastMsg,
  });
  return () => {
    listeners.delete(listener);
  };
}

export function thumbIsKnown(ldrawId: string): boolean {
  return known.has(ldrawId);
}

export function markThumbKnown(ldrawId: string): void {
  known.add(ldrawId);
  failed.delete(ldrawId);
}

/** Load `public/catalog/thumbs/index.json` once (safe to call often). */
export async function ensureThumbIndexLoaded(): Promise<void> {
  if (indexLoaded) return;
  indexLoaded = true;
  try {
    const res = await fetch(`/catalog/thumbs/index.json?t=${Date.now()}`);
    if (!res.ok) return;
    const data = (await res.json()) as { ids?: unknown };
    if (!Array.isArray(data.ids)) return;
    for (const id of data.ids) {
      if (typeof id === 'string' && id) known.add(id);
    }
  } catch {
    /* empty index / first run */
  }
}

async function meshFor(
  part: ThumbBakePart
): Promise<{ vertices: Float32Array; indices: Uint32Array }> {
  if (part.ldrawId && hasLdrawIpc()) {
    const mesh = await fetchLdrawPart(part.ldrawId, 'ground-center');
    if (mesh?.ok) {
      const src = mesh.source;
      if ('baked' in src && src.baked.triangleCount > 0) {
        return { vertices: src.baked.vertices, indices: src.baked.indices };
      }
      if ('triangles' in src) {
        const geo = buildLdrawPreviewGeometry(src.triangles, src.edges);
        if (geo.triangleCount > 0) return { vertices: geo.vertices, indices: geo.indices };
      }
    }
  }
  return footprintBoxMesh(part.footprint);
}

async function encodePng(data: Uint8ClampedArray<ArrayBuffer>, w: number, h: number): Promise<Uint8Array | null> {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.putImageData(new ImageData(data, w, h), 0, 0);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), 'image/png'));
  if (!blob) return null;
  return new Uint8Array(await blob.arrayBuffer());
}

async function bakeOne(part: ThumbBakePart): Promise<boolean> {
  const write = window.brickRacer?.writeCatalogThumb;
  if (!write) {
    lastMsg = 'IPC writeCatalogThumb indisponible';
    return false;
  }
  const mesh = await meshFor(part);
  const rgb = BRICK_CATALOG.colors.find((c) => c.id === 'gray')?.rgb;
  const img = rasterizePartThumb(mesh.vertices, mesh.indices, { size: 128, rgb });
  if (!img) {
    lastMsg = `${part.ldrawId}: rendu vide`;
    return false;
  }
  const png = await encodePng(img.data, img.width, img.height);
  if (!png) {
    lastMsg = `${part.ldrawId}: PNG`;
    return false;
  }
  const res = await write(part.ldrawId, Array.from(png));
  if (!res.ok) {
    lastMsg = `${part.ldrawId}: ${res.error ?? 'write failed'}`;
    return false;
  }
  known.add(part.ldrawId);
  failed.delete(part.ldrawId);
  return true;
}

async function pump(): Promise<void> {
  if (pumping) return;
  if (!window.brickRacer?.writeCatalogThumb) {
    lastMsg = 'IPC writeCatalogThumb indisponible (Electron)';
    emit();
    return;
  }
  pumping = true;
  emit();
  const gen = generation;
  while (queue.length > 0 && gen === generation) {
    const part = queue.shift()!;
    queuedIds.delete(part.ldrawId);
    if (known.has(part.ldrawId)) continue;
    try {
      const success = await bakeOne(part);
      done += 1;
      if (success) ok += 1;
      else failed.add(part.ldrawId);
      lastMsg = success
        ? `Miniatures auto ${ok} ok · file ${queue.length}`
        : lastMsg;
    } catch (err) {
      done += 1;
      failed.add(part.ldrawId);
      lastMsg = `${part.ldrawId}: ${err instanceof Error ? err.message : String(err)}`;
    }
    emit();
    // Yield so the UI stays responsive while LDraw IPC runs.
    await new Promise((r) => setTimeout(r, 0));
  }
  pumping = false;
  if (queue.length === 0) {
    lastMsg = ok > 0 ? `Miniatures à jour · ${ok} générées` : lastMsg;
  }
  emit();
}

/**
 * Enqueue missing thumbs. Already-known ids are skipped unless `force`.
 * Starts the background pump immediately.
 */
export function enqueueMissingThumbs(
  parts: readonly ThumbBakePart[],
  opts?: { force?: boolean; limit?: number }
): void {
  const force = opts?.force === true;
  const limit = opts?.limit ?? 80;
  let added = 0;
  for (const part of parts) {
    if (added >= limit) break;
    const id = part.ldrawId;
    if (!id) continue;
    if (!force && (known.has(id) || failed.has(id) || queuedIds.has(id))) continue;
    if (force) {
      known.delete(id);
      failed.delete(id);
    }
    queue.push(part);
    queuedIds.add(id);
    added += 1;
  }
  if (added > 0) {
    lastMsg = `Miniatures auto · file ${queue.length}`;
    emit();
    void ensureThumbIndexLoaded().then(() => void pump());
  }
}

/** Cancel pending work (in-flight bake finishes). */
export function clearThumbBakeQueue(): void {
  queue.length = 0;
  queuedIds.clear();
  generation += 1;
  emit();
}

/** Report a 404 from `<img onError>` so the id is queued if we have footprint data. */
export function reportMissingThumb(part: ThumbBakePart): void {
  if (known.has(part.ldrawId) || failed.has(part.ldrawId) || queuedIds.has(part.ldrawId)) return;
  known.delete(part.ldrawId);
  enqueueMissingThumbs([part], { limit: 1 });
}
