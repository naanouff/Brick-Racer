/**
 * @file spawnBrickLab.ts
 * @description Spawn brick-lab + optional manual landmark at origin.
 */

import type { Entity, IEngineContext } from '@naanouff/w3dts-core';
import { manualToLandmark } from '../../hub/brick/manual/manualToLandmark';
import {
  getBrickManual,
  type BrickManualId,
} from '../../hub/brick/manuals/registry';
import { spawnBrickLandmark } from '../../hub/brick/spawnBrickLandmark';
import { spawnLevel, type SpawnLevelResult } from '../shared';
import { brickLabSpec } from './brickLabSpec';

export type BrickLabSpawnOpts = {
  manualId?: BrickManualId;
  /** When false, show full assembly (no shell cull). Default true. */
  shell?: boolean;
};

export type BrickLabSpawnResult = SpawnLevelResult & {
  brickEntityIds: Entity[];
  report: { total: number; kept: number; culled: number };
  batches: number;
  manualId: BrickManualId;
  shell: boolean;
};

export async function spawnBrickLab(
  engine: IEngineContext,
  opts?: BrickLabSpawnOpts
): Promise<BrickLabSpawnResult> {
  const manualId = opts?.manualId ?? 'fountain';
  const shell = opts?.shell !== false;
  const result = await spawnLevel(engine, brickLabSpec);

  const manual = getBrickManual(manualId);
  // Lab centers the build at world origin for orbit framing.
  const labManual = {
    ...manual,
    origin: [0, 0, 0] as [number, number, number],
  };
  const built = manualToLandmark(labManual, { shell });
  const brickEntityIds = spawnBrickLandmark(engine, built.spec);
  result.rootEntityIds.push(...brickEntityIds);

  return {
    ...result,
    brickEntityIds,
    report: built.report,
    batches: built.batches,
    manualId,
    shell,
  };
}
