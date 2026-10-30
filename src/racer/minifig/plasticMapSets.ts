/**
 * @file plasticMapSets.ts
 * @description AmbientCG plastic sets for a minifig-lab preview (normal + roughness, tint stays the part color).
 * Sampled on the mesh UV (1 unit = 10 cm) with an extra tile scale.
 */

import type { MaterialSpec } from '../levels/shared/levelTypes';

const PLASTIC_SHADER_ID = 'minifig_plastic';
const WHITE_TEXTURE_ID = 'mf_white';

export const MINIFIG_FLAT_NORMAL_ID = 'mf_flat_normal';

export const PLASTIC_MAP_IDS = ['017b', '003'] as const;
export type PlasticMapId = (typeof PLASTIC_MAP_IDS)[number];

export type PlasticMapSet = {
  id: PlasticMapId;
  label: string;
  /** A = roughness. RGB is ignored so the part tint stays the albedo. */
  surface: string;
  normal: string;
};

export const PLASTIC_MAP_SETS: Record<PlasticMapId, PlasticMapSet> = {
  '017b': {
    id: '017b',
    label: '017B',
    surface: '/minifig/plastic/plastic017b-surface.webp',
    normal: '/minifig/plastic/plastic017b-normal.webp',
  },
  '003': {
    id: '003',
    label: '003',
    surface: '/minifig/plastic/plastic003-surface.webp',
    normal: '/minifig/plastic/plastic003-normal.webp',
  },
};

/** `?plastic=003` (default in the lab), `017b`, or `off`. */
export function resolveMinifigPlasticMap(search = ''): PlasticMapId | null {
  const v = (
    new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('plastic') ?? '003'
  ).toLowerCase();
  if (v === 'off' || v === '0' || v === 'none') return null;
  if (v === '017b') return '017b';
  return '003';
}

/**
 * Multiplier on UV0 (10 units per metre).
 * 0.1 stretches one tile over a metre (~3 studs), so the 017B scratches read as
 * wear on a brick. 0.4 repeated the same map every 25 cm and turned them into a web.
 */
export const PLASTIC_UV_SCALE = 0.1;

/** Drive normal + roughness from the set. Albedo stays the minifig tint. */
export function applyAmbientPlasticMaps(
  materials: Record<string, MaterialSpec>,
  setId: PlasticMapId
): void {
  const set = PLASTIC_MAP_SETS[setId];
  for (const spec of Object.values(materials)) {
    if (spec.shaderGraphId !== PLASTIC_SHADER_ID) continue;
    spec.properties = {
      ...spec.properties,
      usePlasticMaps: 1,
      plasticUvScale: PLASTIC_UV_SCALE,
      plasticNormalScale: 0.85,
      emissiveTexture: set.surface,
      normalTexture: set.normal,
      grainAmount: 0.012,
      normalDetailScale: 0.01,
    };
  }
}

export function defaultPlasticMapTextures(): {
  emissiveTexture: string;
  normalTexture: string;
} {
  return {
    emissiveTexture: WHITE_TEXTURE_ID,
    normalTexture: MINIFIG_FLAT_NORMAL_ID,
  };
}
