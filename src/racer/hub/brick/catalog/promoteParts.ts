/**
 * @file promoteParts.ts
 * @description Resolve design IDs against master-index → BrickPartDef (CF1a).
 */

import type { MasterIndexEntry } from './masterIndex';
import { guessPartCategory } from './bc1Staging';
import type { BrickPartDef } from './types';

export type PromoteBucket =
  | 'promoted'
  | 'alreadyBc1'
  | 'unresolved'
  | 'noFootprint';

export type PromoteItemResult = {
  id: string;
  bucket: PromoteBucket;
  def?: BrickPartDef;
  reason?: string;
};

export type PromoteReport = {
  setNum?: string;
  results: PromoteItemResult[];
  counts: Record<PromoteBucket, number>;
  defs: BrickPartDef[];
};

function emptyCounts(): Record<PromoteBucket, number> {
  return { promoted: 0, alreadyBc1: 0, unresolved: 0, noFootprint: 0 };
}

export function masterEntryToPartDef(entry: MasterIndexEntry): BrickPartDef | null {
  const fp = entry.footprint;
  if (!fp || fp.length !== 3) return null;
  const [sx, py, sz] = fp;
  if (!(sx > 0 && py > 0 && sz > 0)) return null;
  const def: BrickPartDef = {
    id: entry.id,
    name: entry.name,
    category: guessPartCategory(entry.name),
    footprint: [sx, py, sz],
    mesh: { status: 'box' },
    notes: 'promoted from master-index (CF1)',
  };
  if (entry.ldraw_id) def.ldrawId = entry.ldraw_id;
  return def;
}

/**
 * Pure promote: lookup each id in masterById.
 * `seedIds` = original parts.json ids (alreadyBc1); runtime-only ids still count as promoted if re-resolved.
 */
export function promotePartsFromMaster(
  ids: readonly string[],
  masterById: ReadonlyMap<string, MasterIndexEntry>,
  seedIds: ReadonlySet<string>,
  opts?: { setNum?: string }
): PromoteReport {
  const results: PromoteItemResult[] = [];
  const counts = emptyCounts();
  const defs: BrickPartDef[] = [];
  const seen = new Set<string>();

  for (const raw of ids) {
    const id = String(raw ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);

    if (seedIds.has(id)) {
      const entry = masterById.get(id);
      const def = entry ? masterEntryToPartDef(entry) : undefined;
      results.push({
        id,
        bucket: 'alreadyBc1',
        ...(def ? { def } : {}),
        reason: 'already in BC1 seed',
      });
      counts.alreadyBc1++;
      if (def) defs.push(def);
      continue;
    }

    const entry = masterById.get(id);
    if (!entry) {
      results.push({ id, bucket: 'unresolved', reason: 'not in master-index' });
      counts.unresolved++;
      continue;
    }

    const def = masterEntryToPartDef(entry);
    if (!def) {
      results.push({ id, bucket: 'noFootprint', reason: 'invalid footprint' });
      counts.noFootprint++;
      continue;
    }

    results.push({ id, bucket: 'promoted', def });
    counts.promoted++;
    defs.push(def);
  }

  return {
    ...(opts?.setNum ? { setNum: opts.setNum } : {}),
    results,
    counts,
    defs,
  };
}

export function indexMasterParts(
  parts: readonly MasterIndexEntry[]
): Map<string, MasterIndexEntry> {
  const m = new Map<string, MasterIndexEntry>();
  for (const p of parts) m.set(p.id, p);
  return m;
}
