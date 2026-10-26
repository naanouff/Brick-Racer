/**
 * @file brickMaterials.ts
 * @description Pastel plastic PBR specs for brick catalog colors.
 */

import type { MaterialSpec } from '../../levels/shared/levelTypes';
import { BRICK_COLOR_IDS, brickMaterialId, type BrickColorId } from './brickCatalog';

const PLASTIC: Record<BrickColorId, [number, number, number]> = {
  cyan: [0.35, 0.78, 0.88],
  white: [0.92, 0.92, 0.94],
  lime: [0.45, 0.82, 0.35],
  sand: [0.82, 0.74, 0.58],
  /** A1 plaza fountain brick (reddish-brown). */
  terracotta: [0.72, 0.4, 0.3],
  yellow: [0.95, 0.82, 0.18],
  black: [0.12, 0.12, 0.14],
};

function plasticMat(colorId: BrickColorId): MaterialSpec {
  const baseColor = PLASTIC[colorId];
  return {
    shaderGraphId: 'pbr',
    name: brickMaterialId(colorId),
    properties: {
      baseColor: [...baseColor],
      roughness: 0.38,
      metallic: 0.04,
    },
  };
}

/** Merge into LevelSpec.materials. */
export function brickCatalogMaterials(): Record<string, MaterialSpec> {
  const out: Record<string, MaterialSpec> = {};
  for (const id of BRICK_COLOR_IDS) {
    out[brickMaterialId(id)] = plasticMat(id);
  }
  return out;
}
