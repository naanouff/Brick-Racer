/**
 * @file brickMaterials.ts
 * @description Pastel plastic PBR specs from BC1 color catalog.
 */

import type { MaterialSpec } from '../../levels/shared/levelTypes';
import { brickMaterialId, type BrickColorId } from './brickCatalog';
import { BRICK_CATALOG, getColor } from './catalog';

function plasticMat(colorId: BrickColorId): MaterialSpec {
  const def = getColor(colorId);
  const baseColor = def ? [...def.rgb] : [0.7, 0.7, 0.7];
  const roughness = def?.translucent ? 0.22 : 0.38;
  return {
    shaderGraphId: 'pbr',
    name: brickMaterialId(colorId),
    properties: {
      baseColor,
      roughness,
      metallic: 0.04,
    },
  };
}

/** Merge into LevelSpec.materials. */
export function brickCatalogMaterials(): Record<string, MaterialSpec> {
  const out: Record<string, MaterialSpec> = {};
  for (const c of BRICK_CATALOG.colors) {
    out[brickMaterialId(c.id)] = plasticMat(c.id);
  }
  return out;
}
