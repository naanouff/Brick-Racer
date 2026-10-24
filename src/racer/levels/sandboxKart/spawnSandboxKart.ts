/**
 * @file spawnSandboxKart.ts
 * @description Imperative ECS spawn for the sandbox kart level (no SceneDD).
 */

import type { IEngineContext } from '@naanouff/w3dts-core';
import { spawnLevel, type SpawnLevelResult } from '../shared';
import type { SandboxKartLevel } from './types';

/**
 * Loads graphs/materials/meshes from the level spec and spawns all entities into the ECS.
 */
export async function spawnSandboxKart(
  engine: IEngineContext,
  level: SandboxKartLevel
): Promise<SpawnLevelResult> {
  return spawnLevel(engine, level);
}
