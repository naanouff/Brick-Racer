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
  parseBrickBatchKey,
  partSizeMeters,
  resolveColorId,
  resolvePartId,
  type BrickBatchKey,
  type BrickColorId,
  type BrickPartId,
  type BrickPose,
} from './brickCatalog';
export {
  BRICK_CATALOG,
  FOUNTAIN_BOM_PART_IDS,
  catalogCanonicalColorIds,
  catalogCanonicalPartIds,
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
  FOUNTAIN_ANCHOR,
  FOUNTAIN_BOUNDING_RADIUS,
  FOUNTAIN_MANUAL,
  buildFountainBrickPoses,
  fountainBrickLandmarkSpec,
  fountainShellReport,
} from './landmark/fountainKit';
export {
  assembleManual,
  bakeShell,
  formatManualIssues,
  manualToLandmark,
  validateManual,
  ManualAssembleError,
  type BrickManual,
  type ManualLandmarkResult,
  type ShellBakeReport,
} from './manual';
