/**
 * @file partFootprint.ts
 * @description Stud×plate occupancy for catalogue parts (manual assemble / shell bake).
 */

import type { BrickPartId } from '../brickCatalog';
import { B, P, S } from '../brickUnits';

export type RotDeg = 0 | 90 | 180 | 270;

/** Footprint in studs (X) × plates (Y) × studs (Z) at rot 0. */
export function partFootprintPlates(partId: BrickPartId): [number, number, number] {
  switch (partId) {
    case '1x1':
      return [1, 3, 1];
    case '1x2':
      return [1, 3, 2];
    case '2x2':
      return [2, 3, 2];
    case '2x4':
      return [2, 3, 4];
    case 'plate':
      return [2, 1, 4];
    case 'tile':
      return [2, 1, 2];
    default: {
      const _e: never = partId;
      return _e;
    }
  }
}

/** Apply yaw: swap X/Z for 90/270. */
export function rotatedFootprint(
  partId: BrickPartId,
  rot: RotDeg = 0
): [number, number, number] {
  const [sx, py, sz] = partFootprintPlates(partId);
  if (rot === 90 || rot === 270) return [sz, py, sx];
  return [sx, py, sz];
}

export function isRotDeg(v: unknown): v is RotDeg {
  return v === 0 || v === 90 || v === 180 || v === 270;
}

export function rotToYawRad(rot: RotDeg = 0): number {
  return (rot * Math.PI) / 180;
}

/** World-space center (m) from integer grid min corner. */
export function gridMinToWorldCenter(
  origin: readonly [number, number, number],
  sx: number,
  py: number,
  sz: number,
  partId: BrickPartId,
  rot: RotDeg = 0
): [number, number, number] {
  const [fx, fy, fz] = rotatedFootprint(partId, rot);
  return [
    origin[0] + (sx + fx * 0.5) * S,
    origin[1] + (py + fy * 0.5) * P,
    origin[2] + (sz + fz * 0.5) * S,
  ];
}

/** Half extents of envelope in studs / plates (from size meters). */
export function envelopeHalfCells(sizeM: readonly [number, number, number]): {
  halfStudX: number;
  halfStudZ: number;
  maxPlateY: number;
} {
  // ceil so Ø 3 m (≈4.55 S) admits an outer ring at radius 4 studs.
  return {
    halfStudX: Math.ceil(sizeM[0] / (2 * S) - 1e-9),
    halfStudZ: Math.ceil(sizeM[2] / (2 * S) - 1e-9),
    maxPlateY: Math.floor(sizeM[1] / P + 1e-6),
  };
}

export function cellKey(sx: number, py: number, sz: number): string {
  return `${sx},${py},${sz}`;
}

export { B, P, S };
