/**
 * @file rubberMapSets.ts
 * @description AmbientCG Rubber004 maps for LEGO rubber finish (MT2/MT3).
 * Same packing as plastic: surface.A = roughness, RGB ignored; GL normal map.
 */

import type { MaterialSpec } from '../../../levels/shared/levelTypes';

export const RUBBER_MAP_ID = '004' as const;

export const RUBBER_MAP_SET = {
  id: RUBBER_MAP_ID,
  label: 'Rubber004',
  surface: '/minifig/rubber/rubber004-surface.webp',
  normal: '/minifig/rubber/rubber004-normal.webp',
} as const;

/** Slightly denser than ABS plastic — fine rubber grain on tires / grips. */
export const RUBBER_UV_SCALE = 0.18;
export const RUBBER_NORMAL_SCALE = 0.7;

/** Bind Rubber004 into a catalog / landmark MaterialSpec (CatalogPlasticPBR). */
export function applyAmbientRubberMaps(spec: MaterialSpec): void {
  spec.properties = {
    ...spec.properties,
    usePlasticMaps: 1,
    plasticUvScale: RUBBER_UV_SCALE,
    plasticNormalScale: RUBBER_NORMAL_SCALE,
    emissiveTexture: RUBBER_MAP_SET.surface,
    normalTexture: RUBBER_MAP_SET.normal,
    grainAmount: 0,
    normalDetailScale: 0,
  };
}

/** Property bag for runtime Material clones (GPU textures resolved later / copied). */
export function rubberMapPropertyOverrides(): Record<string, unknown> {
  return {
    usePlasticMaps: 1,
    plasticUvScale: RUBBER_UV_SCALE,
    plasticNormalScale: RUBBER_NORMAL_SCALE,
    emissiveTexture: RUBBER_MAP_SET.surface,
    normalTexture: RUBBER_MAP_SET.normal,
    grainAmount: 0,
    normalDetailScale: 0,
  };
}
