/**
 * @file manualToLandmark.ts
 * @description BrickManual → BrickLandmarkSpec (assemble + optional shell bake).
 */

import { countBrickBatches } from '../brickCatalog';
import type { BrickLandmarkSpec } from '../spawnBrickLandmark';
import { assembleManual, type AssembleManualResult } from './assembleManual';
import { bakeShell, type ShellBakeReport } from './bakeShell';
import type { BrickManual } from './manualSchema';

export type ManualLandmarkResult = {
  spec: BrickLandmarkSpec;
  report: ShellBakeReport;
  assembled: AssembleManualResult;
  batches: number;
};

function boundingRadiusFromEnvelope(size: readonly [number, number, number]): number {
  const hx = size[0] * 0.5;
  const hy = size[1] * 0.5;
  const hz = size[2] * 0.5;
  return Math.sqrt(hx * hx + hy * hy + hz * hz) + 0.2;
}

function anchorFromManual(manual: BrickManual): [number, number, number] {
  const [ox, oy, oz] = manual.origin;
  const [, sy] = manual.envelope.size;
  return [ox, oy + sy * 0.5, oz];
}

/**
 * Full pipeline: validate/assemble → bake shell → landmark spec for spawnBrickLandmark.
 */
export function manualToLandmark(
  raw: unknown,
  opts?: { shell?: boolean; castShadow?: boolean }
): ManualLandmarkResult {
  const assembled = assembleManual(raw);
  const shell = bakeShell(assembled.bricks, assembled.occupancy, opts?.shell !== false);
  const { manual } = assembled;
  const spec: BrickLandmarkSpec = {
    id: manual.id,
    poses: shell.poses,
    anchor: anchorFromManual(manual),
    boundingRadius: boundingRadiusFromEnvelope(manual.envelope.size),
    castShadow: opts?.castShadow ?? false,
  };
  return {
    spec,
    report: shell.report,
    assembled,
    batches: countBrickBatches(shell.poses),
  };
}
