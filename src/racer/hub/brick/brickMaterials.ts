/**
 * @file brickMaterials.ts
 * @description Pastel plastic PBR specs from BC1 color catalog.
 */

import type { MaterialSpec } from '../../levels/shared/levelTypes';
import {
  BRICK_GHOST_OPACITY,
  brickGhostMaterialId,
  brickMaterialId,
  type BrickColorId,
} from './brickCatalog';
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

function ghostMat(colorId: BrickColorId): MaterialSpec {
  const def = getColor(colorId);
  const rgb = def ? def.rgb : ([0.7, 0.7, 0.7] as const);
  return {
    shaderGraphId: 'pbr',
    name: brickGhostMaterialId(colorId),
    properties: {
      baseColor: [rgb[0], rgb[1], rgb[2], BRICK_GHOST_OPACITY],
      roughness: 0.38,
      metallic: 0.04,
      opacity: BRICK_GHOST_OPACITY,
      alphaMode: 'BLEND',
      doubleSided: true,
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

/** Brush-mode placement ghosts (semi-transparent). */
export function brickGhostMaterials(): Record<string, MaterialSpec> {
  const out: Record<string, MaterialSpec> = {};
  for (const c of BRICK_CATALOG.colors) {
    out[brickGhostMaterialId(c.id)] = ghostMat(c.id);
  }
  return out;
}
