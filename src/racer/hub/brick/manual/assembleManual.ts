/**
 * @file assembleManual.ts
 * @description Expand brick manual macros → BrickPose[] + occupancy grid.
 */

import type { BrickPose } from '../brickCatalog';
import {
  formatManualIssues,
  validateManual,
  type BrickManual,
  type ManualOp,
} from './manualSchema';
import {
  cellKey,
  envelopeHalfCells,
  gridMinToWorldCenter,
  rotatedFootprint,
  rotToYawRad,
  type RotDeg,
} from './partFootprint';

export type AssembledBrick = {
  pose: BrickPose;
  /** Occupied cells (stud, plate, stud) relative to origin. */
  cells: Array<[number, number, number]>;
};

export type AssembleManualResult = {
  manual: BrickManual;
  bricks: AssembledBrick[];
  poses: BrickPose[];
  occupancy: Set<string>;
};

export class ManualAssembleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ManualAssembleError';
  }
}

function occupyBrick(
  occupancy: Set<string>,
  sx: number,
  py: number,
  sz: number,
  partId: AssembledBrick['pose']['partId'],
  rot: RotDeg
): Array<[number, number, number]> {
  const [fx, fy, fz] = rotatedFootprint(partId, rot);
  const cells: Array<[number, number, number]> = [];
  for (let dx = 0; dx < fx; dx++) {
    for (let dy = 0; dy < fy; dy++) {
      for (let dz = 0; dz < fz; dz++) {
        const c: [number, number, number] = [sx + dx, py + dy, sz + dz];
        const k = cellKey(c[0], c[1], c[2]);
        if (occupancy.has(k)) {
          throw new ManualAssembleError(`overlap at cell ${k}`);
        }
        occupancy.add(k);
        cells.push(c);
      }
    }
  }
  return cells;
}

function assertInEnvelope(
  manual: BrickManual,
  sx: number,
  py: number,
  sz: number,
  partId: AssembledBrick['pose']['partId'],
  rot: RotDeg
): void {
  const { halfStudX, halfStudZ, maxPlateY } = envelopeHalfCells(manual.envelope.size);
  const [fx, fy, fz] = rotatedFootprint(partId, rot);
  if (sx < -halfStudX || sx + fx > halfStudX + 1) {
    throw new ManualAssembleError(`outside envelope X at stud ${sx} (part ${partId})`);
  }
  if (sz < -halfStudZ || sz + fz > halfStudZ + 1) {
    throw new ManualAssembleError(`outside envelope Z at stud ${sz} (part ${partId})`);
  }
  if (py < 0 || py + fy > maxPlateY + 1) {
    throw new ManualAssembleError(`outside envelope Y at plate ${py} (part ${partId})`);
  }
}

function placeBrick(
  manual: BrickManual,
  bricks: AssembledBrick[],
  occupancy: Set<string>,
  partId: AssembledBrick['pose']['partId'],
  colorId: AssembledBrick['pose']['colorId'],
  sx: number,
  py: number,
  sz: number,
  rot: RotDeg = 0
): void {
  assertInEnvelope(manual, sx, py, sz, partId, rot);
  const cells = occupyBrick(occupancy, sx, py, sz, partId, rot);
  const position = gridMinToWorldCenter(manual.origin, sx, py, sz, partId, rot);
  bricks.push({
    pose: { partId, colorId, position, yaw: rotToYawRad(rot) },
    cells,
  });
}

function nearestRotDeg(yawRad: number): RotDeg {
  const deg = Math.round(((yawRad * 180) / Math.PI) / 90) * 90;
  const n = ((deg % 360) + 360) % 360;
  if (n === 90) return 90;
  if (n === 180) return 180;
  if (n === 270) return 270;
  return 0;
}

