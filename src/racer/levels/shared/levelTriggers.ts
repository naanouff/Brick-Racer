/**
 * @file levelTriggers.ts
 * @description Boost / ring volumes + spawn reset pose for arcade kart (BO1g).
 */

import type { Quat, Vec3 } from './levelTypes';

export type LevelTriggerKind = 'boost' | 'ring';

export type LevelTrigger = {
  id: string;
  kind: LevelTriggerKind;
  center: Vec3;
  /** Half-extents of the OBB (local axes after yaw). */
  halfExtents: Vec3;
  /** Yaw around Y (radians). */
  yaw: number;
};

export type LevelSpawnPose = {
  position: Vec3;
  /** Quaternion (x,y,z,w). */
  rotation: Quat;
};

/** Point-in-yawed AABB (XZ yaw only). */
export function pointInTrigger(point: Vec3, trigger: LevelTrigger): boolean {
  const dx = point[0] - trigger.center[0];
  const dy = point[1] - trigger.center[1];
  const dz = point[2] - trigger.center[2];
  const c = Math.cos(-trigger.yaw);
  const s = Math.sin(-trigger.yaw);
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  const [hx, hy, hz] = trigger.halfExtents;
  return Math.abs(lx) <= hx && Math.abs(dy) <= hy && Math.abs(lz) <= hz;
}
