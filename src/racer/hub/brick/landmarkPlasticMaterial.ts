/**
 * @file landmarkPlasticMaterial.ts
 * @description Landmark LDraw plastic = catalog 017B + per-part UV1 aging (same as minifig/catalog).
 *
 * Clones the level's uploaded catalog plastic material (GPUTextures already bound)
 * and swaps only the UV1 aging map — avoids re-resolving AmbientCG URLs at runtime.
 */

import { vec3 } from 'gl-matrix';
import { Material, type Engine, type Material as MaterialType } from '@naanouff/w3dts-core';
import { brickMaterialId, getColor, resolveColorId, type BrickColorId } from './brickCatalog';
import { catalogPlasticMaterialId } from './catalog/catalogPlasticMaterials';
import { MINIFIG_LDRAW_PLASTIC_SET } from '../../minifig/ldrawPlasticMaterial';
import { MINIFIG_WHITE_TEXTURE_ID } from '../../minifig/plasticMaterial';

/** AmbientCG set for landmarks — same as minifig LDraw (017B). */
export const LANDMARK_PLASTIC_SET = MINIFIG_LDRAW_PLASTIC_SET;

export function landmarkAgingTextureId(ldrawId: string): string {
  return `LM_ldraw_aging.${ldrawId}`;
}

export function landmarkPlasticMaterialId(ldrawId: string, colorId: BrickColorId): string {
  const color = resolveColorId(colorId) ?? colorId;
  return `LM_plastic_${LANDMARK_PLASTIC_SET}_${color}_${ldrawId}`;
}

function catalogTemplate(engine: Engine, colorId: BrickColorId): MaterialType | null {
  const rm = engine.resourceManager;
  const primary = catalogPlasticMaterialId(LANDMARK_PLASTIC_SET, colorId, true);
  const alt = catalogPlasticMaterialId('003', colorId, true);
  return rm.getMaterialByName(primary) ?? rm.getMaterialByName(alt) ?? null;
}

/**
 * Catalog 017B plastic for this part, with its UV1 aging map when available.
 * Prefer a per-part clone; if aging is missing, reuse the shared catalog mat (UV0 maps still on).
 */
export function ensureLandmarkPlasticMaterial(
  engine: Engine,
  ldrawId: string,
  colorId: BrickColorId,
  hasAging: boolean
): MaterialType | null {
  const rm = engine.resourceManager;
  const name = landmarkPlasticMaterialId(ldrawId, colorId);
  const existing = rm.getMaterialByName(name);
  if (existing) return existing;

  const template = catalogTemplate(engine, colorId);
  if (!template?.shaderGraph) {
    const known = [
      catalogPlasticMaterialId(LANDMARK_PLASTIC_SET, colorId, true),
      catalogPlasticMaterialId('003', colorId, true),
      brickMaterialId(colorId),
    ];
    console.warn(
      `[LandmarkPlastic] no catalog plastic for ${colorId}. Tried ${known.join(', ')}. Flat brick fallback.`
    );
    return rm.getMaterialByName(brickMaterialId(colorId)) ?? null;
  }

  const agingId = hasAging ? landmarkAgingTextureId(ldrawId) : null;
  const agingTex = agingId ? rm.getTexture(agingId) : null;

  // No per-part aging → shared catalog mat already has UV0 AmbientCG + shared UV1 slot.
  if (!agingTex) {
    console.info(
      `[LandmarkPlastic] ${ldrawId}/${colorId}: using shared ${template.name} (no aging tex)`
    );
    return template;
  }

  const tint = getColor(colorId)?.rgb ?? [0.63, 0.66, 0.7];
  const whiteTex = rm.getTexture(MINIFIG_WHITE_TEXTURE_ID);
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

  mat.properties.set('baseColorTexture', agingTex);
  mat.properties.set('useAgingMap', 1);
  mat.properties.set('usePrint', 0);
  mat.properties.set('baseColor', [tint[0]!, tint[1]!, tint[2]!, 1]);
  if (!mat.properties.get('emissiveTexture') && whiteTex) {
    mat.properties.set('emissiveTexture', whiteTex);
  }

  const usePlastic = mat.properties.get('usePlasticMaps');
  const normal = mat.properties.get('normalTexture');
  console.info(
    `[LandmarkPlastic] ${name}: cloned ${template.name}, usePlasticMaps=${String(usePlastic)}, normal=${typeof normal}`
  );

  rm.uploadMaterial(mat);
  return mat;
}
