/**
 * @file layersSchema.ts
 * @description ASCII layer authoring format + validateLayers (DC1b).
 */

import { isBrickColorId, isBrickPartId, type BrickColorId, type BrickPartId } from '../brickCatalog';
import { isRotDeg, type RotDeg } from './partFootprint';
import type { ManualBrickOp, ManualValidationIssue } from './manualSchema';

export type LayerKind = 'plate' | 'brick' | 'tile';

export type BrickLayer = {
  kind: LayerKind;
  /** One string per Z row; one char per X stud. `.` = empty. */
  rows: string[];
};

/** Modifiers allowed in rows without a legend entry (DC3). */
export const LAYER_SLOPE_CHARS = ['/', '\\'] as const;
export type LayerSlopeChar = (typeof LAYER_SLOPE_CHARS)[number];

export function isLayerSlopeChar(ch: string): ch is LayerSlopeChar {
  return (LAYER_SLOPE_CHARS as readonly string[]).includes(ch);
}

export type BrickLayersOptions = {
  /** Alternate half-brick at the start of each run on odd brick courses. Default true. */
  runningBond?: boolean;
  /** After layers, lay tiles on the topmost filled cells. Default false. */
  capTiles?: boolean;
  /** Color for `/` `\\` slope cells. Default sand. */
  slopeColor?: BrickColorId;
};

export type BrickLayers = {
  id: string;
  version?: number;
  title?: string;
  /** Studs [X, Z]. */
  footprint: [number, number];
  /** Letter → colors.json id. */
  legend: Record<string, BrickColorId>;
  layers: BrickLayer[];
  /** Free brick ops after stacked layers (dishes, macaroni, …). */
  ops?: ManualBrickOp[];
  options?: BrickLayersOptions;
};

export type LayersValidationResult =
  | { ok: true; layers: BrickLayers }
  | { ok: false; issues: ManualValidationIssue[] };

const LAYER_KINDS: readonly LayerKind[] = ['plate', 'brick', 'tile'];

function isLayerKind(v: unknown): v is LayerKind {
  return typeof v === 'string' && (LAYER_KINDS as readonly string[]).includes(v);
}

function pushIssue(issues: ManualValidationIssue[], path: string, message: string): void {
  issues.push({ path, message });
}

function isInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && Number.isInteger(n);
}

function isIntVec3(v: unknown): v is [number, number, number] {
  return Array.isArray(v) && v.length === 3 && v.every(isInt);
}

/**
 * Structural validation: footprint, legend colors, row geometry, free brick ops.
 */
