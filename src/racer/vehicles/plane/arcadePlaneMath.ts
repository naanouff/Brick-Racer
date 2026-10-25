/**
 * @file arcadePlaneMath.ts
 * @description Arcade flight attitude helpers (banked turns + knife-edge).
 */

import { quat, vec3 } from 'gl-matrix';
import { clamp } from '../kart/arcade/arcadeKartMath';

export const PLANE_MAX_BANK = 0.95; // ~54° stick bank
export const PLANE_KNIFE_ROLL = Math.PI * 0.5; // ±90° wings vertical
export const PLANE_MAX_PITCH = 0.65;
export const PLANE_BANK_RESP = 6;
export const PLANE_PITCH_RESP = 5;
export const PLANE_KNIFE_RESP = 10;
export const PLANE_TURN_RATE = 2.1; // yaw rad/s at full bank

const _fwd = vec3.create();
const _localFwd = vec3.fromValues(0, 0, 1);

export type PlaneAttitude = {
  yaw: number;
  pitch: number;
  roll: number;
};

/** Yaw (Y) → pitch (X) → roll (Z) — nose +Z, wings ±X. */
export function attitudeToQuat(out: quat, att: PlaneAttitude): quat {
  quat.identity(out);
  quat.rotateY(out, out, att.yaw);
  quat.rotateX(out, out, att.pitch);
  quat.rotateZ(out, out, att.roll);
  quat.normalize(out, out);
  return out;
}

export function forwardFromAttitude(out: vec3, att: PlaneAttitude, q: quat): vec3 {
  attitudeToQuat(q, att);
  vec3.transformQuat(out, _localFwd, q);
  if (vec3.sqrLen(out) > 1e-8) vec3.normalize(out, out);
  return out;
}

/**
 * Target roll (rad). L1/R1 knife-edge OK; stick X inverted vs input axis (playtest).
 */
export function targetRoll(steer: number, rollSnap: number, maxBank = PLANE_MAX_BANK): number {
  if (rollSnap < -0.5) return PLANE_KNIFE_ROLL;
  if (rollSnap > 0.5) return -PLANE_KNIFE_ROLL;
  return -clamp(steer, -1, 1) * maxBank;
}

export function targetPitch(climb: number, maxPitch = PLANE_MAX_PITCH): number {
  return clamp(climb, -1, 1) * maxPitch;
}

/** Exponential approach toward target (framerate-independent). */
export function approachAngle(current: number, target: number, resp: number, dt: number): number {
  const t = 1 - Math.exp(-resp * dt);
  return current + (target - current) * t;
}

/**
 * Coordinated turn: bank pulls the nose around (no ground-vehicle yaw).
 * Full knife-edge still yaws so L/R vertical can carve.
 */
export function yawDeltaFromBank(roll: number, speed: number, dt: number, turnRate = PLANE_TURN_RATE): number {
  const speedFactor = clamp(Math.abs(speed) / 12, 0.35, 1.35);
  return Math.sin(roll) * turnRate * speedFactor * dt;
}

export function stepPlaneAttitude(
  att: PlaneAttitude,
  opts: {
    steer: number;
    climb: number;
    rollSnap: number;
    speed: number;
    dt: number;
  }
): void {
  const knife = Math.abs(opts.rollSnap) > 0.5;
  const rollT = targetRoll(opts.steer, opts.rollSnap);
  const pitchT = targetPitch(opts.climb);
  att.roll = approachAngle(
    att.roll,
    rollT,
    knife ? PLANE_KNIFE_RESP : PLANE_BANK_RESP,
    opts.dt
  );
  att.pitch = approachAngle(att.pitch, pitchT, PLANE_PITCH_RESP, opts.dt);
  att.yaw += yawDeltaFromBank(att.roll, opts.speed, opts.dt);
}
