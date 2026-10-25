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
    expect(ids.has('MotoChassis')).toBe(true);
    expect(ids.has('PlaneChassis')).toBe(true);
    expect(ids.has('HubAvatar')).toBe(true);
    expect(ids.has('FootChaseCamera')).toBe(true);
    const footCam = cityTestSpec.entities.find((e) => e.id === 'FootChaseCamera');
    const footCtrl = footCam?.components.find((c) => c.type === 'cameraController');
    expect(footCtrl && footCtrl.type === 'cameraController' && footCtrl.mode).toBe('none');
    expect(ids.has('minifig.c01-bolt')).toBe(true);
    expect(cityTestSpec.geometryGraphs.some((g) => g.id === 'minifig_head')).toBe(true);

    const minifig = cityTestSpec.entities.find((e) => e.id === 'minifig.c01-bolt');
    expect(minifig?.parentId).toBe('HubAvatar');

    for (const id of ['KartDriver', 'MotoDriver', 'PlaneCockpit'] as const) {
      const driver = cityTestSpec.entities.find((e) => e.id === id);
      const rend = driver?.components.find((c) => c.type === 'renderable');
      expect(rend && rend.type === 'renderable' && rend.visible === false).toBe(true);
    }

    const plane = cityTestSpec.entities.find((e) => e.id === 'PlaneChassis');
    expect((plane?.transform.position[0] ?? 0) + 2).toBeLessThan(28);
    const moto = cityTestSpec.entities.find((e) => e.id === 'MotoChassis');
    expect(moto?.transform.position[0]).toBeGreaterThan(10);
  });
});
