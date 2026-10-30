/**
 * @file registry.ts
 * @description Level id → TypeScript LevelSpec (BRICK-BO1).
 */

import { brickLabSpec } from './brickLab/brickLabSpec';
import { catalogLabSpec } from './catalogLab/catalogLabSpec';
import { cityTestSpec } from './cityTest/cityTestSpec';
import { buildMinifigLabSpec } from './minifigLab/minifigLabSpec';
import { raceTestSpec } from './raceTest/raceTestSpec';
import { sandboxKartSpec } from './sandboxKart/sandboxKartSpec';
import type { LevelSpec } from './shared/levelTypes';

export const LEVEL_IDS = [
  'race-test',
  'city-test',
  'sandbox-kart',
  'brick-lab',
  'catalog-lab',
  'minifig-lab',
] as const;
export type LevelId = (typeof LEVEL_IDS)[number];

export const DEFAULT_LEVEL_ID: LevelId = 'race-test';

/** Survives packaged Electron (`app://`) where there is no URL bar for `?level=`. */
export const LEVEL_STORAGE_KEY = 'brick-racer.levelId';

export function isLevelId(value: string | null | undefined): value is LevelId {
  return value != null && (LEVEL_IDS as readonly string[]).includes(value);
}

export function readStoredLevelId(): LevelId | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(LEVEL_STORAGE_KEY);
    return isLevelId(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredLevelId(id: LevelId): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(LEVEL_STORAGE_KEY, id);
  } catch {
    /* private mode / blocked storage */
  }
}

/**
 * Resolve boot level: `?level=` wins, else last HUD choice (localStorage), else race-test.
 * Packaged Electron has no address bar — use Revue slice buttons (or persisted choice).
 */
export function resolveLevelIdFromSearch(search = ''): LevelId {
  const raw = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('level');
  if (isLevelId(raw)) return raw;
  return readStoredLevelId() ?? DEFAULT_LEVEL_ID;
}

export function getLevelSpec(id: LevelId): LevelSpec {
  switch (id) {
    case 'race-test':
      return raceTestSpec;
    case 'city-test':
      return cityTestSpec;
    case 'sandbox-kart':
      return sandboxKartSpec;
    case 'brick-lab':
      return brickLabSpec;
    case 'catalog-lab':
      return catalogLabSpec;
    case 'minifig-lab':
      return buildMinifigLabSpec();
  }
}

export function levelLabel(id: LevelId): string {
  switch (id) {
    case 'race-test':
      return 'Race test (ovale)';
    case 'city-test':
      return 'City test (hub)';
    case 'sandbox-kart':
      return 'Sandbox kart';
    case 'brick-lab':
      return 'Brick lab';
    case 'catalog-lab':
      return 'Catalogue';
    case 'minifig-lab':
      return 'Minifig lab';
  }
}

/** Atelier HUD (UIM2) — groupe rail. */
export type LevelGroup = 'pistes' | 'labs';

export function levelGroup(id: LevelId): LevelGroup {
  switch (id) {
    case 'brick-lab':
    case 'catalog-lab':
    case 'minifig-lab':
      return 'labs';
    default:
      return 'pistes';
  }
}

/** Atelier HUD — titre court sur la carte. */
export function levelShortTitle(id: LevelId): string {
  switch (id) {
    case 'race-test':
      return 'Race test';
    case 'city-test':
      return 'City test';
    case 'sandbox-kart':
      return 'Sandbox kart';
    case 'brick-lab':
      return 'Brick lab';
    case 'catalog-lab':
      return 'Catalogue';
    case 'minifig-lab':
      return 'Minifig lab';
  }
}

/** Atelier HUD — une ligne de rôle sous le titre. */
export function levelRole(id: LevelId): string {
  switch (id) {
    case 'race-test':
      return 'Ovale · arcade';
    case 'city-test':
      return 'Hub · pied / véhicule';
    case 'sandbox-kart':
      return 'Legacy · sandbox';
    case 'brick-lab':
      return 'Manuels · enveloppe';
    case 'catalog-lab':
      return 'Master × BC1';
    case 'minifig-lab':
      return 'LDraw · orbit';
  }
}

/** Atelier HUD — accent carte (CSS var or hex). */
export function levelAccent(id: LevelId): string {
  switch (id) {
    case 'race-test':
      return 'var(--br-stud-yellow)';
    case 'city-test':
      return 'var(--br-beach-mint)';
    case 'sandbox-kart':
      return 'var(--br-plaza-pastel)';
    case 'brick-lab':
    case 'catalog-lab':
      return 'var(--br-garage-oil)';
    case 'minifig-lab':
      return 'var(--br-billboard-magenta)';
  }
}
