/**
 * @file index.ts
 * @description Brick part catalog public API (BC1).
 */

export type {
  BrickCatalog,
  BrickColorDef,
  BrickFootprint,
  BrickMeshStatus,
  BrickPartCategory,
  BrickPartDef,
} from './types';
export {
  BRICK_CATALOG,
  FOUNTAIN_BOM_PART_IDS,
  catalogCanonicalColorIds,
  catalogCanonicalPartIds,
  catalogColorAcceptIds,
  catalogPartAcceptIds,
  getColor,
  getPart,
  isCatalogColor,
  isCatalogPart,
  partFootprintFromCatalog,
  partMeshStatus,
  registerPartRuntime,
  resolveColorId,
  resolvePartId,
} from './loadCatalog';
export {
  footprintFromMasterDims,
  type MasterDimsStuds,
} from './masterFootprint';
export {
  clearMasterIndexCache,
  loadMasterIndex,
  type MasterIndexEntry,
  type MasterIndexFile,
} from './masterIndex';
export {
  BC1_STAGING_KEY,
  clearStaging,
  guessPartCategory,
  mergePartsJson,
  readStaging,
  removeStaging,
  upsertStaging,
  writeStaging,
  type StagingPart,
} from './bc1Staging';
export {
  clearCatalogPreview,
  spawnCatalogMeshPreview,
  spawnCatalogPreview,
  type CatalogMeshPreviewOpts,
  type CatalogMeshPreviewResult,
  type CatalogPreviewOpts,
} from './spawnCatalogPreview';
export {
  clearLdrawMeshCache,
  ensureLdrawUploadedMesh,
  getCachedLdrawMesh,
  type EnsureLdrawMeshOpts,
  type LdrawUploadedMesh,
} from './ldrawMeshCache';
export {
  CATALOG_PLASTIC_SETS,
  CATALOG_UV_GRID_MATERIAL_ID,
  CATALOG_UV_GRID_UV1_MATERIAL_ID,
  catalogPlasticMaterialId,
  catalogPlasticMaterials,
  isCatalogPlasticSet,
  type CatalogPlasticSet,
} from './catalogPlasticMaterials';
