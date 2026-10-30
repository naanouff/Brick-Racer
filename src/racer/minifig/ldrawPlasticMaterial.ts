/**
 * @file ldrawPlasticMaterial.ts
 * @description LDraw minifig plastic (MF2): AmbientCG 017b + catalog-lab tuning, prints kept.
 */

import type { MaterialSpec } from '../levels/shared/levelTypes';
import {
  CATALOG_PLASTIC_SHADER_ID,
  tuneCatalogPlastic,
} from '../hub/brick/catalog/catalogPlasticMaterials';
import { minifigLdrawPrintFrame, type MinifigLdrawRole } from './ldrawAssembly';
import { applyAmbientPlasticMaps } from './plasticMapSets';
import { MINIFIG_WHITE_TEXTURE_ID, minifigPlasticMaterial } from './plasticMaterial';

export const MINIFIG_LDRAW_PLASTIC_SET = '017b' as const;

export type LdrawPlasticMatOpts = {
  name: string;
  tintRgb: [number, number, number];
  role: MinifigLdrawRole;
  printTextureId?: string | null;
  /** Per-part UV1 aging map. Ignored on printed parts (same texture slot). */
  agingTextureId?: string | null;
  metallic?: number;
};

/**
 * Same treatment as the catalog preview. Printed parts read AO / cavity / wear
 * from the baked vertex colours instead of the UV1 map, because the print owns
 * `baseColorTexture`.
 */
export function minifigLdrawPlasticMaterial(opts: LdrawPlasticMatOpts): MaterialSpec {
  const spec = minifigPlasticMaterial({
    name: opts.name,
    tintRgb: opts.tintRgb,
    printTextureId: opts.printTextureId,
    metallic: opts.metallic,
  });
  applyAmbientPlasticMaps({ [opts.name]: spec }, MINIFIG_LDRAW_PLASTIC_SET);
  spec.shaderGraphId = CATALOG_PLASTIC_SHADER_ID;
  tuneCatalogPlastic(spec, true);

  const print = opts.printTextureId ?? null;
  const frame = minifigLdrawPrintFrame(opts.role);
  const useAgingMap = !print && !!opts.agingTextureId;
  spec.properties = {
    ...spec.properties,
    useAgingMap: useAgingMap ? 1 : 0,
    usePrint: print && frame ? 1 : 0,
    printFrame: frame ? [...frame] : spec.properties.printFrame,
    baseColorTexture:
      print ?? (useAgingMap ? opts.agingTextureId! : MINIFIG_WHITE_TEXTURE_ID),
  };
  return spec;
}
