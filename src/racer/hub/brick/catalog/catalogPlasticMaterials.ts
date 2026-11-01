/**
 * @file catalogPlasticMaterials.ts
 * @description Catalog-lab ABS plastic mats: AmbientCG maps without diffuse, BC1 tint (CL3a).
 */

import type { MaterialSpec } from '../../../levels/shared/levelTypes';
import {
  applyAmbientPlasticMaps,
  type PlasticMapId,
} from '../../../minifig/plasticMapSets';
import {
  MINIFIG_UV_GRID_SHADER_ID,
  MINIFIG_UV_GRID_TEXTURE_ID,
} from '../../../minifig/minifigUvGridDebug';
import { minifigPlasticMaterial } from '../../../minifig/plasticMaterial';
import { resolveColorId, type BrickColorId } from '../brickCatalog';
import { catalogCommonColorIds, getColor, materialOf } from './loadCatalog';
import { CATALOG_AGING_TEXTURE_ID } from './catalogAgingTexture';
import {
  applyPresetToProps,
  materialKindNeedsBlend,
  presetFor,
} from '../materials/brickMaterialPresets';
import { applyAmbientRubberMaps } from '../materials/rubberMapSets';

/**
 * Dedicated catalog plastic graph. The UV1 aging map takes the print slot (baseColorTexture):
 * catalog parts have no print, and a 17th sampled texture would break the pipeline layout.
 * Not the ORM slot: the PBR master samples it for AO / roughness / metallic.
 */
export const CATALOG_PLASTIC_SHADER_ID = 'catalog_plastic';
export const CATALOG_PLASTIC_SHADER_URL = '/shader-graphs/CatalogPlasticPBR.json';

/** UV0 debug grid (box projection, repeating). */
export const CATALOG_UV_GRID_MATERIAL_ID = 'CL_uv_grid';
/** UV1 debug grid (per-part 0–1 atlas). */
export const CATALOG_UV_GRID_UV1_MATERIAL_ID = 'CL_uv_grid_uv1';

/** Plastic preview set: AmbientCG id or tint-only. */
export type CatalogPlasticSet = PlasticMapId | 'off';

/** Default preview / lab plastic — same as landmark + minifig LDraw (017B). */
export const DEFAULT_CATALOG_PLASTIC_SET: CatalogPlasticSet = '017b';

/** UI order: preferred set first, then tint-only. */
export const CATALOG_PLASTIC_SETS: readonly CatalogPlasticSet[] = ['017b', '003', 'off'];

export function catalogPlasticMaterialId(
  set: CatalogPlasticSet,
  colorId: BrickColorId,
  aging = true
): string {
  const color = resolveColorId(colorId) ?? colorId;
  return aging ? `CL_plastic_${set}_${color}` : `CL_plastic_${set}_${color}_clean`;
}

function tintFor(colorId: BrickColorId): [number, number, number] {
  const def = getColor(colorId);
  if (!def) return [0.63, 0.66, 0.7];
  return [def.rgb[0]!, def.rgb[1]!, def.rgb[2]!];
}

/**
 * Procedural grain / dirt / fingerprints stay off (they speckle large faces).
 * Aging on reads the UV1 256² bake (AO, cavity, edge wear). Off ignores it.
 */
export function tuneCatalogPlastic(spec: MaterialSpec, aging: boolean): void {
  spec.properties = {
    ...spec.properties,
    aoStrength: aging ? 0.85 : 0,
    cavityStrength: aging ? 0.2 : 0,
    dirtAmount: 0,
    edgeWear: aging ? 0.16 : 0,
    grainAmount: 0,
    greaseGloss: 0,
    fingerprintAmount: 0,
    normalDetailScale: 0,
    useAgingMap: aging ? 1 : 0,
    usePrint: 0,
    baseColorTexture: CATALOG_AGING_TEXTURE_ID,
  };
}

function onePlasticMat(set: CatalogPlasticSet, colorId: string, aging: boolean): MaterialSpec {
  const name = catalogPlasticMaterialId(set, colorId, aging);
  const tint = tintFor(colorId);
  const kind = materialOf(colorId);
  const spec = minifigPlasticMaterial({ name, tintRgb: tint });
  if (set !== 'off' && kind === 'plastic') {
    const bag: Record<string, MaterialSpec> = { [name]: spec };
    applyAmbientPlasticMaps(bag, set);
  }
  spec.shaderGraphId = CATALOG_PLASTIC_SHADER_ID;
  const useAging = aging && !materialKindNeedsBlend(kind);
  tuneCatalogPlastic(spec, useAging);
  const preset = presetFor(kind, getColor(colorId));
  applyPresetToProps(spec.properties, preset, tint);
  if (kind === 'rubber') {
    applyAmbientRubberMaps(spec);
  }
  return spec;
}

function catalogUvGridMaterial(channel: 0 | 1): MaterialSpec {
  return {
    shaderGraphId: MINIFIG_UV_GRID_SHADER_ID,
    name: channel === 0 ? CATALOG_UV_GRID_MATERIAL_ID : CATALOG_UV_GRID_UV1_MATERIAL_ID,
    properties: {
      baseColor: [1, 1, 1, 1],
      roughness: 0.42,
      metallic: 0,
      opacity: 1,
      baseColorTexture: MINIFIG_UV_GRID_TEXTURE_ID,
      uvChannel: channel,
    },
  };
}

/**
 * Set × common-color combos for LevelSpec.materials (no plastic*-color.webp).
 * MT1: only `common` colours (~40) until MT2 lazy ensure — full palette is 300+.
 */
export function catalogPlasticMaterials(): Record<string, MaterialSpec> {
  const out: Record<string, MaterialSpec> = {};
  const colorIds = catalogCommonColorIds();
  for (const set of CATALOG_PLASTIC_SETS) {
    for (const colorId of colorIds) {
      for (const aging of [true, false]) {
        const spec = onePlasticMat(set, colorId, aging);
        out[spec.name] = spec;
      }
    }
  }
  return out;
}

/**
 * UV0 / UV1 debug grid mats — need `minifig_uv_grid` in LevelSpec.shaderGraphs.
 * Only merge into catalog-lab / brick-lab (not city-test).
 */
export function catalogUvGridMaterials(): Record<string, MaterialSpec> {
  return {
    [CATALOG_UV_GRID_MATERIAL_ID]: catalogUvGridMaterial(0),
    [CATALOG_UV_GRID_UV1_MATERIAL_ID]: catalogUvGridMaterial(1),
  };
}

export function isCatalogPlasticSet(value: string): value is CatalogPlasticSet {
  return (CATALOG_PLASTIC_SETS as readonly string[]).includes(value);
}