function expandOp(manual: BrickManual, bricks: AssembledBrick[], occupancy: Set<string>, op: ManualOp): void {
  switch (op.op) {
    case 'brick': {
      placeBrick(manual, bricks, occupancy, op.part, op.color, op.at[0], op.at[1], op.at[2], op.rot ?? 0);
      break;
    }
    case 'ring': {
      // Place part centers on the circle (min-corner = center − half footprint).
      const courses = op.courses ?? 1;
      const [fx0, fy, fz0] = rotatedFootprint(op.part, 0);
      const span = Math.max(fx0, fz0, 1);
      const count = op.count ?? Math.max(8, Math.round((2 * Math.PI * op.radius) / span));
      for (let c = 0; c < courses; c++) {
        const y = op.y + c * fy;
        const seen = new Set<string>();
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2;
          // Tangential yaw so 1x2 / plates follow the circumference.
          const r = nearestRotDeg(a + Math.PI / 2);
          const [rx, , rz] = rotatedFootprint(op.part, r);
          const sx = Math.round(Math.cos(a) * op.radius - rx * 0.5);
          const sz = Math.round(Math.sin(a) * op.radius - rz * 0.5);
          const key = `${sx},${y},${sz},${r}`;
          if (seen.has(key)) continue;
          seen.add(key);
          try {
            placeBrick(manual, bricks, occupancy, op.part, op.color, sx, y, sz, r);
          } catch (e) {
            if (e instanceof ManualAssembleError && e.message.startsWith('overlap')) continue;
            throw e;
          }
        }
      }
      break;
    }
    case 'disc': {
      const [fx, , fz] = rotatedFootprint(op.part, 0);
      const stepX = Math.max(1, fx);
      const stepZ = Math.max(1, fz);
      const r2 = op.radius * op.radius;
      const inner =
        typeof op.innerRadius === 'number'
          ? op.innerRadius
          : op.filled === false
            ? Math.max(0, op.radius - 1.2)
            : 0;
      const inner2 = inner * inner;
      const n = Math.ceil(op.radius);
      for (let ix = -n; ix <= n; ix += stepX) {
        for (let iz = -n; iz <= n; iz += stepZ) {
          const cx = ix + stepX * 0.5;
          const cz = iz + stepZ * 0.5;
          const d2 = cx * cx + cz * cz;
          if (d2 > r2 || d2 < inner2 - 1e-6) continue;
          try {
            placeBrick(manual, bricks, occupancy, op.part, op.color, ix, op.y, iz, 0);
          } catch (e) {
            if (e instanceof ManualAssembleError && e.message.startsWith('overlap')) continue;
            throw e;
          }
        }
      }
      break;
    }
    case 'wall': {
      const courses = op.heightCourses ?? 1;
      const [fx, fy, fz] = rotatedFootprint(op.part, op.rot ?? 0);
      const dx = Math.sign(op.to[0] - op.from[0]) || 0;
      const dz = Math.sign(op.to[1] - op.from[1]) || 0;
      const step = dx !== 0 ? Math.max(1, fx) : Math.max(1, fz);
      let x = op.from[0];
      let z = op.from[1];
      const guard = 64;
      for (let i = 0; i < guard; i++) {
        for (let c = 0; c < courses; c++) {
          placeBrick(manual, bricks, occupancy, op.part, op.color, x, op.y + c * fy, z, op.rot ?? 0);
        }
        if (x === op.to[0] && z === op.to[1]) break;
        x += dx * step;
        z += dz * step;
      }
      break;
    }
    case 'box': {
      const rot = op.rot ?? 0;
      const [fx, fy, fz] = rotatedFootprint(op.part, rot);
      for (let py = op.min[1]; py <= op.max[1] - fy + 1; py += fy) {
        for (let sx = op.min[0]; sx <= op.max[0] - fx + 1; sx += fx) {
          for (let sz = op.min[2]; sz <= op.max[2] - fz + 1; sz += fz) {
            placeBrick(manual, bricks, occupancy, op.part, op.color, sx, py, sz, rot);
          }
        }
      }
      break;
    }
    default: {
      const _e: never = op;
      void _e;
    }
  }
}

/** Validate + expand a manual (or raw JSON) into poses. */
export function assembleManual(raw: unknown): AssembleManualResult {
  const validated = validateManual(raw);
  if (!validated.ok) {
    throw new ManualAssembleError(formatManualIssues(validated.issues));
  }
  const manual = validated.manual;
  const bricks: AssembledBrick[] = [];
  const occupancy = new Set<string>();
  for (const step of manual.steps) {
    for (const op of step.ops) {
      expandOp(manual, bricks, occupancy, op);
    }
  }
  if (bricks.length === 0) {
    throw new ManualAssembleError('assembly produced zero bricks');
  }
  return {
    manual,
    bricks,
    poses: bricks.map((b) => b.pose),
    occupancy,
  };
}
