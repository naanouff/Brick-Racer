/**
 * @file masterFootprint.ts
 * @description Propose BC1 footprint from LDraw AABB studs/plates (CL1a).
 */

import type { BrickFootprint } from './types';

export type MasterDimsStuds = {
  width_studs: number;
  height_plates: number;
  depth_studs: number;
};

/**
 * BC1 puts the long side on Z (Brick 2 x 4 = [2, 3, 4]); LDraw puts it on X.
 * Height strips ~0.5 plate stud protrusion (body-only heuristic).
 * Matches scripts/catalog/build_master_catalog.py footprint_from_master_dims.
 */
export function footprintFromMasterDims(dims: MasterDimsStuds): BrickFootprint {
  const sx = Math.max(1, Math.round(dims.depth_studs));
  const sz = Math.max(1, Math.round(dims.width_studs));
  const py = Math.max(1, Math.round(dims.height_plates - 0.5));
  return [sx, py, sz];
}
