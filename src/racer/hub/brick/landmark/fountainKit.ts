/**
 * @file fountainKit.ts
 * @description landmark.fountain via mode d'emploi JSON (assemble + shell bake).
 */

import fountainManualJson from '../manuals/fountain.manual.json';
import { manualToLandmark } from '../manual/manualToLandmark';
import type { BrickPose } from '../brickCatalog';

/** Plan AABB: center (20, 1, 20), size 3×2×3 — base y=0 → top y=2. */
export const FOUNTAIN_ANCHOR: [number, number, number] = [20, 1, 20];
export const FOUNTAIN_BOUNDING_RADIUS = 2.4;

export const FOUNTAIN_MANUAL = fountainManualJson;

/** Assembly poses (shell bake when `shell` is true). */
export function buildFountainBrickPoses(shell = true): readonly BrickPose[] {
  return manualToLandmark(fountainManualJson, { shell }).spec.poses;
}

export function fountainBrickLandmarkSpec(shell = true) {
  return manualToLandmark(fountainManualJson, { shell }).spec;
}

export function fountainShellReport(shell = true) {
  return manualToLandmark(fountainManualJson, { shell }).report;
}
