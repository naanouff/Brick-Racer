/**
 * @file index.ts
 * @description Brick manual authoring pipeline exports.
 */

export { assembleManual, ManualAssembleError, type AssembleManualResult, type AssembledBrick } from './assembleManual';
export { bakeShell, type ShellBakeReport, type ShellBakeResult } from './bakeShell';
export {
  formatManualIssues,
  validateManual,
  type BrickManual,
  type ManualOp,
  type ManualStep,
  type ManualValidationIssue,
  type ManualValidationResult,
} from './manualSchema';
export { manualToLandmark, type ManualLandmarkResult } from './manualToLandmark';
export {
  cellKey,
  envelopeHalfCells,
  gridMinToWorldCenter,
  isRotDeg,
  partFootprintPlates,
  rotatedFootprint,
  rotToYawRad,
  type RotDeg,
} from './partFootprint';
