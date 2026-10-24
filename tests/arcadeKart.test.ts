/**
 * @file arcadeKart.test.ts
 * @description Pure arcade math + triggers (BRICK-BO1g).
 */

import { describe, expect, it } from 'vitest';
import { RACE_TEST_SPAWN } from '../src/racer/levels/raceTest';
import { createBlockoutKartEntities } from '../src/racer/levels/shared';
import { pointInTrigger } from '../src/racer/levels/shared/levelTriggers';
import {
  ARCADE_PROFILES,
  BLOCKOUT_WHEEL_RADIUS,
  boostDurationForCharge,
  createArcadeKartState,
  stepDrift,
  stepLateral,
  stepLongitudinal,
  type CcTier,
} from '../src/racer/vehicles/kart/arcade';

function timeToReach(cc: CcTier, targetFrac = 0.98): number {
  const p = ARCADE_PROFILES[cc];
  let v = 0;
  let t = 0;
  const dt = 1 / 120;
  const target = p.maxSpeed * targetFrac;
  while (t < 10 && v < target) {
    v = stepLongitudinal(v, 1, p, false, dt);
    t += dt;
  }
  return t;
}

describe('arcade longitudinal', () => {
  for (const cc of [50, 100, 150] as const) {
    it(`${cc} cc: 0→~vmax in 1.6–2.9 s`, () => {
      const t = timeToReach(cc);
      expect(t).toBeGreaterThanOrEqual(1.6);
      expect(t).toBeLessThanOrEqual(2.9);
    });

    it(`${cc} cc: caps near vmax without boost`, () => {
      const p = ARCADE_PROFILES[cc];
      let v = p.maxSpeed;
      for (let i = 0; i < 120; i++) {
        v = stepLongitudinal(v, 1, p, false, 1 / 60);
      }
      expect(v).toBeLessThanOrEqual(p.maxSpeed * 1.02);
      expect(v).toBeGreaterThan(p.maxSpeed * 0.9);
    });
  }
});

describe('arcade lateral grip', () => {
  it('halves lateral slip within ~0.1 s at grip 12', () => {
    const p = ARCADE_PROFILES[100];
    let vLat = 10;
    vLat = stepLateral(vLat, p.grip, 0.1);
    expect(vLat).toBeLessThan(5);
  });
});

describe('arcade drift charge', () => {
  it('releases blue after chargeBlue, orange after chargeOrange', () => {
    const p = ARCADE_PROFILES[100];
    const state = createArcadeKartState(p, RACE_TEST_SPAWN, []);
    stepDrift({
      wantDrift: true,
      steer: 1,
      speed: 12,
      grounded: true,
      state,
      dt: 0.016,
    });
    expect(state.drifting).toBe(true);

    state.driftTime = p.chargeBlue + 0.01;
    const blue = stepDrift({
      wantDrift: false,
      steer: 1,
      speed: 12,
      grounded: true,
      state,
      dt: 0.016,
    });
    expect(blue.releasedCharge).toBe('blue');
    expect(boostDurationForCharge('blue', p)).toBe(p.miniTurboBlue);

    const state2 = createArcadeKartState(p, RACE_TEST_SPAWN, []);
    stepDrift({
      wantDrift: true,
      steer: -1,
      speed: 14,
      grounded: true,
      state: state2,
      dt: 0.016,
    });
    state2.driftTime = p.chargeOrange + 0.01;
    const orange = stepDrift({
      wantDrift: false,
      steer: -1,
      speed: 14,
      grounded: true,
      state: state2,
      dt: 0.016,
    });
    expect(orange.releasedCharge).toBe('orange');
    expect(boostDurationForCharge('orange', p)).toBe(p.miniTurboOrange);
  });
});

describe('boost trigger OBB', () => {
  it('detects point inside yawed volume', () => {
    const trigger = {
      id: 't',
      kind: 'boost' as const,
      center: [10, 0.5, 0] as [number, number, number],
      halfExtents: [2, 1, 1] as [number, number, number],
      yaw: Math.PI / 2,
    };
    expect(pointInTrigger([10, 0.5, 0], trigger)).toBe(true);
    // Outside along world Z beyond rotated half-extent
    expect(pointInTrigger([10, 0.5, 3.5], trigger)).toBe(false);
  });
});

describe('blockout kart spawn', () => {
  it('wheel visual radius matches physics radius', () => {
    const ents = createBlockoutKartEntities({ position: [0, 0.55, 0] });
    const chassis = ents.find((e) => e.id === 'KartChassis')!;
    const vehicle = chassis.components.find((c) => c.type === 'vehicle');
    expect(vehicle?.type).toBe('vehicle');
    if (vehicle?.type !== 'vehicle') return;
    const wheel = vehicle.wheels?.[0] as { radius?: number };
    expect(wheel.radius).toBe(BLOCKOUT_WHEEL_RADIUS);

    const fl = ents.find((e) => e.id === 'KartWheel-fl')!;
    expect(fl.transform.scale[0]).toBeCloseTo(BLOCKOUT_WHEEL_RADIUS / 0.5, 5);
    expect(fl.transform.scale[2]).toBeCloseTo(BLOCKOUT_WHEEL_RADIUS / 0.5, 5);
  });

  it('reset spawn pose matches RACE_TEST_SPAWN', () => {
    expect(RACE_TEST_SPAWN.position[2]).toBe(-4.5);
  });
});
