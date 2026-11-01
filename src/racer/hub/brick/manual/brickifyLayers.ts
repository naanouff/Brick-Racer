/**
 * @file brickifyLayers.ts
 * @description Deterministic ASCII layers → BrickManual (DC1c / DC3).
 */

import { BRICK_CATALOG, type BrickPartDef } from '../catalog';
import { P, S } from '../brickUnits';
import type { BrickColorId, BrickPartId } from '../brickCatalog';
import {
  formatLayersIssues,
  isLayerSlopeChar,
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

const BRICK_1X1 =
  CANDIDATES.brick.find((c) => c.sx === 1 && c.sz === 1 && c.rot === 0)?.partId ?? '3005';
const TILE_1X1 =
  CANDIDATES.tile.find((c) => c.sx === 1 && c.sz === 1 && c.rot === 0)?.partId ?? '3070';
/** Slope 45 2×1 — footprint [1,3,2] at rot 0. */
const SLOPE_2X1 = '3040';

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

/** Odd brick courses: seed a 1×1 at the start of each horizontal run, then pack. */
function packColorMaskRunningBond(
  mask: boolean[][],
  width: number,
  depth: number,
  candidates: Candidate[],
  color: BrickColorId,
  py: number,
  oddCourse: boolean
): Placement[] {
  if (!oddCourse) {
    return packColorMask(mask, width, depth, candidates, color, py);
  }
  const work: boolean[][] = mask.map((row) => row.slice());
  const seeded: Placement[] = [];
  for (let z = 0; z < depth; z++) {
    let x = 0;
    while (x < width) {
      while (x < width && !work[z]![x]) x++;
      if (x >= width) break;
      work[z]![x] = false;
      seeded.push({ part: BRICK_1X1, color, at: [x, py, z], rot: 0 });
      x++;
      while (x < width && work[z]![x]) x++;
    }
  }
  return [...seeded, ...packColorMask(work, width, depth, candidates, color, py)];
}

function placeSlopes(
  layer: BrickLayer,
  width: number,
  depth: number,
  py: number,
  slopeColor: BrickColorId
): Placement[] {
  const out: Placement[] = [];
  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      const ch = layer.rows[z]![x]!;
      if (!isLayerSlopeChar(ch)) continue;
      // `/` faces +X (rot 0); `\` faces −X (rot 180). Footprint Z=2 — clamp if needed.
      const rot: RotDeg = ch === '/' ? 0 : 180;
      out.push({ part: SLOPE_2X1, color: slopeColor, at: [x, py, z], rot });
    }
  }
  return out;
}

function gridToWorldAt(
  ix: number,
  iz: number,
  footprint: [number, number]
): [number, number] {
  const [fw, fd] = footprint;
  return [ix - Math.floor(fw / 2), iz - Math.floor(fd / 2)];
}

function placementsToOps(
  placements: Placement[],
  footprint: [number, number],
  bump: (part: BrickPartId, color: BrickColorId) => void
): ManualBrickOp[] {
  return placements.map((p) => {
    const [sx, sz] = gridToWorldAt(p.at[0], p.at[2], footprint);
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
}

function brickifyValidated(doc: BrickLayers): BrickManual {
  const [fw, fd] = doc.footprint;
  const steps: ManualStep[] = [];
  const qty = new Map<string, ManualPartsListEntry>();
  let py = 0;
  const runningBond = doc.options?.runningBond !== false;
  const capTiles = doc.options?.capTiles === true;
  const slopeColor = doc.options?.slopeColor ?? 'sand';

  const bump = (part: BrickPartId, color: BrickColorId): void => {
    const key = `${part}|${color}`;
    const cur = qty.get(key);
    if (cur) cur.qty += 1;
    else qty.set(key, { part, color, qty: 1 });
  };

  let brickCourse = 0;
  type TopCell = { letter: string; color: BrickColorId };
  let topFill: TopCell[][] | null = null;

  doc.layers.forEach((layer) => {
    const oddBond = runningBond && layer.kind === 'brick' && brickCourse % 2 === 1;
    if (layer.kind === 'brick') brickCourse++;

    const placements = brickifyLayer(
      layer,
      doc.legend,
      fw,
      fd,
      py,
      oddBond,
      slopeColor
    );
    const ops = placementsToOps(placements, doc.footprint, bump);
    if (ops.length) {
      steps.push({
        title: `${steps.length + 1} — ${layer.kind} y=${py}`,
        ops,
      });
    }

    // Track topmost colored cells for optional tile cap (ignore slopes / empty).
    const fill: TopCell[][] = [];
    let hasFill = false;
    for (let z = 0; z < fd; z++) {
      const row: TopCell[] = [];
      for (let x = 0; x < fw; x++) {
        const ch = layer.rows[z]![x]!;
        if (ch === '.' || isLayerSlopeChar(ch)) {
          row.push({ letter: '.', color: 'gray' });
        } else {
          hasFill = true;
          row.push({ letter: ch, color: doc.legend[ch]! });
        }
      }
      fill.push(row);
    }
    if (hasFill) topFill = fill;

    py += layerHeightPlates(layer.kind);
  });

  if (capTiles && topFill !== null) {
    const crown: TopCell[][] = topFill;
    const byColor = new Map<BrickColorId, boolean[][]>();
    for (let z = 0; z < fd; z++) {
      for (let x = 0; x < fw; x++) {
        const cell = crown[z]![x]!;
        if (cell.letter === '.') continue;
        let mask = byColor.get(cell.color);
        if (!mask) {
          mask = Array.from({ length: fd }, () => Array.from({ length: fw }, () => false));
          byColor.set(cell.color, mask);
        }
        mask[z]![x] = true;
      }
    }
    const packed: Placement[] = [];
    for (const color of [...byColor.keys()].sort()) {
      packed.push(
        ...packColorMask(byColor.get(color)!, fw, fd, CANDIDATES.tile, color, py)
      );
    }
    const ops = placementsToOps(packed, doc.footprint, bump);
    if (ops.length) {
      steps.push({
        title: `${steps.length + 1} — cap tiles y=${py}`,
        ops,
      });
      py += 1;
    }
  }

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

  // Slopes extend 2 studs in Z at rot 0/180 — widen envelope from placements in steps.
  for (const step of steps) {
    for (const op of step.ops) {
      if (op.op !== 'brick') continue;
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
  }

  const spanX = Math.max(maxStudX - minStudX, fw);
  const spanZ = Math.max(maxStudZ - minStudZ, fd);
  const heightM = Math.max(maxPlateY, 1) * P;
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
  py: number,
  oddBond: boolean,
  slopeColor: BrickColorId
): Placement[] {
  const candidates = CANDIDATES[layer.kind];
  if (!candidates.length) {
    throw new BrickifyError(`no catalog parts for kind ${layer.kind}`);
  }

  const slopes = placeSlopes(layer, width, depth, py, slopeColor);

  const letters = new Set<string>();
  for (const row of layer.rows) {
    for (const ch of row) {
      if (ch !== '.' && !isLayerSlopeChar(ch)) letters.add(ch);
    }
  }

  const all: Placement[] = [...slopes];
  const sortedLetters = [...letters].sort();
  for (const letter of sortedLetters) {
    const color = legend[letter];
    if (!color) continue;
    const mask: boolean[][] = Array.from({ length: depth }, (_, z) =>
      Array.from({ length: width }, (_, x) => layer.rows[z]![x] === letter)
    );
    all.push(
      ...packColorMaskRunningBond(
        mask,
        width,
        depth,
        candidates,
        color,
        py,
        oddBond && layer.kind === 'brick'
      )
    );
  }

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
