/**
 * @file spawnMinifigLab.ts
 * @description Spawn minifig-lab with LDraw meshes when IPC is available (MF2e).
 */

import type { IEngineContext } from '@naanouff/w3dts-core';
import { preloadMinifigLdrawMeshes } from '../../minifig/preloadMinifigLdraw';
import { loadStoredRecipe } from '../../minifig/recipeStorage';
import { spawnLevel, type SpawnLevelResult } from '../shared';
import { buildMinifigLabSpec } from './minifigLabSpec';

export async function spawnMinifigLab(engine: IEngineContext): Promise<SpawnLevelResult> {
  const recipe = loadStoredRecipe();
  const preloaded = await preloadMinifigLdrawMeshes(engine, recipe);
  if (preloaded.missing.length > 0) {
    console.warn(
      `[MinifigLab] LDraw missing (${preloaded.missing.join(', ')}) — GPROC fallback for those parts`
    );
  }
  const spec = buildMinifigLabSpec({
    recipe,
    ldraw:
      preloaded.readyIds.size > 0
        ? {
            readyIds: preloaded.readyIds,
            sizes: preloaded.sizes,
            agingIds: preloaded.agingIds,
          }
        : null,
  });
  return spawnLevel(engine, spec, { extraMeshes: preloaded.meshes });
}
