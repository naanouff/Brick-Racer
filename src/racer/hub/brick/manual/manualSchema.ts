/**
 * @file manualSchema.ts
 * @description Brick assembly manual types + validateManual (BW1 authoring).
 */

import {
  BRICK_COLOR_IDS,
  BRICK_PART_IDS,
  type BrickColorId,
  type BrickPartId,
} from '../brickCatalog';
import { envelopeHalfCells, isRotDeg, rotatedFootprint, type RotDeg } from './partFootprint';

export type ManualVec3 = [number, number, number];

export type ManualPartsListEntry = {
  part: BrickPartId;
  color: BrickColorId;
  qty: number;
};

export type ManualBrickOp = {
  op: 'brick';
  part: BrickPartId;
  color: BrickColorId;
  at: ManualVec3;
  rot?: RotDeg;
};

export type ManualRingOp = {
  op: 'ring';
  part: BrickPartId;
  color: BrickColorId;
  radius: number;
  y: number;
  courses?: number;
  count?: number;
};

export type ManualDiscOp = {
  op: 'disc';
  part: BrickPartId;
  color: BrickColorId;
  radius: number;
  y: number;
  /** Default true. When false (or when `innerRadius` set), keeps a hollow annulus. */
  filled?: boolean;
  /** Studs — disc keeps cells with innerRadius ≤ r ≤ radius (overrides filled). */
  innerRadius?: number;
};

export type ManualWallOp = {
  op: 'wall';
  part: BrickPartId;
  color: BrickColorId;
  from: [number, number];
  to: [number, number];
  y: number;
  heightCourses?: number;
  rot?: RotDeg;
};

export type ManualBoxOp = {
  op: 'box';
  part: BrickPartId;
  color: BrickColorId;
  min: ManualVec3;
  max: ManualVec3;
  rot?: RotDeg;
};

export type ManualOp =
  | ManualBrickOp
  | ManualRingOp
  | ManualDiscOp
  | ManualWallOp
  | ManualBoxOp;

export type ManualStep = {
  title: string;
  ops: ManualOp[];
};

export type BrickManual = {
  id: string;
  version: number;
  title?: string;
  origin: ManualVec3;
  envelope: { size: ManualVec3 };
  partsList?: ManualPartsListEntry[];
  steps: ManualStep[];
};

export type ManualValidationIssue = {
  path: string;
  message: string;
};

export type ManualValidationResult =
  | { ok: true; manual: BrickManual }
  | { ok: false; issues: ManualValidationIssue[] };

const PART_SET = new Set<string>(BRICK_PART_IDS);
const COLOR_SET = new Set<string>(BRICK_COLOR_IDS);

function isInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && Number.isInteger(n);
}

