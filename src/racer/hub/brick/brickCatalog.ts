/**
 * @file brickCatalog.ts
 * @description Brick part ids, sizes (m), and pastel plastic material ids.
 */

import { B, P, S } from './brickUnits';

export type BrickPartId = '1x1' | '1x2' | '2x2' | '2x4' | 'plate' | 'tile';

/** Hub pastel plastics (PBR material ids on the level). */
export type BrickColorId =
  | 'cyan'
  | 'white'
  | 'lime'
  | 'sand'
  | 'terracotta'
  | 'yellow'
  | 'black';

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

export const BRICK_PART_IDS: readonly BrickPartId[] = [
  '1x1',
  '1x2',
  '2x2',
  '2x4',
  'plate',
  'tile',
];

export const BRICK_COLOR_IDS: readonly BrickColorId[] = [
  'cyan',
  'white',
  'lime',
  'sand',
  'terracotta',
  'yellow',
  'black',
];

/** Full extents (m) for a part — applied as instance scale on unit cube. */
export function partSizeMeters(partId: BrickPartId): [number, number, number] {
  switch (partId) {
    case '1x1':
      return [S, B, S];
    case '1x2':
      return [S, B, 2 * S];
    case '2x2':
      return [2 * S, B, 2 * S];
    case '2x4':
      return [2 * S, B, 4 * S];
    case 'plate':
      return [2 * S, P, 4 * S];
    case 'tile':
      return [2 * S, P, 2 * S];
    default: {
      const _e: never = partId;
      return _e;
    }
  }
}

export function brickMaterialId(colorId: BrickColorId): string {
  return `BRICK_${colorId}`;
}

export type BrickBatchKey = string;

export function brickBatchKey(partId: BrickPartId, colorId: BrickColorId): BrickBatchKey {
  return `${partId}|${colorId}`;
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
