/**
 * @file spawnCityTest.ts
 * @description Spawn city-test blockout level (+ brick landmarks BW1, LDraw Bolt MF2).
 */

import type { IEngineContext } from '@naanouff/w3dts-core';
import {
  fountainBrickLandmarkSpec,
  spawnBrickLandmark,
  spawnLandmarkLdraw,
} from '../../hub/brick';
import { preloadMinifigLdrawMeshes } from '../../minifig/preloadMinifigLdraw';
import { BOLT_RECIPE } from '../../minifig/recipes/c01-bolt';
import { spawnLevel, type SpawnLevelResult } from '../shared';
import { buildCityTestSpec } from './cityTestSpec';

export async function spawnCityTest(engine: IEngineContext): Promise<SpawnLevelResult> {
  const preloaded = await preloadMinifigLdrawMeshes(engine, BOLT_RECIPE);
  if (preloaded.missing.length > 0) {
    console.warn(
      `[CityTest] LDraw missing (${preloaded.missing.join(', ')}) — GPROC fallback for those parts`
    );
  }
  const spec = buildCityTestSpec({
    ldraw:
      preloaded.readyIds.size > 0
        ? {
            readyIds: preloaded.readyIds,
            sizes: preloaded.sizes,
            agingIds: preloaded.agingIds,
          }
        : null,
  });
  const result = await spawnLevel(engine, spec, { extraMeshes: preloaded.meshes });
  const fountainSpec = fountainBrickLandmarkSpec();
  const ldrawEntities = await spawnLandmarkLdraw(engine, fountainSpec);
  const brickEntities = ldrawEntities ?? spawnBrickLandmark(engine, fountainSpec);
  result.rootEntityIds.push(...brickEntities);
  return result;
}
