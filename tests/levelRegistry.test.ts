/**
 * @file levelRegistry.test.ts
 * @description Level id resolution + stable blockout IDs (BRICK-BO1).
 */

import { describe, expect, it } from 'vitest';
import {
  CITY_TEST_STABLE_IDS,
  cityTestSpec,
} from '../src/racer/levels/cityTest';
import {
  DEFAULT_LEVEL_ID,
  LEVEL_IDS,
  getLevelSpec,
  isLevelId,
  resolveLevelIdFromSearch,
} from '../src/racer/levels/registry';
import {
  RACE_TEST_STABLE_IDS,
  raceTestSpec,
} from '../src/racer/levels/raceTest';

describe('level registry', () => {
  it('defaults boot to race-test', () => {
    expect(DEFAULT_LEVEL_ID).toBe('race-test');
    expect(resolveLevelIdFromSearch('')).toBe('race-test');
    expect(resolveLevelIdFromSearch('?foo=1')).toBe('race-test');
  });

  it('parses ?level= for city-test and sandbox-kart', () => {
    expect(resolveLevelIdFromSearch('?level=city-test')).toBe('city-test');
    expect(resolveLevelIdFromSearch('level=sandbox-kart')).toBe('sandbox-kart');
    expect(isLevelId('nope')).toBe(false);
  });

  it('exposes all three level specs', () => {
    for (const id of LEVEL_IDS) {
      expect(getLevelSpec(id).id).toBe(id);
      expect(getLevelSpec(id).entities.length).toBeGreaterThan(3);
    }
  });
});

describe('race-test blockout spec', () => {
  it('documents stable checkpoint and grid ids', () => {
    const ids = new Set(raceTestSpec.entities.map((e) => e.id));
    for (const id of RACE_TEST_STABLE_IDS) {
      expect(ids.has(id), id).toBe(true);
    }
    expect(ids.has('KartChassis')).toBe(true);
  });
});

describe('city-test blockout spec', () => {
  it('documents landmarks, triggers, and npc stubs', () => {
    const ids = new Set(cityTestSpec.entities.map((e) => e.id));
    for (const id of CITY_TEST_STABLE_IDS) {
      expect(ids.has(id), id).toBe(true);
    }
    expect(ids.has('KartChassis')).toBe(true);
  });
});
