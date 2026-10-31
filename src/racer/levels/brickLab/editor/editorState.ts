/**
 * @file editorState.ts
 * @description In-memory brick-lab editor ops + occupancy (ED4).
 */

import { cellKey, rotatedFootprint, type RotDeg } from '../../../hub/brick/manual/partFootprint';
import type { ManualBrickOp } from '../../../hub/brick/manual/manualSchema';

export type EditorBrickOp = ManualBrickOp & { id: string };

/** brush/select edit; orbit/pan navigate (LT2). */
export type EditorTool = 'brush' | 'select' | 'orbit' | 'pan';

export type EditorState = {
  stem: string;
  title: string;
  ops: EditorBrickOp[];
  tool: EditorTool;
  /** Selected op id in select tool (null = none). */
  selectedOpId: string | null;
  /** Locked plate layer when autoStack is false. */
  layerPy: number;
  autoStack: boolean;
  rot: RotDeg;
  partId: string;
  colorId: string;
  undo: EditorBrickOp[][];
  redo: EditorBrickOp[][];
};

let nextOpId = 1;

export function createEditorOpId(): string {
  return `op${nextOpId++}`;
}

export function createEmptyEditorState(stem = 'untitled', title = 'Nouveau décor'): EditorState {
  return {
    stem,
    title,
    ops: [],
    tool: 'brush',
    selectedOpId: null,
    layerPy: 0,
    autoStack: true,
    rot: 0,
    partId: '3005',
    colorId: 'gray',
    undo: [],
    redo: [],
  };
}

function cloneOps(ops: readonly EditorBrickOp[]): EditorBrickOp[] {
  return ops.map((o) => ({ ...o, at: [...o.at] as [number, number, number] }));
}

export function pushUndo(state: EditorState): void {
  state.undo.push(cloneOps(state.ops));
  if (state.undo.length > 80) state.undo.shift();
  state.redo = [];
}

export function buildOccupancy(ops: readonly EditorBrickOp[]): Set<string> {
  const occ = new Set<string>();
  for (const op of ops) {
    const [sx, py, sz] = op.at;
    const rot = (op.rot ?? 0) as RotDeg;
    const [fx, fy, fz] = rotatedFootprint(op.part, rot);
    for (let x = 0; x < fx; x++) {
      for (let y = 0; y < fy; y++) {
        for (let z = 0; z < fz; z++) {
          occ.add(cellKey(sx + x, py + y, sz + z));
        }
      }
    }
  }
  return occ;
}

export function footprintCollides(
  occ: Set<string>,
  partId: string,
  sx: number,
  py: number,
  sz: number,
  rot: RotDeg
): boolean {
  const [fx, fy, fz] = rotatedFootprint(partId, rot);
  for (let x = 0; x < fx; x++) {
    for (let y = 0; y < fy; y++) {
      for (let z = 0; z < fz; z++) {
        if (occ.has(cellKey(sx + x, py + y, sz + z))) return true;
      }
    }
  }
  return false;
}

/** Highest plate top under the footprint (exclusive top). */
export function stackHeightUnder(
  ops: readonly EditorBrickOp[],
  partId: string,
  sx: number,
  sz: number,
  rot: RotDeg
): number {
  const [fx, , fz] = rotatedFootprint(partId, rot);
  let maxTop = 0;
  for (const op of ops) {
    const [ox, oy, oz] = op.at;
    const orot = (op.rot ?? 0) as RotDeg;
    const [ofx, ofy, ofz] = rotatedFootprint(op.part, orot);
    const overlapX = ox < sx + fx && ox + ofx > sx;
    const overlapZ = oz < sz + fz && oz + ofz > sz;
    if (overlapX && overlapZ) maxTop = Math.max(maxTop, oy + ofy);
  }
  return maxTop;
}

export function findOpAtCell(
  ops: readonly EditorBrickOp[],
  sx: number,
  py: number,
  sz: number
): EditorBrickOp | null {
  for (let i = ops.length - 1; i >= 0; i--) {
    const op = ops[i]!;
    const [ox, oy, oz] = op.at;
    const rot = (op.rot ?? 0) as RotDeg;
    const [fx, fy, fz] = rotatedFootprint(op.part, rot);
    if (sx >= ox && sx < ox + fx && py >= oy && py < oy + fy && sz >= oz && sz < oz + fz) {
      return op;
    }
  }
  return null;
}

