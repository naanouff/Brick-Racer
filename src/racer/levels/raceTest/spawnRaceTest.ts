/**
 * @file spawnRaceTest.ts
 * @description Spawn race-test blockout level.
 */

import type { IEngineContext } from '@naanouff/w3dts-core';
import { spawnLevel, type SpawnLevelResult } from '../shared';
import { raceTestSpec } from './raceTestSpec';

export async function spawnRaceTest(engine: IEngineContext): Promise<SpawnLevelResult> {
  return spawnLevel(engine, raceTestSpec);
}
