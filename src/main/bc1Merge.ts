/**
 * @file bc1Merge.ts
 * @description Dev IPC helper: merge staged parts into catalog data/parts.json (CL1e).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export type MergePartPayload = {
  id: string;
  name: string;
  category: string;
  footprint: [number, number, number];
  mesh: { status: string; asset?: string };
  aliases?: string[];
  notes?: string;
};

export type MergeResult = {
  ok: boolean;
  added: number;
  total: number;
  path?: string;
  error?: string;
};

type PartsFile = {
  version: number;
  parts: MergePartPayload[];
};

function partsJsonPath(): string {
  // electron-vite: __dirname = out/main → repo root is ../..
  return path.join(__dirname, '../../src/racer/hub/brick/catalog/data/parts.json');
}

export function mergeBc1PartsFile(staging: MergePartPayload[]): MergeResult {
  try {
    const filePath = partsJsonPath();
    const raw = readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw) as PartsFile;
    if (!Array.isArray(data.parts)) {
      return { ok: false, added: 0, total: 0, error: 'parts.json: missing parts[]' };
    }
    const byId = new Map(data.parts.map((p) => [p.id, p]));
    let added = 0;
    for (const p of staging) {
      if (!p?.id || !Array.isArray(p.footprint) || p.footprint.length !== 3) continue;
      if (!byId.has(p.id)) added += 1;
      byId.set(p.id, {
        id: p.id,
        name: p.name,
        category: p.category,
        footprint: p.footprint,
        mesh: { status: p.mesh?.status ?? 'box', ...(p.mesh?.asset ? { asset: p.mesh.asset } : {}) },
        ...(p.aliases ? { aliases: p.aliases } : {}),
        ...(p.notes ? { notes: p.notes } : {}),
      });
    }
    const parts = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
    const next: PartsFile = { version: data.version ?? 1, parts };
    writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    return { ok: true, added, total: parts.length, path: filePath };
  } catch (err) {
    return {
      ok: false,
      added: 0,
      total: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
