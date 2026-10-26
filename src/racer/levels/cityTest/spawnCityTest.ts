/**
 * @file spawnCityTest.ts
 * @description Spawn city-test blockout level (+ brick landmarks BW1).
 */

import type { IEngineContext } from '@naanouff/w3dts-core';
import { fountainBrickLandmarkSpec, spawnBrickLandmark } from '../../hub/brick';
import { spawnLevel, type SpawnLevelResult } from '../shared';
import { cityTestSpec } from './cityTestSpec';

export async function spawnCityTest(engine: IEngineContext): Promise<SpawnLevelResult> {
  const result = await spawnLevel(engine, cityTestSpec);
  const brickEntities = spawnBrickLandmark(engine, fountainBrickLandmarkSpec());
  result.rootEntityIds.push(...brickEntities);
  return result;
}
