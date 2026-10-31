/**
 * @file editorIo.ts
 * @description EditorState ↔ BrickManual (ED4).
 */

import { S, P } from '../../../hub/brick/brickUnits';
import type { BrickManual, ManualBrickOp, ManualPartsListEntry } from '../../../hub/brick/manual/manualSchema';
import { validateManual } from '../../../hub/brick/manual/manualSchema';
import { rotatedFootprint, type RotDeg } from '../../../hub/brick/manual/partFootprint';
import {
  createEditorOpId,
  createEmptyEditorState,
  type EditorBrickOp,
  type EditorState,
} from './editorState';

const STEM_RE = /^[a-z0-9-]+$/;

export function isValidManualStem(stem: string): boolean {
  return STEM_RE.test(stem);
}

export function editorOpsToManualOps(ops: readonly EditorBrickOp[]): ManualBrickOp[] {
  return ops.map((o) => {
    const out: ManualBrickOp = {
      op: 'brick',
      part: o.part,
      color: o.color,
      at: [o.at[0], o.at[1], o.at[2]],
    };
    if (o.rot) out.rot = o.rot;
    return out;
  });
}

function computePartsList(ops: readonly ManualBrickOp[]): ManualPartsListEntry[] {
  const map = new Map<string, ManualPartsListEntry>();
  for (const op of ops) {
    const key = `${op.part}|${op.color}`;
    const prev = map.get(key);
    if (prev) prev.qty += 1;
    else map.set(key, { part: op.part, color: op.color, qty: 1 });
  }
  return [...map.values()].sort(
    (a, b) => a.part.localeCompare(b.part) || a.color.localeCompare(b.color)
  );
}

/**
 * Envelope is validated as origin-centered (±halfStud from 0).
 * Size must cover every brick corner from the origin — not just the AABB span.
 * (`validateManual`: sx >= -half && sx+fx <= half+1)
 */
function computeEnvelope(ops: readonly ManualBrickOp[]): {
  size: [number, number, number];
} {
  if (ops.length === 0) {
    return { size: [8 * S, 6 * P, 8 * S] };
  }
  let halfX = 0;
  let halfZ = 0;
  let maxY = 0;
  for (const op of ops) {
    const [sx, py, sz] = op.at;
    const rot = (op.rot ?? 0) as RotDeg;
    const [fx, fy, fz] = rotatedFootprint(op.part, rot);
    // Need half >= -sx and half >= sx+fx-1 (same for Z).
    halfX = Math.max(halfX, -sx, sx + fx - 1);
    halfZ = Math.max(halfZ, -sz, sz + fz - 1);
    maxY = Math.max(maxY, py + fy);
  }
  const pad = 2;
  const studX = Math.max(8, 2 * (halfX + pad));
  const studZ = Math.max(8, 2 * (halfZ + pad));
  const plates = Math.max(6, maxY + 2);
  return { size: [studX * S, plates * P, studZ * S] };
}

export function editorStateToManual(state: EditorState): BrickManual {
  const ops = editorOpsToManualOps(state.ops);
  return {
    id: `landmark.${state.stem}`,
    version: 1,
    title: state.title,
    origin: [0, 0, 0],
    envelope: computeEnvelope(ops),
    partsList: computePartsList(ops),
    steps: [{ title: '1 — construction', ops }],
  };
}

export function manualToEditorState(manual: BrickManual, stem: string): EditorState {
  const state = createEmptyEditorState(stem, manual.title ?? stem);
  const ops: EditorBrickOp[] = [];
  for (const step of manual.steps) {
    for (const op of step.ops) {
      if (op.op !== 'brick') continue;
      ops.push({
        id: createEditorOpId(),
        op: 'brick',
        part: op.part,
        color: op.color,
        at: [op.at[0], op.at[1], op.at[2]],
        ...(op.rot ? { rot: op.rot } : {}),
      });
    }
  }
  state.ops = ops;
  return state;
}

export function validateEditorManual(state: EditorState): string[] {
  const manual = editorStateToManual(state);
  const result = validateManual(manual);
  if (result.ok) return [];
  return result.issues.map((i) => `${i.path}: ${i.message}`);
}
