/**
 * @file landmarkPlasticMaterial.ts
 * @description Landmark / brick LDraw materials = catalog 017B clone + MT2 finish preset.
 *
 * Clones an uploaded catalog plastic material (GPUTextures already bound)
 * and applies BrickMaterialKind presets (rubber, transparent, chrome, …).
 */

import { vec3 } from 'gl-matrix';
import { Material, type Engine, type Material as MaterialType } from '@naanouff/w3dts-core';
import {
  brickMaterialId,
  getColor,
  materialOf,
  resolveColorId,
  type BrickColorId,
} from './brickCatalog';
import {
  catalogPlasticMaterialId,
  DEFAULT_CATALOG_PLASTIC_SET,
  type CatalogPlasticSet,
} from './catalog/catalogPlasticMaterials';
import { MINIFIG_LDRAW_PLASTIC_SET } from '../../minifig/ldrawPlasticMaterial';
import { MINIFIG_WHITE_TEXTURE_ID } from '../../minifig/plasticMaterial';
import {
  applyPresetToProps,
  materialKindNeedsBlend,
  presetFor,
  type BrickMaterialPreset,
} from './materials/brickMaterialPresets';
import { RUBBER_MAP_SET } from './materials/rubberMapSets';
import type { BrickMaterialKind } from './catalog/types';

/** AmbientCG set for landmarks — same as minifig LDraw (017B). */
export const LANDMARK_PLASTIC_SET = MINIFIG_LDRAW_PLASTIC_SET;

export function landmarkAgingTextureId(ldrawId: string): string {
  return `LM_ldraw_aging.${ldrawId}`;
}

/** Plastic keeps the legacy id shape; other finishes include the kind. */
export function landmarkPlasticMaterialId(ldrawId: string, colorId: BrickColorId): string {
  return landmarkBrickMaterialId(ldrawId, colorId, materialOf(colorId));
}

export function landmarkBrickMaterialId(
  ldrawId: string,
  colorId: BrickColorId,
  kind: BrickMaterialKind = materialOf(colorId)
): string {
  const color = resolveColorId(colorId) ?? colorId;
  if (kind === 'plastic') {
    return `LM_plastic_${LANDMARK_PLASTIC_SET}_${color}_${ldrawId}`;
  }
  return `LM_${kind}_${LANDMARK_PLASTIC_SET}_${color}_${ldrawId}`;
}

function findCatalogPlasticTemplate(
  engine: Engine,
  colorId: BrickColorId
): MaterialType | null {
  const rm = engine.resourceManager;
  const primary = catalogPlasticMaterialId(LANDMARK_PLASTIC_SET, colorId, true);
  const alt = catalogPlasticMaterialId('003', colorId, true);
  const direct = rm.getMaterialByName(primary) ?? rm.getMaterialByName(alt);
  if (direct) return direct;

  // Lazy: retint any uploaded 017b / 003 plastic (common palette donor).
  const donor =
    rm.getMaterialByName(
      catalogPlasticMaterialId(LANDMARK_PLASTIC_SET, 'light_bluish_grey', true)
    ) ??
    rm.getMaterialByName(catalogPlasticMaterialId(LANDMARK_PLASTIC_SET, 'white', true)) ??
    rm.getMaterialByName(catalogPlasticMaterialId('003', 'light_bluish_grey', true));
  if (!donor?.shaderGraph) return null;

  const tint = getColor(colorId)?.rgb ?? [0.63, 0.66, 0.7];
  const name = catalogPlasticMaterialId(LANDMARK_PLASTIC_SET, colorId, true);
  const existing = rm.getMaterialByName(name);
  if (existing) return existing;

  const mat = cloneMaterial(donor, name, tint, null);
  applyPresetOntoMaterial(engine, mat, presetFor('plastic', getColor(colorId)), tint, 'plastic');
  rm.uploadMaterial(mat);
  console.info(`[BrickMaterial] lazy catalog plastic ${name} from ${donor.name}`);
  return mat;
}

function cloneMaterial(
  template: MaterialType,
  name: string,
  tint: readonly [number, number, number],
  agingTex: unknown
): MaterialType {
  const mat = new Material({
    name,
    shaderGraph: template.shaderGraph,
    diffuseColor: vec3.fromValues(tint[0]!, tint[1]!, tint[2]!),
    metallic: template.metallic,
    roughness: template.roughness,
    alphaMode: template.alphaMode,
    alphaCutoff: template.alphaCutoff,
    doubleSided: template.doubleSided,
  });
  mat.sampler = template.sampler;
  for (const [k, v] of template.properties.entries()) {
    mat.properties.set(k, v);
  }
  if (agingTex) {
    mat.properties.set('baseColorTexture', agingTex);
    mat.properties.set('useAgingMap', 1);
  }
  mat.properties.set('usePrint', 0);
  mat.properties.set('baseColor', [tint[0]!, tint[1]!, tint[2]!, 1]);
  return mat;
}

