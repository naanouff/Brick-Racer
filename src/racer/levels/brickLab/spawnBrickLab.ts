/**
 * @file spawnBrickLab.ts
 * @description Spawn brick-lab + manual landmark at origin (LDraw meshes, box fallback).
 */

import type { Engine, Entity, IEngineContext } from '@naanouff/w3dts-core';
import { manualToLandmark } from '../../hub/brick/manual/manualToLandmark';
import {
  getBrickManual,
  type BrickManualId,
} from '../../hub/brick/manuals/registry';
import { spawnBrickLandmark } from '../../hub/brick/spawnBrickLandmark';
import { spawnLandmarkLdraw } from '../../hub/brick/spawnLandmarkLdraw';
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
  /** True when real LDraw .dat meshes were used. */
  ldraw: boolean;
};

export async function spawnBrickLab(
  engine: IEngineContext,
  opts?: BrickLabSpawnOpts
): Promise<BrickLabSpawnResult> {
  const manualId = opts?.manualId ?? 'fountain';
  const shell = opts?.shell !== false;
  const result = await spawnLevel(engine, brickLabSpec);

  const full = engine as Engine;
  const probe = full.resourceManager.getMaterialByName('CL_plastic_017b_gray');
  if (!probe?.shaderGraph) {
    console.warn(
      '[BrickLab] CL_plastic_017b_gray missing after spawnLevel — landmark will look flat'
    );
  } else {
    console.info(
      `[BrickLab] catalog plastic ready (usePlasticMaps=${String(probe.properties.get('usePlasticMaps'))})`
    );
  }

  const manual = getBrickManual(manualId);
  // Lab centers the build at world origin for orbit framing.
  const labManual = {
    ...manual,
    origin: [0, 0, 0] as [number, number, number],
  };
  const built = manualToLandmark(labManual, { shell });
  const ldrawEntities = await spawnLandmarkLdraw(engine, built.spec);
  const brickEntityIds = ldrawEntities ?? spawnBrickLandmark(engine, built.spec);
  if (!ldrawEntities) {
    console.warn(`[BrickLab] LDraw unavailable — box proxies for ${manualId}`);
  } else {
    console.info(`[BrickLab] LDraw fountain with catalog plastic (017B + UV1 aging)`);
  }
  result.rootEntityIds.push(...brickEntityIds);

  return {
    ...result,
    brickEntityIds,
    report: built.report,
    batches: built.batches,
    manualId,
    shell,
    ldraw: ldrawEntities !== null,
  };
}
