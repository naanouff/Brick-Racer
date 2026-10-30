/**
 * @file bakeShell.ts
 * @description Drop fully occluded bricks (6-neighbor occupancy) — LEGO shell, not Minecraft merge.
 */

import type { BrickPose } from '../brickCatalog';
import type { AssembledBrick } from './assembleManual';
import { cellKey } from './partFootprint';

export type ShellBakeReport = {
  total: number;
  kept: number;
  culled: number;
};

export type ShellBakeResult = {
  poses: BrickPose[];
  bricks: AssembledBrick[];
  report: ShellBakeReport;
};

const NEIGHBORS: Array<[number, number, number]> = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

function brickHasExposedFace(brick: AssembledBrick, occupancy: Set<string>): boolean {
  // Occupancy-exempt parts (hollow AABB / curved) have no cells — always keep.
  if (brick.cells.length === 0) return true;
  for (const [sx, py, sz] of brick.cells) {
    for (const [dx, dy, dz] of NEIGHBORS) {
      if (!occupancy.has(cellKey(sx + dx, py + dy, sz + dz))) return true;
    }
  }
  return false;
}

/**
 * Keep bricks that have at least one empty 6-neighbor cell.
 * When `enabled` is false, returns the full assembly unchanged.
 */
export function bakeShell(
  bricks: readonly AssembledBrick[],
  occupancy: Set<string>,
  enabled = true
): ShellBakeResult {
  if (!enabled) {
    return {
      poses: bricks.map((b) => b.pose),
      bricks: [...bricks],
      report: { total: bricks.length, kept: bricks.length, culled: 0 },
    };
  }

  const keptBricks = bricks.filter((b) => brickHasExposedFace(b, occupancy));
  return {
    poses: keptBricks.map((b) => b.pose),
    bricks: keptBricks,
    report: {
      total: bricks.length,
      kept: keptBricks.length,
      culled: bricks.length - keptBricks.length,
    },
  };
}
