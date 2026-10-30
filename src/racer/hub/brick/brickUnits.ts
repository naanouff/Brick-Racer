/**
 * @file brickUnits.ts
 * @description Brick grid units (canon test-slice-plans: 1S = 0.33 m).
 */

/** 1 stud — horizontal module (m). */
export const S = 0.33;
/** 1 plate — vertical thin (m). */
export const P = S / 3;
/** 1 brick height = 3 plates (m). */
export const B = S;

export function snapStud(v: number): number {
  return Math.round(v / S) * S;
}

export function snapPlate(v: number): number {
  return Math.round(v / P) * P;
}

/** Snap XZ to stud grid; Y to plate grid. */
export function snapBrickPosition(x: number, y: number, z: number): [number, number, number] {
  return [snapStud(x), snapPlate(y), snapStud(z)];
}
