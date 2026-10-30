/**
 * @file spawnCatalogLab.ts
 * @description Spawn catalog-lab level (empty orbit room for part preview).
 */

import type { Engine, IEngineContext, IProject } from '@naanouff/w3dts-core';
import { clearCatalogPreview } from '../../hub/brick/catalog/spawnCatalogPreview';
import { spawnLevel, type SpawnLevelResult } from '../shared';
import { buildCatalogStudioHdr } from './catalogStudioHdr';
import { catalogLabSpec } from './catalogLabSpec';

export type CatalogLabSpawnResult = SpawnLevelResult;

let studioHdr: ArrayBuffer | null = null;
let studioHdrApplied = false;

function loadHdr(
  project: IProject
): project is IProject & {
  loadEnvironmentFromHdrBuffer(engine: Engine, buffer: ArrayBuffer): Promise<void>;
} {
  return (
    typeof (project as { loadEnvironmentFromHdrBuffer?: unknown }).loadEnvironmentFromHdrBuffer ===
    'function'
  );
}

export async function spawnCatalogLab(
  engine: IEngineContext
): Promise<CatalogLabSpawnResult> {
  clearCatalogPreview(engine);
  const spawned = await spawnLevel(engine, catalogLabSpec);
  const full = engine as Engine;
  const project = full.director?.getActiveProject();
  if (!studioHdrApplied && project && loadHdr(project)) {
    studioHdr ??= buildCatalogStudioHdr();
    await project.loadEnvironmentFromHdrBuffer(full, studioHdr);
    studioHdrApplied = true;
  }
  return spawned;
}
