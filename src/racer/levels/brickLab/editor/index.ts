/**
 * @file index.ts
 * @description Brick-lab manual editor public API (ED).
 */

export {
  buildOccupancy,
  createEmptyEditorState,
  createEditorOpId,
  findOpAtCell,
  findTopOpAtStud,
  footprintCollides,
  moveEditorBrick,
  placeEditorBrick,
  pushUndo,
  redoEditor,
  removeEditorBrick,
  rotateEditorBrush,
  rotateSelectedBrick,
  stackHeightUnder,
  undoEditor,
  type EditorBrickOp,
  type EditorState,
  type EditorTool,
} from './editorState';
export {
  editorOpsToManualOps,
  editorStateToManual,
  isValidManualStem,
  manualToEditorState,
  validateEditorManual,
} from './editorIo';
export { screenToStudHit, type StudHit } from './editorRay';
export {
  applyMcpCommand,
  mcpCommandNeedsSceneSync,
  type McpBrickSpec,
  type McpCommand,
  type McpHandlerContext,
  type McpResult,
} from './mcpCommands';
export {
  macroColumn,
  macroFillRect,
  macroRingOrDisc,
  macroWall,
  type MacroBrickSpec,
  type Vec3,
} from './mcpMacros';

