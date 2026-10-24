/**
 * @file spawnCityTest.ts
 * @description Spawn city-test blockout level.
 */

import type { IEngineContext } from '@naanouff/w3dts-core';
import { spawnLevel, type SpawnLevelResult } from '../shared';
import { cityTestSpec } from './cityTestSpec';

export async function spawnCityTest(engine: IEngineContext): Promise<SpawnLevelResult> {
  return spawnLevel(engine, cityTestSpec);
}
