/**
 * @file registry.ts
 * @description Level id → TypeScript LevelSpec (BRICK-BO1).
 */

import { brickLabSpec } from './brickLab/brickLabSpec';
import { catalogLabSpec } from './catalogLab/catalogLabSpec';
import { cityTestSpec } from './cityTest/cityTestSpec';
import { raceTestSpec } from './raceTest/raceTestSpec';
import { sandboxKartSpec } from './sandboxKart/sandboxKartSpec';
import type { LevelSpec } from './shared/levelTypes';

export const LEVEL_IDS = [
  'race-test',
  'city-test',
  'sandbox-kart',
  'brick-lab',
  'catalog-lab',
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
  }
}
