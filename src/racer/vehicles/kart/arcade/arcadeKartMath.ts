/**
 * @file arcadeKartMath.ts
 * @description Pure arcade step helpers (unit-testable).
 */

import type { ArcadeKartProfile } from './arcadeKartProfile';
import type { ArcadeKartState, DriftCharge } from './arcadeKartState';
import { driftChargeLevel } from './arcadeKartState';

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Longitudinal accel toward ±vmax with soft knee. */
export function stepLongitudinal(
  vLong: number,
  throttle: number,
  profile: ArcadeKartProfile,
  boosting: boolean,
  dt: number
): number {
  const vmaxBase = boosting ? profile.maxSpeed * profile.boostSpeedMul : profile.maxSpeed;
  const a0 = boosting ? profile.accel * profile.boostAccelMul : profile.accel;

  if (throttle > 0.05) {
    const target = vmaxBase;
    const ratio = clamp(vLong / target, 0, 1.2);
    const a = a0 * Math.pow(Math.max(0, 1 - ratio), 0.6);
    return vLong + a * throttle * dt;
  }
  if (throttle < -0.05) {
    if (vLong > 0.5) {
      return vLong - profile.brake * Math.abs(throttle) * dt;
    }
    const target = -profile.reverseMax;
    const a = a0 * 0.55;
    return Math.max(target, vLong + a * throttle * dt);
  }
  if (vLong > 0) return Math.max(0, vLong - profile.coast * dt);
  if (vLong < 0) return Math.min(0, vLong + profile.coast * dt);
  return 0;
}

export function stepLateral(vLat: number, grip: number, dt: number): number {
  const keep = Math.exp(-grip * dt);
  return vLat * keep;
}

export function yawRateForSpeed(speed: number, profile: ArcadeKartProfile): number {
  const vmax = profile.maxSpeed;
  const n = clamp(speed / Math.max(1, vmax), 0, 1);
  // Deadzone near stop — no spin-in-place
  if (speed < 1.2) return profile.yawRate * (speed / 1.2) * 0.35;
  const mid = profile.yawRate;
  const top = profile.yawRate * profile.yawSpeedMul * 0.72;
  return mid + (top - mid) * n;
}

export function stepYaw(
  steer: number,
  speed: number,
  profile: ArcadeKartProfile,
  drifting: boolean,
  driftDir: number,
  dt: number
): number {
  let s = steer;
  if (drifting) {
    // Lock bias toward drift side; steer modulates angle
    s = clamp(driftDir * 0.55 + steer * 0.7, -1, 1);
  }
  // Match W3DTS: positive steer (D / moveRight) → negative yaw (turn toward -X).
  return -s * yawRateForSpeed(Math.abs(speed), profile) * dt;
}

export type DriftStepInput = {
  wantDrift: boolean;
  steer: number;
  speed: number;
  grounded: boolean;
  state: ArcadeKartState;
  dt: number;
};

export type DriftStepResult = {
  hopVy: number;
  releasedCharge: DriftCharge;
};

export function stepDrift(input: DriftStepInput): DriftStepResult {
  const { wantDrift, steer, speed, grounded, state, dt } = input;
  const p = state.profile;
  let hopVy = 0;
  let released: DriftCharge = 'none';

  if (
    wantDrift &&
    grounded &&
    !state.drifting &&
    speed >= p.driftMinSpeed &&
    Math.abs(steer) > 0.2
  ) {
    state.drifting = true;
    state.driftDir = Math.sign(steer) || 1;
    state.driftTime = 0;
    hopVy = p.driftHop;
  }

  if (state.drifting) {
    if (!wantDrift || !grounded || speed < p.driftMinSpeed * 0.55) {
      released = driftChargeLevel(state);
      state.drifting = false;
      state.driftTime = 0;
      state.driftDir = 0;
    } else {
      state.driftTime += dt;
      if (Math.abs(steer) > 0.15) {
        state.driftDir = Math.sign(steer) || state.driftDir;
      }
    }
  }

  return { hopVy, releasedCharge: released };
}

export function boostDurationForCharge(
  charge: DriftCharge,
  profile: ArcadeKartProfile
): number {
  if (charge === 'orange') return profile.miniTurboOrange;
  if (charge === 'blue') return profile.miniTurboBlue;
  return 0;
}