/** Topmost brick whose footprint covers stud (sx, sz), any height. */
export function findTopOpAtStud(
  ops: readonly EditorBrickOp[],
  sx: number,
  sz: number
): EditorBrickOp | null {
  let best: EditorBrickOp | null = null;
  let bestTop = -Infinity;
  for (const op of ops) {
    const [ox, oy, oz] = op.at;
    const rot = (op.rot ?? 0) as RotDeg;
    const [fx, fy, fz] = rotatedFootprint(op.part, rot);
    if (sx < ox || sx >= ox + fx || sz < oz || sz >= oz + fz) continue;
    const top = oy + fy;
    if (top >= bestTop) {
      bestTop = top;
      best = op;
    }
  }
  return best;
}

/** Move an existing op; occupancy ignores the op itself. */
export function moveEditorBrick(
  state: EditorState,
  opId: string,
  sx: number,
  py: number,
  sz: number,
  recordUndo = true
): boolean {
  const idx = state.ops.findIndex((o) => o.id === opId);
  if (idx < 0) return false;
  const op = state.ops[idx]!;
  if (op.at[0] === sx && op.at[1] === py && op.at[2] === sz) return true;
  const others = state.ops.filter((o) => o.id !== opId);
  const occ = buildOccupancy(others);
  const rot = (op.rot ?? 0) as RotDeg;
  if (footprintCollides(occ, op.part, sx, py, sz, rot)) return false;
  if (recordUndo) pushUndo(state);
  state.ops[idx] = { ...op, at: [sx, py, sz] };
  state.selectedOpId = opId;
  return true;
}

export function rotateSelectedBrick(state: EditorState): boolean {
  if (!state.selectedOpId) return false;
  const op = state.ops.find((o) => o.id === state.selectedOpId);
  if (!op) return false;
  const order: RotDeg[] = [0, 90, 180, 270];
  const cur = (op.rot ?? 0) as RotDeg;
  const next = order[(order.indexOf(cur) + 1) % order.length]!;
  const others = state.ops.filter((o) => o.id !== op.id);
  const occ = buildOccupancy(others);
  if (footprintCollides(occ, op.part, op.at[0], op.at[1], op.at[2], next)) return false;
  pushUndo(state);
  if (next === 0) delete op.rot;
  else op.rot = next;
  return true;
}

export function placeEditorBrick(
  state: EditorState,
  sx: number,
  py: number,
  sz: number
): EditorBrickOp | null {
  const rot = state.rot;
  const occ = buildOccupancy(state.ops);
  if (footprintCollides(occ, state.partId, sx, py, sz, rot)) return null;
  pushUndo(state);
  const op: EditorBrickOp = {
    id: createEditorOpId(),
    op: 'brick',
    part: state.partId as ManualBrickOp['part'],
    color: state.colorId as ManualBrickOp['color'],
    at: [sx, py, sz],
    ...(rot !== 0 ? { rot } : {}),
  };
  state.ops.push(op);
  return op;
}

export function removeEditorBrick(state: EditorState, opId: string): boolean {
  const idx = state.ops.findIndex((o) => o.id === opId);
  if (idx < 0) return false;
  pushUndo(state);
  state.ops.splice(idx, 1);
  if (state.selectedOpId === opId) state.selectedOpId = null;
  return true;
}

export function undoEditor(state: EditorState): boolean {
  const prev = state.undo.pop();
  if (!prev) return false;
  state.redo.push(cloneOps(state.ops));
  state.ops = prev;
  return true;
}

export function redoEditor(state: EditorState): boolean {
  const next = state.redo.pop();
  if (!next) return false;
  state.undo.push(cloneOps(state.ops));
  state.ops = next;
  return true;
}

export function rotateEditorBrush(state: EditorState): RotDeg {
  const order: RotDeg[] = [0, 90, 180, 270];
  const i = order.indexOf(state.rot);
  state.rot = order[(i + 1) % order.length]!;
  return state.rot;
}
