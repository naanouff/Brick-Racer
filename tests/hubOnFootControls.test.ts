/**
 * @file hubOnFootControls.test.ts
 * @description Marche caméra-relative et orbite, sans les axes véhicule.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { quatYawY } from '../src/racer/levels/shared/staticBox';
import {
  addHubOrbit,
  cameraRelativePlanar,
  getHubOrbitPitch,
  getHubOrbitYaw,
  HUB_ORBIT_PITCH,
  orbitEye,
  readOnFootLookStick,
  readOnFootMove,
  resetHubOrbit,
  yawFromQuat,
} from '../src/racer/hub/hubOnFootControls';

afterEach(() => {
  resetHubOrbit();
});

describe('on-foot move', () => {
  it('uses ZQSD / WASD and ignores pad A and B', () => {
    const keys = new Set(['z', 'q']);
    expect(
      readOnFootMove({
        keysDown: keys,
        gamepads: [{ connected: true, buttons: [{ pressed: true }, { pressed: true }], axes: [0, 0] }],
      })
    ).toEqual({ forward: 1, strafe: -1 });
    expect(
      readOnFootMove({
        gamepads: [{ connected: true, buttons: [{ pressed: true }, { pressed: true }] }],
      })
    ).toEqual({ forward: 0, strafe: 0 });
  });

  it('maps the left stick, not the right stick', () => {
    expect(
      readOnFootMove({
        gamepads: [{ connected: true, axes: [0, -1, 1, 1] }],
      })
    ).toEqual({ forward: 1, strafe: 0 });
    expect(
      readOnFootMove({
        gamepads: [{ connected: true, axes: [1, 0.05, 0, 0] }],
      }).strafe
    ).toBe(1);
  });

  it('walks in the camera yaw, with strafe to the right', () => {
    expect(cameraRelativePlanar(0, 1, 0)).toEqual({ dx: 0, dz: 1 });
    expect(cameraRelativePlanar(0, 0, 1).dx).toBeCloseTo(-1);
    expect(cameraRelativePlanar(0, 0, 1).dz).toBeCloseTo(0);
    const turned = cameraRelativePlanar(Math.PI / 2, 1, 0);
    expect(turned.dx).toBeCloseTo(1);
    expect(turned.dz).toBeCloseTo(0);
  });
});

describe('on-foot orbit', () => {
  it('reads the right stick only', () => {
    expect(
      readOnFootLookStick({
        gamepads: [{ connected: true, axes: [1, -1, 0.4, -0.6] }],
      })
    ).toEqual({ yaw: 0.4, pitch: -0.6 });
    expect(readOnFootLookStick({ gamepads: [{ connected: true, axes: [1, 1, 0.05, 0] }] })).toEqual({
      yaw: 0,
      pitch: 0,
    });
  });

  it('places the eye behind the target and clamps pitch', () => {
    const q = quatYawY(Math.PI / 2);
    expect(yawFromQuat(q)).toBeCloseTo(Math.PI / 2);
    const eye = orbitEye([10, 1, 4], 0, 0, 4);
    expect(eye[0]).toBeCloseTo(10);
    expect(eye[1]).toBeCloseTo(1);
    expect(eye[2]).toBeCloseTo(0);
    addHubOrbit(0.2, 10);
    expect(getHubOrbitYaw()).toBeCloseTo(0.2);
    expect(getHubOrbitPitch()).toBeLessThan(1.2);
    expect(getHubOrbitPitch()).toBeGreaterThan(HUB_ORBIT_PITCH);
  });
});