export function validateLayers(raw: unknown): LayersValidationResult {
  const issues: ManualValidationIssue[] = [];
  if (!raw || typeof raw !== 'object') {
    return { ok: false, issues: [{ path: '', message: 'layers must be an object' }] };
  }
  const m = raw as Record<string, unknown>;

  if (typeof m.id !== 'string' || !m.id) pushIssue(issues, 'id', 'id required');
  if (m.version !== undefined && (!isInt(m.version) || m.version < 1)) {
    pushIssue(issues, 'version', 'version >= 1 integer');
  }

  if (
    !Array.isArray(m.footprint) ||
    m.footprint.length !== 2 ||
    !m.footprint.every((n) => isInt(n) && n > 0)
  ) {
    pushIssue(issues, 'footprint', 'footprint must be [sx, sz] positive integers');
  }
  const fpX = Array.isArray(m.footprint) && isInt(m.footprint[0]) ? m.footprint[0] : 0;
  const fpZ = Array.isArray(m.footprint) && isInt(m.footprint[1]) ? m.footprint[1] : 0;

  if (!m.legend || typeof m.legend !== 'object' || Array.isArray(m.legend)) {
    pushIssue(issues, 'legend', 'legend object required');
  } else {
    for (const [letter, color] of Object.entries(m.legend as Record<string, unknown>)) {
      if (letter.length !== 1 || letter === '.') {
        pushIssue(issues, `legend.${letter}`, 'legend key must be a single non-dot character');
      }
      if (typeof color !== 'string' || !isBrickColorId(color)) {
        pushIssue(issues, `legend.${letter}`, `unknown color '${String(color)}'`);
      }
    }
  }

  const legend = (m.legend && typeof m.legend === 'object' ? m.legend : {}) as Record<
    string,
    string
  >;

  if (!Array.isArray(m.layers) || m.layers.length === 0) {
    pushIssue(issues, 'layers', 'at least one layer');
  } else {
    m.layers.forEach((layer, li) => {
      const lp = `layers[${li}]`;
      if (!layer || typeof layer !== 'object') {
        pushIssue(issues, lp, 'layer must be object');
        return;
      }
      const L = layer as Record<string, unknown>;
      if (!isLayerKind(L.kind)) {
        pushIssue(issues, `${lp}.kind`, `kind must be plate|brick|tile`);
      }
      if (!Array.isArray(L.rows) || L.rows.length === 0) {
        pushIssue(issues, `${lp}.rows`, 'at least one row');
        return;
      }
      if (fpZ > 0 && L.rows.length !== fpZ) {
        pushIssue(issues, `${lp}.rows`, `expected ${fpZ} rows (footprint Z), got ${L.rows.length}`);
      }
      L.rows.forEach((row, ri) => {
        const rp = `${lp}.rows[${ri}]`;
        if (typeof row !== 'string') {
          pushIssue(issues, rp, 'row must be a string');
          return;
        }
        if (fpX > 0 && row.length !== fpX) {
          pushIssue(issues, rp, `expected length ${fpX}, got ${row.length}`);
        }
        for (let ci = 0; ci < row.length; ci++) {
          const ch = row[ci]!;
          if (ch === '.' || isLayerSlopeChar(ch)) continue;
          if (!(ch in legend)) {
            pushIssue(issues, rp, `unknown legend letter '${ch}' at column ${ci}`);
          }
        }
      });
    });
  }

  if (m.options !== undefined) {
    if (!m.options || typeof m.options !== 'object' || Array.isArray(m.options)) {
      pushIssue(issues, 'options', 'options must be an object');
    } else {
      const opt = m.options as Record<string, unknown>;
      if (opt.runningBond !== undefined && typeof opt.runningBond !== 'boolean') {
        pushIssue(issues, 'options.runningBond', 'boolean');
      }
      if (opt.capTiles !== undefined && typeof opt.capTiles !== 'boolean') {
        pushIssue(issues, 'options.capTiles', 'boolean');
      }
      if (opt.slopeColor !== undefined) {
        if (typeof opt.slopeColor !== 'string' || !isBrickColorId(opt.slopeColor)) {
          pushIssue(issues, 'options.slopeColor', `unknown color '${String(opt.slopeColor)}'`);
        }
      }
    }
  }

  if (m.ops !== undefined) {
    if (!Array.isArray(m.ops)) {
      pushIssue(issues, 'ops', 'ops must be an array');
    } else {
      m.ops.forEach((op, oi) => {
        const opPath = `ops[${oi}]`;
        if (!op || typeof op !== 'object') {
          pushIssue(issues, opPath, 'op must be an object');
          return;
        }
        const o = op as Record<string, unknown>;
        if (o.op !== 'brick') {
          pushIssue(issues, `${opPath}.op`, 'only brick ops allowed in layers.ops');
          return;
        }
        if (typeof o.part !== 'string' || !isBrickPartId(o.part)) {
          pushIssue(issues, `${opPath}.part`, `unknown part '${String(o.part)}'`);
        }
        if (typeof o.color !== 'string' || !isBrickColorId(o.color)) {
          pushIssue(issues, `${opPath}.color`, `unknown color '${String(o.color)}'`);
        }
        if (!isIntVec3(o.at)) {
          pushIssue(issues, `${opPath}.at`, 'at must be [sx,py,sz] integers');
        }
        if (o.rot !== undefined && !isRotDeg(o.rot)) {
          pushIssue(issues, `${opPath}.rot`, 'rot must be 0|90|180|270');
        }
      });
    }
  }

  if (issues.length) return { ok: false, issues };

  return {
    ok: true,
    layers: {
      id: m.id as string,
      version: typeof m.version === 'number' ? m.version : 1,
      title: typeof m.title === 'string' ? m.title : undefined,
      footprint: m.footprint as [number, number],
      legend: legend as Record<string, BrickColorId>,
      layers: m.layers as BrickLayer[],
      ops: m.ops as ManualBrickOp[] | undefined,
      options: m.options as BrickLayersOptions | undefined,
    },
  };
}

export function formatLayersIssues(issues: ManualValidationIssue[]): string {
  return issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join('\n');
}

export type { BrickPartId, BrickColorId, RotDeg, ManualBrickOp };
