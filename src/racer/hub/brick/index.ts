/**
 * @file index.ts
 * @description Brick Module Kit public exports (BW1).
 */

export {
  B,
  P,
  S,
  snapBrickPosition,
  snapPlate,
  snapStud,
} from './brickUnits';
export {
  BRICK_COLOR_ACCEPT_IDS,
  BRICK_COLOR_IDS,
  BRICK_MESH_ID,
  BRICK_PART_ACCEPT_IDS,
  BRICK_PART_IDS,
  brickBatchKey,
  brickMaterialId,
  countBrickBatches,
  countBrickInstances,
  getColor,
  getPart,
  groupBrickPoses,
  isBrickColorId,
  isBrickPartId,
  materialOf,
  parseBrickBatchKey,
  partSizeMeters,
  resolveColorId,
  resolvePartId,
  type BrickBatchKey,
  type BrickColorId,
  type BrickMaterialKind,
  type BrickPartId,
  type BrickPose,
} from './brickCatalog';
export {
  BRICK_CATALOG,
  BRICK_MATERIAL_KINDS,
  FOUNTAIN_BOM_PART_IDS,
  catalogCanonicalColorIds,
  catalogCanonicalPartIds,
  catalogColorsByMaterial,
  catalogCommonColorIds,
  catalogCommonColors,
  isBrickMaterialKind,
  partMeshStatus,
  type BrickMeshStatus,
  type BrickPartDef,
  type BrickColorDef,
} from './catalog';
export { brickCatalogMaterials } from './brickMaterials';
export { BRICK_INSTANCE_STRIDE_F, packBrickInstanceData } from './brickInstanceData';
export {
  spawnBrickLandmark,
  type BrickLandmarkSpec,
} from './spawnBrickLandmark';
export {
  landmarkLdrawIds,
  spawnLandmarkLdraw,
} from './spawnLandmarkLdraw';
export { isInvertedDishPart, packLdrawInstanceData } from './brickLdrawInstanceData';
export {
  ensureBrickMaterial,
  ensureLandmarkPlasticMaterial,
  landmarkAgingTextureId,
  landmarkPlasticMaterialId,
  LANDMARK_PLASTIC_SET,
} from './landmarkPlasticMaterial';
export {
  RUBBER_PRESET,
  TRANSPARENT_PRESET,
  applyPresetToProps,
  materialKindNeedsBlend,
  presetFor,
  presetForColorId,
  type BrickMaterialPreset,
} from './materials/brickMaterialPresets';
export {
  RUBBER_MAP_SET,
  RUBBER_UV_SCALE,
  applyAmbientRubberMaps,
} from './materials/rubberMapSets';
export {
  FOUNTAIN_ANCHOR,
  FOUNTAIN_BOUNDING_RADIUS,
  FOUNTAIN_MANUAL,
  buildFountainBrickPoses,
  fountainBrickLandmarkSpec,
  fountainShellReport,
} from './landmark/fountainKit';
export {
  FOUNTAIN_LDRAW_PARTS,
  fountainLdrawGamePose,
  fountainLdrawIds,
  type FountainLdrawPart,
  type FountainLdrawRole,
} from './landmark/fountainLdraw';
export { spawnFountainLdraw } from './landmark/spawnFountainLdraw';
export {
  assembleManual,
  bakeShell,
  brickifyAssembly,
  brickifyLayers,
  BrickifyError,
  formatAssemblyIssues,
  formatLayersIssues,
  formatManualIssues,
  manualToLandmark,
  validateAssembly,
  validateLayers,
  validateManual,
  ManualAssembleError,
  type BrickAssembly,
  type BrickLayer,
  type BrickLayers,
  type BrickManual,
  type LayerKind,
  type ManualLandmarkResult,
  type ShellBakeReport,
} from './manual';
