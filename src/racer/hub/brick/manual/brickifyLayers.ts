/**
 * @file brickifyLayers.ts
 * @description Deterministic ASCII layers → BrickManual (DC1c).
 */

import { BRICK_CATALOG, type BrickPartDef } from '../catalog';
import { P, S } from '../brickUnits';
import type { BrickColorId, BrickPartId } from '../brickCatalog';
import {
  formatLayersIssues,
  validateLayers,
  type BrickLayer,
  type BrickLayers,
  type LayerKind,
} from './layersSchema';
import type { BrickManual, ManualBrickOp, ManualPartsListEntry, ManualStep } from './manualSchema';
import { partFootprintPlates, type RotDeg } from './partFootprint';

export class BrickifyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BrickifyError';
  }
}

type Candidate = {
  partId: BrickPartId;
  sx: number;
  sz: number;
  rot: RotDeg;
  area: number;
};

/** Catalog rectangles for a layer kind, largest area first (stable id tie-break). */
function candidatesForKind(kind: LayerKind): Candidate[] {
  const category = kind;
  const wantY = kind === 'brick' ? 3 : 1;
  const out: Candidate[] = [];
  for (const part of BRICK_CATALOG.parts) {
    if (part.category !== category) continue;
    const [fx, fy, fz] = part.footprint;
    if (fy !== wantY) continue;
    // Skip odd non-rect shapes flagged missing with notes — still usable as AABB fillers.
    pushOriented(out, part, fx, fz, 0);
    if (fx !== fz) pushOriented(out, part, fz, fx, 90);
  }
  out.sort((a, b) => b.area - a.area || a.partId.localeCompare(b.partId) || a.rot - b.rot);
  return out;
}

function pushOriented(
  out: Candidate[],
  part: BrickPartDef,
  sx: number,
  sz: number,
  rot: RotDeg
): void {
  out.push({ partId: part.id, sx, sz, rot, area: sx * sz });
}

const CANDIDATES: Record<LayerKind, Candidate[]> = {
  plate: candidatesForKind('plate'),
  brick: candidatesForKind('brick'),
  tile: candidatesForKind('tile'),
};

function layerHeightPlates(kind: LayerKind): number {
  return kind === 'brick' ? 3 : 1;
}

type Placement = {
  part: BrickPartId;
  color: BrickColorId;
  at: [number, number, number];
  rot: RotDeg;
};

/**
 * Greedy cover of one color's cells: scan Z then X, place largest fitting rectangle.
 */
function packColorMask(
  mask: boolean[][],
  width: number,
  depth: number,
  candidates: Candidate[],
  color: BrickColorId,
  py: number
): Placement[] {
  const placed: Placement[] = [];
  const covered: boolean[][] = Array.from({ length: depth }, () =>
    Array.from({ length: width }, () => false)
  );

  const free = (x: number, z: number): boolean =>
    x >= 0 && z >= 0 && x < width && z < depth && mask[z]![x]! && !covered[z]![x]!;

  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      if (!free(x, z)) continue;

      let maxW = 0;
      while (free(x + maxW, z)) maxW++;
      let maxD = 0;
      outer: while (z + maxD < depth) {
        for (let dx = 0; dx < maxW; dx++) {
          if (!free(x + dx, z + maxD)) break outer;
        }
        maxD++;
      }

      let chosen: Candidate | null = null;
      for (const c of candidates) {
        if (c.sx <= maxW && c.sz <= maxD) {
          // Verify full rectangle still free (maxW/maxD already guarantees for this origin).
          let ok = true;
          for (let dz = 0; dz < c.sz && ok; dz++) {
            for (let dx = 0; dx < c.sx; dx++) {
              if (!free(x + dx, z + dz)) {
                ok = false;
                break;
              }
            }
          }
          if (ok) {
            chosen = c;
            break;
          }
        }
      }
      if (!chosen) {
        throw new BrickifyError(
          `no catalog part fits 1×1 at (${x},${z}) for color ${color} — check parts.json`
        );
      }

      for (let dz = 0; dz < chosen.sz; dz++) {
        for (let dx = 0; dx < chosen.sx; dx++) {
          covered[z + dz]![x + dx] = true;
        }
      }
      placed.push({
        part: chosen.partId,
        color,
        at: [x, py, z],
        rot: chosen.rot,
      });
    }
  }
  return placed;
}

function gridToWorldAt(
  ix: number,
  iz: number,
  footprint: [number, number]
): [number, number] {
  const [fw, fd] = footprint;
  return [ix - Math.floor(fw / 2), iz - Math.floor(fd / 2)];
}