function copyRubberMapsFromDonor(engine: Engine, mat: MaterialType): void {
  const rm = engine.resourceManager;
  const donor =
    rm.getMaterialByName(
      catalogPlasticMaterialId(LANDMARK_PLASTIC_SET, 'rubber_black', true)
    ) ??
    rm.getMaterialByName(catalogPlasticMaterialId(LANDMARK_PLASTIC_SET, 'rubber_black', false));
  const surf = donor?.properties.get('emissiveTexture') ?? rm.getTexture(RUBBER_MAP_SET.surface);
  const nrm = donor?.properties.get('normalTexture') ?? rm.getTexture(RUBBER_MAP_SET.normal);
  if (surf) mat.properties.set('emissiveTexture', surf);
  else mat.properties.set('emissiveTexture', RUBBER_MAP_SET.surface);
  if (nrm) mat.properties.set('normalTexture', nrm);
  else mat.properties.set('normalTexture', RUBBER_MAP_SET.normal);
}

function applyPresetOntoMaterial(
  engine: Engine,
  mat: MaterialType,
  preset: BrickMaterialPreset,
  tint: readonly [number, number, number],
  kind: BrickMaterialKind
): void {
  const bag: Record<string, unknown> = {};
  for (const [k, v] of mat.properties.entries()) bag[k] = v;
  applyPresetToProps(bag, preset, tint);
  for (const [k, v] of Object.entries(bag)) {
    mat.properties.set(k, v);
  }
  if (kind === 'rubber') {
    copyRubberMapsFromDonor(engine, mat);
  }
  mat.metallic = preset.metallic;
  mat.roughness = preset.roughness;
  if (preset.alphaMode) mat.alphaMode = preset.alphaMode;
  if (preset.doubleSided != null) mat.doubleSided = preset.doubleSided;
  mat.diffuseColor = vec3.fromValues(tint[0]!, tint[1]!, tint[2]!);
}

/**
 * Catalog 017B (+ maps) for this part/colour, with finish preset and optional UV1 aging.
 */
export function ensureBrickMaterial(
  engine: Engine,
  ldrawId: string,
  colorId: BrickColorId,
  hasAging: boolean
): MaterialType | null {
  const rm = engine.resourceManager;
  const kind = materialOf(colorId);
  const name = landmarkBrickMaterialId(ldrawId, colorId, kind);
  const existing = rm.getMaterialByName(name);
  if (existing) return existing;

  const template = findCatalogPlasticTemplate(engine, colorId);
  if (!template?.shaderGraph) {
    console.warn(
      `[BrickMaterial] no catalog plastic for ${colorId}. Flat brick fallback (${brickMaterialId(colorId)}).`
    );
    return rm.getMaterialByName(brickMaterialId(colorId)) ?? null;
  }

  const tint = getColor(colorId)?.rgb ?? [0.63, 0.66, 0.7];
  const preset = presetFor(kind, getColor(colorId));
  const wantsAging =
    hasAging && preset.useAgingMap !== 0 && !materialKindNeedsBlend(kind);
  const agingId = wantsAging ? landmarkAgingTextureId(ldrawId) : null;
  const agingTex = agingId ? rm.getTexture(agingId) : null;

  // Plastic without per-part aging can share the catalog template only if finish is plastic.
  if (kind === 'plastic' && !agingTex) {
    return template;
  }

  const whiteTex = rm.getTexture(MINIFIG_WHITE_TEXTURE_ID);
  const mat = cloneMaterial(template, name, tint, agingTex);
  if (!mat.properties.get('emissiveTexture') && whiteTex) {
    mat.properties.set('emissiveTexture', whiteTex);
  }
  applyPresetOntoMaterial(engine, mat, preset, tint, kind);

  console.info(
    `[BrickMaterial] ${name}: kind=${kind} from ${template.name}, aging=${agingTex ? 1 : 0}`
  );

  rm.uploadMaterial(mat);
  return mat;
}

/**
 * @deprecated Prefer ensureBrickMaterial — kept for call-site compat.
 */
export function ensureLandmarkPlasticMaterial(
  engine: Engine,
  ldrawId: string,
  colorId: BrickColorId,
  hasAging: boolean
): MaterialType | null {
  return ensureBrickMaterial(engine, ldrawId, colorId, hasAging);
}

/** Whether this colour's batches should cast shadows. */
export function brickMaterialCastShadow(
  colorId: BrickColorId,
  landmarkDefault: boolean
): boolean {
  const kind = materialOf(colorId);
  const preset = presetFor(kind, getColor(colorId));
  if (preset.castShadow === false || materialKindNeedsBlend(kind)) return false;
  return landmarkDefault;
}

export type { CatalogPlasticSet };
export { DEFAULT_CATALOG_PLASTIC_SET };
