/**
 * @file spawnBrickLab.ts
 * @description Spawn brick-lab + manual landmark at origin (LDraw meshes, box fallback).
 */

import type { Engine, Entity, IEngineContext } from '@naanouff/w3dts-core';
import type { BrickManual } from '../../hub/brick/manual/manualSchema';
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
  /** In-memory manual (editor). Wins over manualId when set. */
  manual?: BrickManual;
  /** When false, show full assembly (no shell cull). Default true. */
  shell?: boolean;
  /** Skip level geometry (ground/lights) — refresh bricks only. */
  bricksOnly?: boolean;
};

export type BrickLabSpawnResult = SpawnLevelResult & {
  brickEntityIds: Entity[];
  report: { total: number; kept: number; culled: number };
  batches: number;
  manualId: string;
  shell: boolean;
  /** True when at least one LDraw batch was spawned. */
  ldraw: boolean;
};

export async function spawnBrickLab(
  engine: IEngineContext,
  opts?: BrickLabSpawnOpts
): Promise<BrickLabSpawnResult> {
  const manualId = opts?.manualId ?? opts?.manual?.id?.replace(/^landmark\./, '') ?? 'fountain';
  const shell = opts?.shell !== false;
  const result = opts?.bricksOnly
    ? { rootEntityIds: [] as Entity[], entityById: new Map<string, Entity>() }
    : await spawnLevel(engine, brickLabSpec);

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

  const source = opts?.manual ?? getBrickManual(manualId as BrickManualId);
  // Lab centers the build at world origin for orbit framing.
  const labManual = {
    ...source,
    origin: [0, 0, 0] as [number, number, number],
  };
  const built = manualToLandmark(labManual, { shell });
  const ldrawEntities = await spawnLandmarkLdraw(engine, built.spec);
  const brickEntityIds = ldrawEntities ?? spawnBrickLandmark(engine, built.spec);
  if (!ldrawEntities) {
    console.warn(`[BrickLab] LDraw unavailable — box proxies for ${manualId}`);
  } else {
    console.info(`[BrickLab] LDraw landmark ${manualId} with catalog plastic (017B + UV1 aging)`);
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
