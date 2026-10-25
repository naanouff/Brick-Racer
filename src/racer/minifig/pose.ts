/**
 * @file pose.ts
 * @description Default / authored minifig joint angles (BRICK-MF2d).
 *
 * Sign conventions (gl-matrix fromEuler, right-handed, +Z = figure front):
 * - shoulder x < 0 swings the arm forward; shoulderR z > 0 / shoulderL z < 0 swing it outward.
 * - wristR y < 0 / wristL y > 0 turn the clip axis toward the body.
 */

import { quat } from 'gl-matrix';
import type { Quat } from '../levels/shared/levelTypes';

/** Euler XYZ in degrees (applied as gl-matrix fromEuler). */
export type EulerDeg = { x: number; y: number; z: number };

export type MinifigPose = {
  neck?: EulerDeg;
  shoulderL?: EulerDeg;
  shoulderR?: EulerDeg;
  wristL?: EulerDeg;
  wristR?: EulerDeg;
  hipL?: EulerDeg;
  hipR?: EulerDeg;
};

export type MinifigPoseJoint = keyof MinifigPose;

const ZERO: EulerDeg = { x: 0, y: 0, z: 0 };

/** Neutral standing: arms slightly forward and out, hands turned inward. */
export const DEFAULT_POSE: MinifigPose = {
  neck: ZERO,
  shoulderL: { x: -8, y: 0, z: -10 },
  shoulderR: { x: -8, y: 0, z: 10 },
  wristL: { x: 0, y: 20, z: 0 },
  wristR: { x: 0, y: -20, z: 0 },
  hipL: ZERO,
  hipR: ZERO,
};

/** Every joint at identity — pivots match `computePivots()` exactly. */
export const REST_POSE: MinifigPose = {
  neck: ZERO,
  shoulderL: ZERO,
  shoulderR: ZERO,
  wristL: ZERO,
  wristR: ZERO,
  hipL: ZERO,
  hipR: ZERO,
};

export function eulerDegToQuat(e: EulerDeg | undefined): Quat {
  if (!e) return [0, 0, 0, 1];
  const q = quat.create();
  quat.fromEuler(q, e.x, e.y, e.z);
  return [q[0], q[1], q[2], q[3]];
}

export function mergePose(base: MinifigPose, overlay?: MinifigPose | null): MinifigPose {
  if (!overlay) return { ...base };
  return {
    neck: overlay.neck ?? base.neck,
    shoulderL: overlay.shoulderL ?? base.shoulderL,
    shoulderR: overlay.shoulderR ?? base.shoulderR,
    wristL: overlay.wristL ?? base.wristL,
    wristR: overlay.wristR ?? base.wristR,
    hipL: overlay.hipL ?? base.hipL,
    hipR: overlay.hipR ?? base.hipR,
  };
}
