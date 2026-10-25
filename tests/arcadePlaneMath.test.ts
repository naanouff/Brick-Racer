import { describe, expect, it } from 'vitest';
import {
  PLANE_KNIFE_ROLL,
  PLANE_MAX_BANK,
  stepPlaneAttitude,
  targetRoll,
  yawDeltaFromBank,
  type PlaneAttitude,
} from '../src/racer/vehicles/plane/arcadePlaneMath';
import { GP, resolvePlaneRollSnap } from '../src/racer/host/arcadeMkDriveInput';

describe('plane targetRoll', () => {
  it('banks from stick (right → negative roll; L/R snap unchanged)', () => {
    expect(targetRoll(1, 0)).toBeCloseTo(-PLANE_MAX_BANK);
    expect(targetRoll(-0.5, 0)).toBeCloseTo(0.5 * PLANE_MAX_BANK);
  });

  it('L/R snap to knife-edge ±90°', () => {
    expect(targetRoll(0, -1)).toBeCloseTo(PLANE_KNIFE_ROLL);
    expect(targetRoll(1, 1)).toBeCloseTo(-PLANE_KNIFE_ROLL);
  });
});

describe('plane coordinated turn', () => {
  it('yaws from bank instead of flat steer', () => {
    const bankRight = yawDeltaFromBank(0.8, 15, 0.016);
    const bankLeft = yawDeltaFromBank(-0.8, 15, 0.016);
    expect(bankRight).toBeGreaterThan(0);
    expect(bankLeft).toBeLessThan(0);
  });
});

describe('stepPlaneAttitude', () => {
  it('rolls toward knife-edge when rollSnap is set', () => {
    const att: PlaneAttitude = { yaw: 0, pitch: 0, roll: 0 };
    for (let i = 0; i < 45; i++) {
      stepPlaneAttitude(att, {
        steer: 0,
        climb: 0,
        rollSnap: -1,
        speed: 16,
        dt: 1 / 60,
      });
    }
    expect(att.roll).toBeGreaterThan(1.2);
    expect(Math.abs(att.yaw)).toBeGreaterThan(0.05);
  });
});

describe('resolvePlaneRollSnap', () => {
  it('maps L1 / R1 and C / V', () => {
    expect(resolvePlaneRollSnap({ keysDown: new Set(['c']) })).toBe(-1);
    expect(resolvePlaneRollSnap({ keysDown: new Set(['v']) })).toBe(1);

    const buttons = Array.from({ length: 8 }, () => ({ pressed: false, value: 0 }));
    buttons[GP.L1] = { pressed: true, value: 1 };
    expect(
      resolvePlaneRollSnap({ gamepads: [{ connected: true, buttons }] })
    ).toBe(-1);

    buttons[GP.L1] = { pressed: false, value: 0 };
    buttons[GP.R1] = { pressed: true, value: 1 };
    expect(
      resolvePlaneRollSnap({ gamepads: [{ connected: true, buttons }] })
    ).toBe(1);
  });
});
