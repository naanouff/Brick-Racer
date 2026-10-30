/**
 * @file preloadMinifigLdraw.ts
 * @description Fetch baked LDraw meshes via IPC and upload for a recipe (MF2 / CL5).
 */

import type { Engine, IEngineContext, Mesh } from '@naanouff/w3dts-core';
import { registerAgingTexture } from '../hub/brick/catalog/catalogAgingTexture';
import {
  ensureLdrawUploadedMesh,
  fetchLdrawPart,
  hasLdrawIpc,
} from '../hub/brick/catalog/ldrawMeshCache';
import { collectRecipeLdrawIds, minifigLdrawAgingTextureId, minifigLdrawMeshId } from './catalog';
import type { MinifigRecipe } from './types';

export type PreloadMinifigLdrawResult = {
  /** meshId (`MF_ldraw.{id}`) → uploaded Mesh */
  meshes: Map<string, Mesh>;
  /** Design id → game AABB size (m). */
  sizes: Map<string, readonly [number, number, number]>;
  /** Design ids that uploaded successfully. */
  readyIds: Set<string>;
  /** Design ids whose UV1 aging map is registered (`minifigLdrawAgingTextureId`). */
  agingIds: Set<string>;
  /** Design ids that failed to load. */
  missing: string[];
};

/**
 * Preload every LDraw id referenced by `recipe`. Safe when IPC is absent
 * (returns empty meshes + all ids in `missing`).
 */
export async function preloadMinifigLdrawMeshes(
  engine: IEngineContext,
  recipe: MinifigRecipe
): Promise<PreloadMinifigLdrawResult> {
  const full = engine as Engine;
  const meshes = new Map<string, Mesh>();
  const sizes = new Map<string, readonly [number, number, number]>();
  const readyIds = new Set<string>();
  const agingIds = new Set<string>();
  const missing: string[] = [];
  const ids = collectRecipeLdrawIds(recipe);
  if (!hasLdrawIpc()) {
    return { meshes, sizes, readyIds, agingIds, missing: ids };
  }

  const results = await Promise.all(
    ids.map(async (ldrawId) => {
      try {
        return { ldrawId, result: await fetchLdrawPart(ldrawId, 'origin') };
      } catch (err) {
        console.warn(`[MinifigLDraw] ${ldrawId}:`, err);
        return { ldrawId, result: null };
      }
    })
  );

  for (const { ldrawId, result } of results) {
    if (!result || !result.ok) {
      missing.push(ldrawId);
      if (result && !result.ok) console.warn(`[MinifigLDraw] ${ldrawId}: ${result.error}`);
      continue;
    }
    const entry = ensureLdrawUploadedMesh(full, {
      key: ldrawId,
      ...result.source,
      meshNamePrefix: 'MF_ldraw',
      anchor: 'origin',
    });
    if (!entry) {
      missing.push(ldrawId);
      continue;
    }
    meshes.set(minifigLdrawMeshId(ldrawId), entry.mesh);
    sizes.set(ldrawId, entry.size);
    readyIds.add(ldrawId);
    if (registerAgingTexture(full, minifigLdrawAgingTextureId(ldrawId), entry.aging)) {
      agingIds.add(ldrawId);
    }
  }

  return { meshes, sizes, readyIds, agingIds, missing };
}

/** True when at least one LDraw mesh for the recipe is ready. */
export function hasAnyLdrawMesh(
  meshes: ReadonlyMap<string, Mesh>,
  recipe: MinifigRecipe
): boolean {
  for (const id of collectRecipeLdrawIds(recipe)) {
    if (meshes.has(minifigLdrawMeshId(id))) return true;
  }
  return false;
}