function brickifyValidated(doc: BrickLayers): BrickManual {
  const [fw, fd] = doc.footprint;
  const steps: ManualStep[] = [];
  const qty = new Map<string, ManualPartsListEntry>();
  let py = 0;

  const bump = (part: BrickPartId, color: BrickColorId): void => {
    const key = `${part}|${color}`;
    const cur = qty.get(key);
    if (cur) cur.qty += 1;
    else qty.set(key, { part, color, qty: 1 });
  };

  doc.layers.forEach((layer, li) => {
    const placements = brickifyLayer(layer, doc.legend, fw, fd, py);
    const ops: ManualBrickOp[] = placements.map((p) => {
      const [sx, sz] = gridToWorldAt(p.at[0], p.at[2], doc.footprint);
      bump(p.part, p.color);
      const op: ManualBrickOp = {
        op: 'brick',
        part: p.part,
        color: p.color,
        at: [sx, p.at[1], sz],
      };
      if (p.rot !== 0) op.rot = p.rot;
      return op;
    });
    if (ops.length) {
      steps.push({
        title: `${steps.length + 1} — ${layer.kind} y=${py}`,
        ops,
      });
    }
    py += layerHeightPlates(layer.kind);
  });

  let maxPlateY = py;
  let minStudX = -Math.floor(fw / 2);
  let maxStudX = minStudX + fw;
  let minStudZ = -Math.floor(fd / 2);
  let maxStudZ = minStudZ + fd;

  if (doc.ops?.length) {
    for (const op of doc.ops) {
      bump(op.part, op.color);
      const [fx, fy, fz] = partFootprintPlates(op.part);
      const rot = op.rot ?? 0;
      const rx = rot === 90 || rot === 270 ? fz : fx;
      const rz = rot === 90 || rot === 270 ? fx : fz;
      const [sx, opY, sz] = op.at;
      minStudX = Math.min(minStudX, sx);
      maxStudX = Math.max(maxStudX, sx + rx);
      minStudZ = Math.min(minStudZ, sz);
      maxStudZ = Math.max(maxStudZ, sz + rz);
      maxPlateY = Math.max(maxPlateY, opY + fy);
    }
    steps.push({
      title: `${steps.length + 1} — specials`,
      ops: doc.ops.map((o) => ({ ...o })),
    });
  }

  if (steps.length === 0) {
    throw new BrickifyError('brickify produced zero ops');
  }

  const spanX = Math.max(maxStudX - minStudX, fw);
  const spanZ = Math.max(maxStudZ - minStudZ, fd);
  const heightM = Math.max(maxPlateY, 1) * P;
  // Pad so assemble envelopeHalfCells admits every placed corner.
  const envelope: [number, number, number] = [
    Math.max(spanX * S + S, S * 2),
    Math.max(heightM + P, P * 2),
    Math.max(spanZ * S + S, S * 2),
  ];

  return {
    id: doc.id,
    version: doc.version ?? 1,
    title: doc.title,
    origin: [20, 0, 20],
    envelope: { size: envelope },
    partsList: [...qty.values()].sort(
      (a, b) => a.part.localeCompare(b.part) || a.color.localeCompare(b.color)
    ),
    steps,
  };
}

function brickifyLayer(
  layer: BrickLayer,
  legend: Record<string, BrickColorId>,
  width: number,
  depth: number,
  py: number
): Placement[] {
  const candidates = CANDIDATES[layer.kind];
  if (!candidates.length) {
    throw new BrickifyError(`no catalog parts for kind ${layer.kind}`);
  }

  const letters = new Set<string>();
  for (const row of layer.rows) {
    for (const ch of row) {
      if (ch !== '.') letters.add(ch);
    }
  }

  const all: Placement[] = [];
  const sortedLetters = [...letters].sort();
  for (const letter of sortedLetters) {
    const color = legend[letter];
    if (!color) continue;
    const mask: boolean[][] = Array.from({ length: depth }, (_, z) =>
      Array.from({ length: width }, (_, x) => layer.rows[z]![x] === letter)
    );
    all.push(...packColorMask(mask, width, depth, candidates, color, py));
  }

  // Stable order: Z, X, then part id.
  all.sort(
    (a, b) =>
      a.at[2] - b.at[2] ||
      a.at[0] - b.at[0] ||
      a.part.localeCompare(b.part) ||
      a.color.localeCompare(b.color)
  );
  return all;
}

/** Validate + convert layers JSON into a BrickManual (ops brick only). */
export function brickifyLayers(raw: unknown): BrickManual {
  const validated = validateLayers(raw);
  if (!validated.ok) {
    throw new BrickifyError(formatLayersIssues(validated.issues));
  }
  return brickifyValidated(validated.layers);
}
