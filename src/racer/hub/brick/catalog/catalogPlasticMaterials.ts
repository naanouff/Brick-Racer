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
import { BRICK_COLOR_IDS, getColor, resolveColorId, type BrickColorId } from '../brickCatalog';
import { CATALOG_AGING_TEXTURE_ID } from './catalogAgingTexture';

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

/** Plastic preview set: AmbientCG id or tint-only ABS. */
export type CatalogPlasticSet = PlasticMapId | 'off';

/** UI order: AmbientCG sets first, then tint-only. */
export const CATALOG_PLASTIC_SETS: readonly CatalogPlasticSet[] = ['003', '017b', 'off'];

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
function tuneCatalogPlastic(spec: MaterialSpec, aging: boolean): void {
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
  const spec = minifigPlasticMaterial({ name, tintRgb: tintFor(colorId) });
  if (set !== 'off') {
    const bag: Record<string, MaterialSpec> = { [name]: spec };
    applyAmbientPlasticMaps(bag, set);
  }
  spec.shaderGraphId = CATALOG_PLASTIC_SHADER_ID;
  tuneCatalogPlastic(spec, aging);
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

/** All set × color combos for LevelSpec.materials (no plastic*-color.webp). */
export function catalogPlasticMaterials(): Record<string, MaterialSpec> {
  const out: Record<string, MaterialSpec> = {};
  for (const set of CATALOG_PLASTIC_SETS) {
    for (const colorId of BRICK_COLOR_IDS) {
      for (const aging of [true, false]) {
        const spec = onePlasticMat(set, colorId, aging);
        out[spec.name] = spec;
      }
    }
  }
  out[CATALOG_UV_GRID_MATERIAL_ID] = catalogUvGridMaterial(0);
  out[CATALOG_UV_GRID_UV1_MATERIAL_ID] = catalogUvGridMaterial(1);
  return out;
}

export function isCatalogPlasticSet(value: string): value is CatalogPlasticSet {
  return (CATALOG_PLASTIC_SETS as readonly string[]).includes(value);
}
