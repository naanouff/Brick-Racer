/**
 * @file index.ts
 * @description Minifig GPROC foundation exports (BRICK-MF1).
 */

export { PART_CATALOG, getCatalogEntry, requireCatalogEntry, listCatalogForSlot } from './catalog';
export {
  assembleMinifig,
  assembleMinifigEntities,
  type AssembleMinifigResult,
} from './assembleMinifig';
export { MINIFIG_GPROC_GRAPHS, type MinifigGprocGraphId } from './gprocGraphs';
export { unwrapMinifigPart, type MinifigUnwrapKind, type UnwrapPartOpts } from './unwrapPart';
export { registerMinifigGprocNodes } from './registerMinifigGprocNodes';
export {
  MINIFIG_PLASTIC_SHADER_ID,
  MINIFIG_PLASTIC_SHADER_URL,
  MINIFIG_WHITE_TEXTURE_ID,
  minifigPlasticMaterial,
} from './plasticMaterial';
export { meshMapPresetForKind } from './meshMapPresets';
export {
  HEAD,
  TORSO,
  ARM,
  HAND,
  HIPS,
  LEG,
  HAT,
  layoutY,
  computePivots,
  MINIFIG_TOTAL_HEIGHT,
} from './dimensions';
export { MINIFIG_PIVOTS } from './sockets';
export {
  DEFAULT_POSE,
  REST_POSE,
  eulerDegToQuat,
  mergePose,
  type EulerDeg,
  type MinifigPose,
  type MinifigPoseJoint,
} from './pose';
export { BOLT_RECIPE, cloneBoltRecipe } from './recipes/c01-bolt';
export {
  loadStoredRecipe,
  saveStoredRecipe,
  resetStoredRecipe,
  MINIFIG_RECIPE_STORAGE_KEY,
} from './recipeStorage';
export { MINIFIG_SOCKETS } from './sockets';
export {
  MINIFIG_SLOTS,
  MINIFIG_PART_SLOTS,
  type MinifigRecipe,
  type MinifigSlot,
  type MinifigPartSlot,
  type MinifigSlotAssignment,
  type MinifigCatalogEntry,
} from './types';
export {
  validateRecipe,
  assertValidRecipe,
  type RecipeValidationResult,
  type RecipeValidationError,
} from './validateRecipe';
