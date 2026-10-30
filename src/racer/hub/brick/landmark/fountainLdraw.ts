/**
 * @file fountainLdraw.ts
 * @description Wide park fountain from the reference photo. Native LDraw scale.
 *
 * Y is down. Origin = top centre of the round floor. Feet (plate bottom) on y = 0.
 * Meshes use the `origin` axis map (game = LDraw X, −Y, −Z).
 * The upper dish is turned 180° about X so the bowl opens upward.
 * Bottles used as jets lean outward; their neck is game +Y.
 */

import { quat, vec3 } from 'gl-matrix';
import type { Quat } from '../../../levels/shared/levelTypes';
import { eulerDegToQuat, type EulerDeg } from '../../../minifig/pose';
import { P, S } from '../brickUnits';

const LDU_PER_STUD = 20;
const LDU_PER_PLATE = 8;

/** Bottom of a plate whose origin sits on the assembly y = 0 plane. */
const PLATE_BOTTOM_LDU = 8;
/** Brick underside meets that plane. */
const ON_PLATE_LDU = -24;
const BRICK_LDU = 24;

/** Lip sits just outside the 6177 floor (radius 80 LDU). */
const LIP_R = 96;
const WALL_R = 100;
const FLOWER_R = 128;

export type FountainLdrawRole =
  | 'base'
  | 'wall'
  | 'flower'
  | 'water'
  | 'pillar'
  | 'basin'
  | 'jet'
  | 'ornament';

export type FountainColor =
  | 'dark_gray'
  | 'gray'
  | 'sand'
  | 'cyan'
  | 'clear'
  | 'green'
  | 'red'
  | 'yellow';

export type FountainLdrawPart = {
  ldrawId: string;
  colorId: FountainColor;
  role: FountainLdrawRole;
  /** LDraw units, Y down. */
  ldu: readonly [number, number, number];
  euler?: EulerDeg;
  /** Lean the part's up axis (+Y in game) outward. `angle` is the LDraw XZ angle. */
  lean?: { angle: number; tilt: number };
};

const BOWL_UP: EulerDeg = { x: 180, y: 0, z: 0 };

function at(radius: number, angle: number, y: number): readonly [number, number, number] {
  return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
}

/** Point game +Y toward an outward, upward direction. */
function leanNeckOut(angle: number, tiltDeg: number): Quat {
  const tilt = (tiltDeg * Math.PI) / 180;
  const from = vec3.fromValues(0, 1, 0);
  const to = vec3.fromValues(
    Math.cos(angle) * Math.sin(tilt),
    Math.cos(tilt),
    -Math.sin(angle) * Math.sin(tilt)
  );
  const q = quat.create();
  quat.rotationTo(q, from, to);
  return [q[0], q[1], q[2], q[3]];
}

const SEGMENTS = 12;

function rim(): FountainLdrawPart[] {
  const out: FountainLdrawPart[] = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const a = (i * 2 * Math.PI) / SEGMENTS;
    const yaw = (a * 180) / Math.PI + 90;
    const tangent: EulerDeg = { x: 0, y: yaw, z: 0 };
    out.push({
      ldrawId: '3023',
      colorId: 'dark_gray',
      role: 'base',
      ldu: at(LIP_R, a, 0),
      euler: tangent,
    });
    const gray = i % 2 === 1;
    out.push({
      ldrawId: gray ? '37352' : '3004',
      colorId: gray ? 'gray' : 'sand',
      role: 'wall',
      ldu: at(WALL_R, a, ON_PLATE_LDU),
      euler: tangent,
    });
    if (gray) {
      out.push({
        ldrawId: '98138',
        colorId: 'gray',
        role: 'wall',
        ldu: at(WALL_R, a, ON_PLATE_LDU - LDU_PER_PLATE),
        euler: tangent,
      });
    }
  }
  return out;
}

function flowers(): FountainLdrawPart[] {
  const out: FountainLdrawPart[] = [];
  for (let i = 0; i < 4; i++) {
    const a = ((i + 0.5) * 2 * Math.PI) / 4;
    const yaw = (a * 180) / Math.PI;
    out.push({
      ldrawId: '32607',
      colorId: 'green',
      role: 'flower',
      ldu: at(FLOWER_R, a, -LDU_PER_PLATE),
      euler: { x: 0, y: yaw, z: 0 },
    });
    out.push({
      ldrawId: '33291',
      colorId: i % 2 === 0 ? 'red' : 'yellow',
      role: 'flower',
      ldu: at(FLOWER_R, a, -LDU_PER_PLATE * 2),
      euler: { x: 0, y: yaw, z: 0 },
    });
  }
  return out;
}

