/**
 * @file sockets.ts
 * @description Slot / pivot offsets derived from dimensions.ts (BRICK-MF2a).
 */

import type { Vec3 } from '../levels/shared/levelTypes';
import { computePivots } from './dimensions';
import type { MinifigPartSlot } from './types';

const P = computePivots();

/** World offsets relative to minifig root (feet on ground ≈ y=0). */
export const MINIFIG_SOCKETS: Record<MinifigPartSlot, Vec3> = {
  hipsLegs: [...P.hips],
  torso: [...P.torso],
  arms: [0, P.shoulderR[1], 0],
  hands: [0, P.handR[1], P.handR[2]],
  head: [...P.head],
  hat: [...P.hat],
  hair: [P.head[0], P.head[1] + 0.2, P.head[2]],
  accessoryL: [...P.accessoryL],
  accessoryR: [...P.accessoryR],
};

/** Articulation pivots (local to root). */
export const MINIFIG_PIVOTS = {
  hips: P.hips,
  hipL: P.hipL,
  hipR: P.hipR,
  torso: P.torso,
  neck: P.neck,
  head: P.head,
  hat: P.hat,
  shoulderL: P.shoulderL,
  shoulderR: P.shoulderR,
  wristL: P.wristL,
  wristR: P.wristR,
  handL: P.handL,
  handR: P.handR,
} as const;

/** Lateral offsets for paired arm / hand proxies. */
export const ARM_LATERAL = P.armLateral;
export const HAND_LATERAL = P.handLateral;