function isNum(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function isPart(v: unknown): v is BrickPartId {
  return typeof v === 'string' && PART_SET.has(v);
}

function isColor(v: unknown): v is BrickColorId {
  return typeof v === 'string' && COLOR_SET.has(v);
}

function isVec3(v: unknown): v is ManualVec3 {
  return Array.isArray(v) && v.length === 3 && v.every(isNum);
}

function isIntVec3(v: unknown): v is ManualVec3 {
  return Array.isArray(v) && v.length === 3 && v.every(isInt);
}

function pushIssue(issues: ManualValidationIssue[], path: string, message: string): void {
  issues.push({ path, message });
}

function validateOp(op: unknown, path: string, issues: ManualValidationIssue[]): void {
  if (!op || typeof op !== 'object') {
    pushIssue(issues, path, 'op must be an object');
    return;
  }
  const o = op as Record<string, unknown>;
  const kind = o.op;
  if (typeof kind !== 'string') {
    pushIssue(issues, `${path}.op`, 'missing op');
    return;
  }

  const needPartColor = (): void => {
    if (!isPart(o.part)) pushIssue(issues, `${path}.part`, `unknown part '${String(o.part)}'`);
    if (!isColor(o.color)) pushIssue(issues, `${path}.color`, `unknown color '${String(o.color)}'`);
    if (o.rot !== undefined && !isRotDeg(o.rot)) {
      pushIssue(issues, `${path}.rot`, 'rot must be 0|90|180|270');
    }
  };

  switch (kind) {
    case 'brick':
      needPartColor();
      if (!isIntVec3(o.at)) pushIssue(issues, `${path}.at`, 'at must be [sx,py,sz] integers');
      break;
    case 'ring':
      needPartColor();
      if (!isNum(o.radius) || o.radius <= 0) pushIssue(issues, `${path}.radius`, 'radius > 0');
      if (!isInt(o.y)) pushIssue(issues, `${path}.y`, 'y must be integer plates');
      if (o.courses !== undefined && (!isInt(o.courses) || o.courses < 1)) {
        pushIssue(issues, `${path}.courses`, 'courses >= 1');
      }
      if (o.count !== undefined && (!isInt(o.count) || o.count < 3)) {
        pushIssue(issues, `${path}.count`, 'count >= 3');
      }
      break;
    case 'disc':
      needPartColor();
      if (!isNum(o.radius) || o.radius <= 0) pushIssue(issues, `${path}.radius`, 'radius > 0');
      if (!isInt(o.y)) pushIssue(issues, `${path}.y`, 'y must be integer plates');
      if (o.innerRadius !== undefined) {
        if (!isNum(o.innerRadius) || o.innerRadius < 0) {
          pushIssue(issues, `${path}.innerRadius`, 'innerRadius >= 0');
        } else if (isNum(o.radius) && o.innerRadius >= o.radius) {
          pushIssue(issues, `${path}.innerRadius`, 'innerRadius < radius');
        }
      }
      break;
    case 'wall':
      needPartColor();
      if (!Array.isArray(o.from) || o.from.length !== 2 || !o.from.every(isInt)) {
        pushIssue(issues, `${path}.from`, 'from must be [sx,sz] integers');
      }
      if (!Array.isArray(o.to) || o.to.length !== 2 || !o.to.every(isInt)) {
        pushIssue(issues, `${path}.to`, 'to must be [sx,sz] integers');
      }
      if (!isInt(o.y)) pushIssue(issues, `${path}.y`, 'y must be integer plates');
      break;
    case 'box':
      needPartColor();
      if (!isIntVec3(o.min)) pushIssue(issues, `${path}.min`, 'min must be integers');
      if (!isIntVec3(o.max)) pushIssue(issues, `${path}.max`, 'max must be integers');
      if (isIntVec3(o.min) && isIntVec3(o.max)) {
        if (o.min[0] > o.max[0] || o.min[1] > o.max[1] || o.min[2] > o.max[2]) {
          pushIssue(issues, path, 'box min must be <= max on each axis');
        }
      }
      break;
    default:
      pushIssue(issues, `${path}.op`, `unknown op '${kind}'`);
  }
}

/**
 * Structural validation only (catalogue, ints, envelope bounds on brick corners).
 * Overlaps are checked during assembleManual.
 */
export function validateManual(raw: unknown): ManualValidationResult {
  const issues: ManualValidationIssue[] = [];
  if (!raw || typeof raw !== 'object') {
    return { ok: false, issues: [{ path: '', message: 'manual must be an object' }] };
  }
  const m = raw as Record<string, unknown>;

  if (typeof m.id !== 'string' || !m.id) pushIssue(issues, 'id', 'id required');
  if (!isInt(m.version) || m.version < 1) pushIssue(issues, 'version', 'version >= 1 integer');
  if (!isVec3(m.origin)) pushIssue(issues, 'origin', 'origin [x,y,z] meters');

  const env = m.envelope as { size?: unknown } | undefined;
  if (!env || !isVec3(env.size) || env.size.some((n) => n <= 0)) {
    pushIssue(issues, 'envelope.size', 'positive [sx,sy,sz] meters');
  }

  if (!Array.isArray(m.steps) || m.steps.length === 0) {
    pushIssue(issues, 'steps', 'at least one step');
  } else {
    m.steps.forEach((step, si) => {
      const sp = `steps[${si}]`;
      if (!step || typeof step !== 'object') {
        pushIssue(issues, sp, 'step must be object');
        return;
      }
      const s = step as Record<string, unknown>;
      if (typeof s.title !== 'string' || !s.title) pushIssue(issues, `${sp}.title`, 'title required');
      if (!Array.isArray(s.ops) || s.ops.length === 0) {
        pushIssue(issues, `${sp}.ops`, 'at least one op');
      } else {
        s.ops.forEach((op, oi) => validateOp(op, `${sp}.ops[${oi}]`, issues));
      }
    });
  }

  if (Array.isArray(m.partsList)) {
    m.partsList.forEach((e, i) => {
      const p = `partsList[${i}]`;
      if (!e || typeof e !== 'object') {
        pushIssue(issues, p, 'entry must be object');
        return;
      }
      const row = e as Record<string, unknown>;
      if (!isPart(row.part)) pushIssue(issues, `${p}.part`, `unknown part`);
      if (!isColor(row.color)) pushIssue(issues, `${p}.color`, `unknown color`);
      if (!isInt(row.qty) || row.qty < 1) pushIssue(issues, `${p}.qty`, 'qty >= 1');
    });
  }

  // Envelope bounds on explicit brick corners (macros checked after expand in assemble)
  if (isVec3(env?.size) && Array.isArray(m.steps)) {
    const { halfStudX, halfStudZ, maxPlateY } = envelopeHalfCells(env.size as ManualVec3);
    for (let si = 0; si < m.steps.length; si++) {
      const step = m.steps[si] as { ops?: unknown[] };
      if (!Array.isArray(step?.ops)) continue;
      step.ops.forEach((op, oi) => {
        if (!op || typeof op !== 'object') return;
        const o = op as ManualBrickOp;
        if (o.op !== 'brick' || !isIntVec3(o.at) || !isPart(o.part)) return;
        const rot = (o.rot ?? 0) as RotDeg;
        if (!isRotDeg(rot) && o.rot !== undefined) return;
        const [fx, fy, fz] = rotatedFootprint(o.part, isRotDeg(o.rot) ? o.rot : 0);
        const [sx, py, sz] = o.at;
        if (sx < -halfStudX || sx + fx > halfStudX + 1) {
          pushIssue(issues, `steps[${si}].ops[${oi}]`, `brick X outside envelope (±${halfStudX} studs)`);
        }
        if (sz < -halfStudZ || sz + fz > halfStudZ + 1) {
          pushIssue(issues, `steps[${si}].ops[${oi}]`, `brick Z outside envelope (±${halfStudZ} studs)`);
        }
        if (py < 0 || py + fy > maxPlateY + 1) {
          pushIssue(issues, `steps[${si}].ops[${oi}]`, `brick Y outside envelope (0..${maxPlateY} plates)`);
        }
      });
    }
  }

  if (issues.length) return { ok: false, issues };

  return { ok: true, manual: raw as BrickManual };
}

export function formatManualIssues(issues: ManualValidationIssue[]): string {
  return issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join('\n');
}
