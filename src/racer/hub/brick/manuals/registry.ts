/**
 * @file registry.ts
 * @description Brick manuals for brick-lab hot-swap (eager glob — DC1a).
 */

import type { BrickManual } from '../manual/manualSchema';

const modules = import.meta.glob('./*.manual.json', { eager: true }) as Record<
  string,
  { default: BrickManual } | BrickManual
>;

function unwrap(mod: { default: BrickManual } | BrickManual): BrickManual {
  return (mod as { default?: BrickManual }).default ?? (mod as BrickManual);
}

function stemFromPath(path: string): string {
  const base = path.split('/').pop() ?? path;
  return base.replace(/\.manual\.json$/i, '');
}

const byId = new Map<string, BrickManual>();
for (const [path, mod] of Object.entries(modules)) {
  const manual = unwrap(mod);
  const stem = stemFromPath(path);
  byId.set(stem, manual);
}

export type BrickManualId = string;

export const BRICK_MANUAL_IDS: readonly BrickManualId[] = Object.freeze(
  [...byId.keys()].sort((a, b) => a.localeCompare(b))
);

export function isBrickManualId(v: string | null | undefined): v is BrickManualId {
  return v != null && byId.has(v);
}

export function getBrickManual(id: BrickManualId): BrickManual {
  const m = byId.get(id);
  if (!m) throw new Error(`Unknown brick manual '${id}'`);
  return m;
}

export function brickManualLabel(id: BrickManualId): string {
  const m = byId.get(id);
  if (m?.title) return m.title;
  return id;
}

/** Optional overlay image URL (public/) keyed by manual stem. */
const OVERLAY_BY_ID: Readonly<Record<string, string>> = {
  fountain: '/brick-refs/fountain-ortho.png',
};

export function brickManualOverlayUrl(id: BrickManualId): string | null {
  return OVERLAY_BY_ID[id] ?? null;
}
