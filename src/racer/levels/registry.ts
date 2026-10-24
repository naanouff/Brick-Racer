/**
 * @file registry.ts
 * @description Level id → TypeScript LevelSpec (BRICK-BO1).
 */

import { cityTestSpec } from './cityTest/cityTestSpec';
import { raceTestSpec } from './raceTest/raceTestSpec';
import { sandboxKartSpec } from './sandboxKart/sandboxKartSpec';
import type { LevelSpec } from './shared/levelTypes';

export const LEVEL_IDS = ['race-test', 'city-test', 'sandbox-kart'] as const;
export type LevelId = (typeof LEVEL_IDS)[number];

export const DEFAULT_LEVEL_ID: LevelId = 'race-test';

export function isLevelId(value: string | null | undefined): value is LevelId {
  return value != null && (LEVEL_IDS as readonly string[]).includes(value);
}

export function resolveLevelIdFromSearch(search = ''): LevelId {
  const raw = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('level');
  return isLevelId(raw) ? raw : DEFAULT_LEVEL_ID;
}

export function getLevelSpec(id: LevelId): LevelSpec {
  switch (id) {
    case 'race-test':
      return raceTestSpec;
    case 'city-test':
      return cityTestSpec;
    case 'sandbox-kart':
      return sandboxKartSpec;
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
  }
}
