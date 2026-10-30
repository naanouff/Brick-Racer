/**
 * @file brickCatalog.ts
 * @description Brick poses + batching — part/color ids resolved via BC1 catalog.
 */

import {
  catalogCanonicalColorIds,
  catalogCanonicalPartIds,
  catalogColorAcceptIds,
  catalogPartAcceptIds,
  getColor,
  getPart,
  isCatalogColor,
  isCatalogPart,
  partFootprintFromCatalog,
  resolveColorId,
  resolvePartId,
} from './catalog';
import { P, S } from './brickUnits';

/** Part id accepted in manuals = design id or alias (e.g. "3005" | "1x1"). */
export type BrickPartId = string;
/** Color id accepted in manuals = slug or alias (e.g. "gray" | "lbg"). */
export type BrickColorId = string;

export type BrickPose = {
  partId: BrickPartId;
  colorId: BrickColorId;
  /** World-space center (m). */
  position: [number, number, number];
  /** Yaw radians around Y. */
  yaw?: number;
};

/** Unit mesh shared by all brick instances (scaled via instance matrix). */
export const BRICK_MESH_ID = 'bo_cube';

/** Canonical part ids (no aliases). */
export const BRICK_PART_IDS: readonly string[] = catalogCanonicalPartIds();
/** All accept keys including aliases (validateManual). */
export const BRICK_PART_ACCEPT_IDS: readonly string[] = catalogPartAcceptIds();

/** Canonical color ids. */
export const BRICK_COLOR_IDS: readonly string[] = catalogCanonicalColorIds();
export const BRICK_COLOR_ACCEPT_IDS: readonly string[] = catalogColorAcceptIds();

export { isCatalogColor as isBrickColorId, isCatalogPart as isBrickPartId };
export { resolveColorId, resolvePartId, getPart, getColor };

/** Full extents (m) for a part — applied as instance scale on unit cube. */
export function partSizeMeters(partId: BrickPartId): [number, number, number] {
  const [sx, py, sz] = partFootprintFromCatalog(partId);
  return [sx * S, py * P, sz * S];
}

export function brickMaterialId(colorId: BrickColorId): string {
  const id = resolveColorId(colorId) ?? colorId;
  return `BRICK_${id}`;
}

export type BrickBatchKey = string;

export function brickBatchKey(partId: BrickPartId, colorId: BrickColorId): BrickBatchKey {
  const p = resolvePartId(partId) ?? partId;
  const c = resolveColorId(colorId) ?? colorId;
  return `${p}|${c}`;
}

export function parseBrickBatchKey(key: BrickBatchKey): {
  partId: BrickPartId;
  colorId: BrickColorId;
} {
  const [partId, colorId] = key.split('|') as [BrickPartId, BrickColorId];
  return { partId, colorId };
}

/** Group poses into instance batches (one GPU draw per part×color). */
export function groupBrickPoses(poses: readonly BrickPose[]): Map<BrickBatchKey, BrickPose[]> {
  const map = new Map<BrickBatchKey, BrickPose[]>();
  for (const pose of poses) {
    const key = brickBatchKey(pose.partId, pose.colorId);
    const list = map.get(key);
    if (list) list.push(pose);
    else map.set(key, [pose]);
  }
  return map;
}

export function countBrickInstances(poses: readonly BrickPose[]): number {
  return poses.length;
}

export function countBrickBatches(poses: readonly BrickPose[]): number {
  return groupBrickPoses(poses).size;
}
