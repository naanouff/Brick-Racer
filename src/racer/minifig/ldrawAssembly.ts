/**
 * @file ldrawAssembly.ts
 * @description Native LDraw minifig snap (MF2). No extra scale.
 *
 * Positions are the classic hip-origin assembly (LDU, Y-down), converted with
 * the `origin` axis map of `buildLdrawPreviewGeometry` (game = LDraw X, −Y, −Z),
 * then lifted so the feet (leg bottom, LDraw Y = 40) sit on y = 0.
 * The figure faces game +Z. Meshes must be anchor `origin`.
 */

import type { Quat } from '../levels/shared/levelTypes';
import { P, S } from '../hub/brick/brickUnits';
import { eulerDegToQuat } from './pose';

/** LDU per stud (X/Z) and per plate (Y). Matches ldrawGeometry. */
const LDU_PER_STUD = 20;
const LDU_PER_PLATE = 8;

/**
 * Lowest point of the assembled legs in LDraw Y (down), hip origin at 0.
 * 3816/3817 placed at Y=12, local max Y=28 → 40.
 */
export const MINIFIG_LDRAW_FEET_LDU = 40;

export type MinifigLdrawRole =
  | 'hips'
  | 'legL'
  | 'legR'
  | 'torso'
  | 'head'
  | 'armL'
  | 'armR'
  | 'handL'
  | 'handR'
  | 'hat';

/** Torso origin (shoulder plane). `973` bottom (local Y 32) rests on the `3815` top (Y 0). */
const TORSO_Y = -32;
/** Arm knob in the `973` holes: local (±15.528, 8.881, 0). */
const ARM_Y = TORSO_Y + 8.881;
/** `3818` hand hole mouth: local (−5, 18.9, −9.9), mirrored in X for `3819`. */
const HAND_Y = ARM_Y + 18.9;
const HAND_Z = -9.9;
/** `3626c` bottom (local Y 24) sits on the shoulders. The cap `4485` shares the head origin. */
const HEAD_Y = TORSO_Y - 24;

/** Classic assembly, LDraw units, Y-down, origin on the hips. */
export const MINIFIG_LDRAW_PLACEMENT_LDU: Record<
  MinifigLdrawRole,
  readonly [number, number, number]
> = {
  hips: [0, 0, 0],
  legL: [0, 12, 0],
  legR: [0, 12, 0],
  torso: [0, TORSO_Y, 0],
  head: [0, HEAD_Y, 0],
  armL: [15.528, ARM_Y, 0],
  armR: [-15.528, ARM_Y, 0],
  handL: [20.528, HAND_Y, HAND_Z],
  handR: [-20.528, HAND_Y, HAND_Z],
  hat: [0, HEAD_Y, 0],
};

const IDENTITY: Quat = [0, 0, 0, 1];
/**
 * The `3820` post runs along local +Z; the arm hole axis is (0, 1, −1)/√2 in LDraw.
 * That is +45° about X in LDraw, and the same in game space (the axis map is a turn about X).
 */
const HAND_IN_ARM: Quat = eulerDegToQuat({ x: 45, y: 0, z: 0 });

export function minifigLdrawRotation(role: MinifigLdrawRole): Quat {
  return role === 'handL' || role === 'handR' ? HAND_IN_ARM : IDENTITY;
}

/** Game metres, feet on y = 0, figure facing +Z. Scale is 1. */
export function minifigLdrawGamePosition(
  role: MinifigLdrawRole
): [number, number, number] {
  const [lx, ly, lz] = MINIFIG_LDRAW_PLACEMENT_LDU[role];
  return [
    lx * (S / LDU_PER_STUD),
    (MINIFIG_LDRAW_FEET_LDU - ly) * (P / LDU_PER_PLATE),
    -lz * (S / LDU_PER_STUD),
  ];
}

/**
 * Print rectangle (`printFrame`: minX, minY, sizeX, sizeY) in the `origin` mesh frame,
 * metres, Y-up. Only the head and torso carry prints.
 */
export function minifigLdrawPrintFrame(
  role: MinifigLdrawRole
): [number, number, number, number] | null {
  const sx = S / LDU_PER_STUD;
  const sy = P / LDU_PER_PLATE;
  // LDraw Y-down span [top, bottom] → game Y [−bottom, −top].
  const frame = (halfW: number, top: number, bottom: number): [number, number, number, number] => [
    -halfW * sx,
    -bottom * sy,
    2 * halfW * sx,
    (bottom - top) * sy,
  ];
  // `3626c`: radius 13, straight barrel Y 4..17 between rounded rims; stud above Y 0.
  if (role === 'head') return frame(13 * 0.92, 2, 19.5);
  // `973`: shoulders 28 wide at Y 0, hem at Y 32. Chest width keeps the print inside the taper.
  if (role === 'torso') return frame(14, 1, 1 + 32 * 0.92);
  return null;
}

/** Orbit / chase focus: mid torso of the native figure (metres, feet at 0). */
export function minifigLdrawFocusY(): number {
  // Torso mesh spans local LDraw Y −12..32; placement is the part origin.
  const midLocalLdu = (-12 + 32) / 2;
  const origin = minifigLdrawGamePosition('torso');
  return origin[1] - midLocalLdu * (P / LDU_PER_PLATE);
}
