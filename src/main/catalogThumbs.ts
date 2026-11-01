/**
 * @file catalogThumbs.ts
 * @description Dev IPC: write LDraw catalog thumbnails under public/catalog/thumbs (ED2).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export type ThumbWriteResult = {
  ok: boolean;
  path?: string;
  error?: string;
};

type ThumbsIndex = {
  version: number;
  updatedAt: string;
  ids: string[];
};

function thumbsDir(): string {
  // electron-vite: __dirname = out/main → repo root is ../..
  return path.join(__dirname, '../../public/catalog/thumbs');
}

function thumbsIndexPath(): string {
  return path.join(thumbsDir(), 'index.json');
}

function safeId(id: string): string | null {
  const s = String(id ?? '').trim();
  if (!/^[A-Za-z0-9._-]+$/.test(s)) return null;
  return s;
}

function readIndex(): ThumbsIndex {
  const p = thumbsIndexPath();
  if (!existsSync(p)) return { version: 1, updatedAt: new Date().toISOString(), ids: [] };
  try {
    const data = JSON.parse(readFileSync(p, 'utf8')) as ThumbsIndex;
    if (!Array.isArray(data.ids)) return { version: 1, updatedAt: new Date().toISOString(), ids: [] };
    return data;
  } catch {
    return { version: 1, updatedAt: new Date().toISOString(), ids: [] };
  }
}

/**
 * Electron IPC may deliver Uint8Array, ArrayBuffer, Node Buffer JSON, or a
 * plain array / array-like object after structured clone.
 */
export function coercePngBytes(raw: unknown): Buffer | null {
  if (raw == null) return null;
  if (Buffer.isBuffer(raw)) return raw;
  if (raw instanceof Uint8Array) return Buffer.from(raw);
  if (raw instanceof ArrayBuffer) return Buffer.from(new Uint8Array(raw));
  if (ArrayBuffer.isView(raw)) {
    const v = raw as ArrayBufferView;
    return Buffer.from(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
  }
  if (Array.isArray(raw)) {
    return Buffer.from(Uint8Array.from(raw as number[]));
  }
  if (typeof raw === 'object') {
    const o = raw as { type?: string; data?: unknown; length?: unknown };
    if (o.type === 'Buffer' && Array.isArray(o.data)) {
      return Buffer.from(Uint8Array.from(o.data as number[]));
    }
    if (typeof o.length === 'number' && o.length > 0) {
      const len = o.length;
      const out = new Uint8Array(len);
      for (let i = 0; i < len; i++) out[i] = Number((o as Record<string, unknown>)[i]) & 0xff;
      return Buffer.from(out);
    }
  }
  return null;
}

export function writeCatalogThumb(
  ldrawId: unknown,
  pngBytes: unknown
): ThumbWriteResult {
  const id = safeId(String(ldrawId ?? ''));
  if (!id) return { ok: false, error: 'invalid ldrawId' };
  const bytes = coercePngBytes(pngBytes);
  if (!bytes) {
    const kind = pngBytes == null ? 'null' : Object.prototype.toString.call(pngBytes);
    return { ok: false, error: `pngBytes unusable (${kind})` };
  }
  if (bytes.length < 32 || bytes[0] !== 0x89 || bytes[1] !== 0x50) {
    return { ok: false, error: `not a PNG buffer (len=${bytes.length})` };
  }
  try {
    const dir = thumbsDir();
    mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `${id}.png`);
    writeFileSync(filePath, bytes);
    const index = readIndex();
    if (!index.ids.includes(id)) index.ids.push(id);
    index.ids.sort((a, b) => a.localeCompare(b));
    index.updatedAt = new Date().toISOString();
    writeFileSync(thumbsIndexPath(), `${JSON.stringify(index, null, 2)}\n`, 'utf8');
    return { ok: true, path: filePath };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function catalogThumbExists(ldrawId: unknown): boolean {
  const id = safeId(String(ldrawId ?? ''));
  if (!id) return false;
  return existsSync(path.join(thumbsDir(), `${id}.png`));
}
