/**
 * @file hubPossession.test.ts
 * @description Pure hub enter / exit / drive gate (BRICK-H1a).
 */

import { afterEach, describe, expect, it } from 'vitest';
import { quat } from 'gl-matrix';
import {
  activateHubSession,
  arcadeGroundChassisName,
  chassisReceivesDrive,
  exitAvatarPosition,
  HUB_ENTER_RADIUS,
  HUB_EXIT_LATERAL,
  mountDismountDown,
  nearestEnterTarget,
  planeSimulationActive,
  resetHubSession,
  seatAvatarPosition,
  setHubPossession,
} from '../src/racer/hub/hubPossession';
import { AVATAR_CENTER_Y } from '../src/racer/levels/shared/collisionGroups';

const yaw0: [number, number, number, number] = [0, 0, 0, 1];

afterEach(() => {
  resetHubSession();
});

describe('hub possession math', () => {
  it('picks the closest chassis inside the enter radius', () => {
    const vehicles = [
      { kind: 'kart' as const, position: [20, 0.5, 14] as const },
      { kind: 'moto' as const, position: [14.5, 0.5, 14] as const },
      { kind: 'plane' as const, position: [24.5, 1.2, 14] as const },
    ];
    expect(nearestEnterTarget([20.4, 0.85, 14.2], vehicles)).toBe('kart');
    expect(nearestEnterTarget([15, 0.85, 14], vehicles)).toBe('moto');
    expect(nearestEnterTarget([0, 0.85, 0], vehicles)).toBeNull();
    expect(nearestEnterTarget([20 + HUB_ENTER_RADIUS + 0.05, 0.85, 14], vehicles)).toBeNull();
  });

  it('places the exit 1.6 m to the right, feet on the ground', () => {
    const exit = exitAvatarPosition([20, 0.55, 14], yaw0);
    expect(exit[0]).toBeCloseTo(20 + HUB_EXIT_LATERAL, 5);
    expect(exit[1]).toBe(AVATAR_CENTER_Y);
    expect(exit[2]).toBeCloseTo(14, 5);

    const q = quat.create();
    quat.rotateY(q, quat.create(), Math.PI / 2);
    const turned = exitAvatarPosition([0, 1, 0], [q[0], q[1], q[2], q[3]]);
    expect(turned[0]).toBeCloseTo(0, 4);
    expect(turned[2]).toBeCloseTo(-HUB_EXIT_LATERAL, 4);
  });

  it('puts the seat in chassis local space', () => {
    const seat = seatAvatarPosition([10, 2, 4], yaw0, 'kart');
    expect(seat[0]).toBeCloseTo(10, 5);
    expect(seat[1]).toBeCloseTo(2 + 1.2, 5);
    expect(seat[2]).toBeCloseTo(4 - 0.05, 5);
  });

  it('gates drive to the possessed chassis', () => {
    expect(chassisReceivesDrive('foot', 'KartChassis')).toBe(false);
    expect(chassisReceivesDrive('kart', 'KartChassis')).toBe(true);
    expect(chassisReceivesDrive('kart', 'MotoChassis')).toBe(false);
    expect(chassisReceivesDrive('moto', 'MotoChassis')).toBe(true);
    expect(chassisReceivesDrive('plane', 'PlaneChassis')).toBe(true);
  });

  it('reads F and gamepad Y', () => {
    expect(mountDismountDown({ keysDown: new Set(['f']) })).toBe(true);
    expect(mountDismountDown({ keysDown: new Set(['e']) })).toBe(false);
    expect(
      mountDismountDown({
        gamepads: [{ connected: true, buttons: [{}, {}, {}, { pressed: true }] }],
      })
    ).toBe(true);
  });
});

describe('hub possession session', () => {
  const spawns = {
    kart: { position: [20, 0.55, 14] as const, rotation: yaw0 },
    moto: { position: [14.5, 0.5, 14] as const, rotation: yaw0 },
    plane: { position: [24.5, 1.2, 14] as const, rotation: yaw0 },
  };

  it('starts in the kart and ignores the race URL until deactivated', () => {
    expect(arcadeGroundChassisName('moto')).toBe('MotoChassis');
    expect(planeSimulationActive('plane')).toBe(true);
    expect(planeSimulationActive('kart')).toBe(false);

    activateHubSession(spawns);
    expect(arcadeGroundChassisName('moto')).toBe('KartChassis');
    expect(planeSimulationActive('kart')).toBe(false);

    setHubPossession('foot');
    expect(arcadeGroundChassisName('kart')).toBeNull();
    expect(planeSimulationActive('plane')).toBe(false);

    setHubPossession('plane');
    expect(arcadeGroundChassisName('kart')).toBeNull();
    expect(planeSimulationActive('kart')).toBe(true);

    setHubPossession('moto');
    expect(arcadeGroundChassisName('plane')).toBe('MotoChassis');
  });
});
