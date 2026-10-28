/**
 * @file bc1Staging.ts
 * @description Session staging of master parts → BC1 (CL1e).
 */

import type { BrickPartCategory, BrickPartDef } from './types';

export const BC1_STAGING_KEY = 'brick-racer.bc1-staging';

export type StagingPart = BrickPartDef;

export function readStaging(): StagingPart[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(BC1_STAGING_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStagingPart);
  } catch {
    return [];
  }
}

function isStagingPart(v: unknown): v is StagingPart {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === 'string' && Array.isArray(o.footprint) && o.footprint.length === 3;
}

export function writeStaging(parts: readonly StagingPart[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(BC1_STAGING_KEY, JSON.stringify(parts));
  } catch {
    /* private mode */
  }
}

export function upsertStaging(part: StagingPart): StagingPart[] {
  const next = readStaging().filter((p) => p.id !== part.id);
  next.push(part);
  next.sort((a, b) => a.id.localeCompare(b.id));
  writeStaging(next);
  return next;
}

export function removeStaging(id: string): StagingPart[] {
  const next = readStaging().filter((p) => p.id !== id);
  writeStaging(next);
  return next;
}

export function clearStaging(): void {
  writeStaging([]);
}

/** Merge staging into existing parts — no duplicate ids; staging wins on conflict. */
export function mergePartsJson(
  existing: readonly BrickPartDef[],
  staging: readonly StagingPart[]
): BrickPartDef[] {
  const byId = new Map<string, BrickPartDef>();
  for (const p of existing) byId.set(p.id, p);
  for (const p of staging) byId.set(p.id, p);
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

const CATEGORY_HINTS: { re: RegExp; cat: BrickPartCategory }[] = [
  { re: /\bcone\b/i, cat: 'cone' },
  { re: /\bdish\b|\bradar\b/i, cat: 'dish' },
  { re: /\bslope\b/i, cat: 'slope' },
  { re: /\btile\b/i, cat: 'tile' },
  { re: /\bplate\b/i, cat: 'plate' },
  { re: /\bround\b|\bmacaroni\b/i, cat: 'round' },
  { re: /\bbrick\b/i, cat: 'brick' },
];

export function guessPartCategory(name: string): BrickPartCategory {
  for (const h of CATEGORY_HINTS) {
    if (h.re.test(name)) return h.cat;
  }
  return 'other';
}
