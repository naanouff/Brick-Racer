/**
 * @file brickMaterials.ts
 * @description Flat PBR brick mats from official palette + MT2 finish presets.
 */

import type { MaterialSpec } from '../../levels/shared/levelTypes';
import {
  BRICK_GHOST_OPACITY,
  brickGhostMaterialId,
  brickMaterialId,
  type BrickColorId,
} from './brickCatalog';
import { BRICK_CATALOG, getColor } from './catalog';
import { applyPresetToProps, presetForColorId } from './materials/brickMaterialPresets';

function plasticMat(colorId: BrickColorId): MaterialSpec {
  const def = getColor(colorId);
  const baseColor = (def ? def.rgb : ([0.7, 0.7, 0.7] as const)) as [
    number,
    number,
    number,
  ];
  const preset = presetForColorId(colorId);
  const properties: MaterialSpec['properties'] = {};
  applyPresetToProps(properties, preset, baseColor);
  return {
    shaderGraphId: 'pbr',
    name: brickMaterialId(colorId),
    properties,
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
