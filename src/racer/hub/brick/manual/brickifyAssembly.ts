/**
 * @file brickifyAssembly.ts
 * @description Compose modules (layers files + offsets) → one BrickManual (DC4).
 */

import { P, S } from '../brickUnits';
import type { BrickColorId, BrickPartId } from '../brickCatalog';
import {
  formatAssemblyIssues,
  validateAssembly,
  type BrickAssembly,
} from './assemblySchema';
import { brickifyLayers, BrickifyError } from './brickifyLayers';
import type { BrickManual, ManualBrickOp, ManualPartsListEntry, ManualStep } from './manualSchema';
import { partFootprintPlates } from './partFootprint';

export type LoadLayersJson = (file: string) => unknown;

function shiftOp(op: ManualBrickOp, dx: number, dy: number, dz: number): ManualBrickOp {
  return {
    ...op,
    at: [op.at[0] + dx, op.at[1] + dy, op.at[2] + dz],
  };
}

function mergePartsLists(
  lists: Array<ManualPartsListEntry[] | undefined>
): ManualPartsListEntry[] {
  const qty = new Map<string, ManualPartsListEntry>();
  for (const list of lists) {
    if (!list) continue;
    for (const e of list) {
      const key = `${e.part}|${e.color}`;
      const cur = qty.get(key);
      if (cur) cur.qty += e.qty;
      else qty.set(key, { part: e.part, color: e.color, qty: e.qty });
    }
  }
  return [...qty.values()].sort(
    (a, b) => a.part.localeCompare(b.part) || a.color.localeCompare(b.color)
  );
}

function envelopeFromOps(ops: ManualBrickOp[], fallback: [number, number, number]): [number, number, number] {
  let minX = 0;
  let maxX = 0;
  let minZ = 0;
  let maxZ = 0;
  let maxY = 1;
  let any = false;
  for (const op of ops) {
    if (op.op !== 'brick') continue;
    const [fx, fy, fz] = partFootprintPlates(op.part);
    const rot = op.rot ?? 0;
    const rx = rot === 90 || rot === 270 ? fz : fx;
    const rz = rot === 90 || rot === 270 ? fx : fz;
    const [sx, py, sz] = op.at;
    if (!any) {
      minX = sx;
      maxX = sx + rx;
      minZ = sz;
      maxZ = sz + rz;
      maxY = py + fy;
      any = true;
    } else {
      minX = Math.min(minX, sx);
      maxX = Math.max(maxX, sx + rx);
      minZ = Math.min(minZ, sz);
      maxZ = Math.max(maxZ, sz + rz);
      maxY = Math.max(maxY, py + fy);
    }
  }
  if (!any) return fallback;
  const spanX = Math.max(maxX - minX, 1);
  const spanZ = Math.max(maxZ - minZ, 1);
  return [
    Math.max(spanX * S + S, S * 2),
    Math.max(maxY * P + P, P * 2),
    Math.max(spanZ * S + S, S * 2),
  ];
}

/**
 * Brickify each module then shift brick ops by offset; concatenate steps.
 * `loadLayers` resolves `module.file` to JSON (CLI / tests inject fs or map).
 */
export function brickifyAssembly(
  raw: unknown,
  loadLayers: LoadLayersJson
): BrickManual {
  const validated = validateAssembly(raw);
  if (!validated.ok) {
    throw new BrickifyError(formatAssemblyIssues(validated.issues));
  }
  const doc: BrickAssembly = validated.assembly;
  const steps: ManualStep[] = [];
  const partsLists: Array<ManualPartsListEntry[] | undefined> = [];
  const allBrickOps: ManualBrickOp[] = [];

  doc.modules.forEach((mod, i) => {
    let layersRaw: unknown;
    try {
      layersRaw = loadLayers(mod.file);
    } catch (e) {
      throw new BrickifyError(
        `modules[${i}].file: cannot load '${mod.file}': ${e instanceof Error ? e.message : String(e)}`
      );
    }
    const manual = brickifyLayers(layersRaw);
    const [dx, dy, dz] = mod.offset ?? [0, 0, 0];
    const label = mod.id ?? mod.file.replace(/\.layers\.json$/i, '') ?? `m${i}`;
    for (const step of manual.steps) {
      const ops = step.ops.map((op) => {
        if (op.op !== 'brick') return op;
        const shifted = shiftOp(op, dx, dy, dz);
        allBrickOps.push(shifted);
        return shifted;
      });
      steps.push({
        title: `${label} · ${step.title}`,
        ops,
      });
    }
    partsLists.push(manual.partsList);
  });

  if (steps.length === 0) {
    throw new BrickifyError('assembly produced zero steps');
  }

  return {
    id: doc.id,
    version: doc.version ?? 1,
    title: doc.title,
    origin: [20, 0, 20],
    envelope: { size: envelopeFromOps(allBrickOps, [3, 2, 3]) },
    partsList: mergePartsLists(partsLists),
    steps,
  };
}

export type { BrickColorId, BrickPartId };