function water(): FountainLdrawPart[] {
  const out: FountainLdrawPart[] = [];
  const rings: readonly [number, number][] = [
    [30, 8],
    [52, 12],
    [68, 16],
  ];
  for (const [radius, count] of rings) {
    for (let i = 0; i < count; i++) {
      const a = (i * 2 * Math.PI) / count + radius * 0.01;
      out.push({
        ldrawId: '6141',
        colorId: i % 3 === 0 ? 'clear' : 'cyan',
        role: 'water',
        ldu: at(radius, a, -LDU_PER_PLATE),
      });
    }
  }
  return out;
}

function jets(): FountainLdrawPart[] {
  const out: FountainLdrawPart[] = [];
  const count = 6;
  for (let i = 0; i < count; i++) {
    const a = (i * 2 * Math.PI) / count + 0.2;
    out.push({
      ldrawId: '95228',
      colorId: 'clear',
      role: 'jet',
      ldu: at(48, a, ON_PLATE_LDU - BRICK_LDU),
      lean: { angle: a, tilt: 52 },
    });
  }
  return out;
}

const columnY = -LDU_PER_PLATE;
const brick1Y = columnY - BRICK_LDU;
const brick2Y = brick1Y - BRICK_LDU;

/** Wide basin, stepped column, bottle jets, upper bowl, dolphin. */
export const FOUNTAIN_LDRAW_PARTS: readonly FountainLdrawPart[] = [
  { ldrawId: '6177', colorId: 'dark_gray', role: 'base', ldu: [0, 0, 0] },
  ...rim(),
  ...flowers(),
  ...water(),
  { ldrawId: '60474', colorId: 'dark_gray', role: 'pillar', ldu: [0, columnY, 0] },
  { ldrawId: '3941', colorId: 'dark_gray', role: 'pillar', ldu: [0, brick1Y, 0] },
  { ldrawId: '3941', colorId: 'gray', role: 'pillar', ldu: [0, brick2Y, 0] },
  ...jets(),
  {
    ldrawId: '3960',
    colorId: 'gray',
    role: 'basin',
    ldu: [0, brick2Y, 0],
    euler: BOWL_UP,
  },
  {
    ldrawId: '95228',
    colorId: 'clear',
    role: 'ornament',
    ldu: [16, brick2Y - 48, 8],
  },
  {
    ldrawId: '95228',
    colorId: 'clear',
    role: 'ornament',
    ldu: [-14, brick2Y - 48, -10],
  },
  {
    ldrawId: '13392',
    colorId: 'cyan',
    role: 'ornament',
    ldu: [0, brick2Y, 0],
    euler: { x: 0, y: 25, z: 0 },
  },
];

/** Collision box (m) around the ground centre. Covers the lip and the dolphin. */
export const FOUNTAIN_LDRAW_SIZE: readonly [number, number, number] = [5.2, 2, 5.2];

export function fountainLdrawIds(): string[] {
  return [...new Set(FOUNTAIN_LDRAW_PARTS.map((p) => p.ldrawId))].sort();
}

/** Game metres. Plate bottom on y = 0. `origin` is the landmark centre on the ground. */
export function fountainLdrawGamePose(
  part: FountainLdrawPart,
  origin: readonly [number, number, number] = [0, 0, 0]
): { position: [number, number, number]; rotation: Quat } {
  const [lx, ly, lz] = part.ldu;
  const rotation = part.lean
    ? leanNeckOut(part.lean.angle, part.lean.tilt)
    : eulerDegToQuat(part.euler ?? { x: 0, y: 0, z: 0 });
  return {
    position: [
      origin[0] + lx * (S / LDU_PER_STUD),
      origin[1] + (PLATE_BOTTOM_LDU - ly) * (P / LDU_PER_PLATE),
      origin[2] - lz * (S / LDU_PER_STUD),
    ],
    rotation,
  };
}
