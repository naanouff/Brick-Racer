/**
 * @file plasticMaterial.ts
 * @description Minifig lived-in ABS plastic (BRICK-MF3c) — MeshMaps + grain/dirt/grease.
 */

import type { MaterialSpec } from '../levels/shared/levelTypes';
import { HEAD, TORSO } from './dimensions';
import { MINIFIG_FLAT_NORMAL_ID } from './plasticMapSets';

export const MINIFIG_PLASTIC_SHADER_ID = 'minifig_plastic';
export const MINIFIG_PLASTIC_SHADER_URL = '/shader-graphs/MinifigPlasticPBR.json';

/** 1×1 white placeholder so TextureSample is safe when usePrint=0. */
export const MINIFIG_WHITE_TEXTURE_ID = 'mf_white';

/**
 * Defaults tuned for “minifig who’s been in the pits”:
 * MeshMaps drive cavity dirt + edge wear; procedural noise adds ABS grain
 * and oily fingerprint patches in roughness.
 */
export const MINIFIG_ABS_DEFAULTS = {
  roughness: 0.34,
  metallic: 0.04,
  aoStrength: 0.62,
  cavityStrength: 0.28,
  dirtAmount: 0.32,
  dirtColor: [0.12, 0.09, 0.06] as [number, number, number],
  edgeWear: 0.22,
  wearColor: [0.78, 0.74, 0.68] as [number, number, number],
  grainAmount: 0.038,
  grainScale: 48,
  greaseGloss: 0.38,
  fingerprintAmount: 0.2,
  fingerprintScale: 9,
  normalDetailScale: 0.038,
  ior: 1.55,
} as const;

export type PlasticMatOpts = {
  name: string;
  tintRgb: [number, number, number];
  /** Catalog part id — picks the object-space print rectangle. */
  partId?: string;
  /** Catalog print texture URL (loaded into ResourceManager under the same id). */
  printTextureId?: string | null;
  metallic?: number;
};

/**
 * Object-space rectangle the WebP fills (planar +Z). Mesh UVs stay at 10 cm/cell.
 * vec4 = minX, minY, sizeX, sizeY in the part's local frame (Y-up, origin at part center).
 */
export function printFrameForPart(partId: string): [number, number, number, number] {
  const id = partId.toLowerCase();
  if (id.includes('head')) {
    // Barrel wall only — stop under the top rim so the eyes don't land on the stud.
    const minY = -HEAD.height * 0.5 + HEAD.neckRingHeight;
    const maxY = HEAD.height * 0.5 - 0.06;
    const halfW = HEAD.radius * 0.92;
    return [-halfW, minY, halfW * 2, Math.max(maxY - minY, 1e-4)];
  }
  if (id.includes('torso')) {
    // Chest width (top), not the wide hem — keeps MECHANIC inside the taper.
    // Top of the frame sits under the neck bevel so the gear isn't clipped off.
    const chestW = TORSO.widthTop;
    const maxY = TORSO.height * 0.5 - TORSO.bevel * 2;
    const sizeY = TORSO.height * 0.92;
    return [-chestW * 0.5, maxY - sizeY, chestW, sizeY];
  }
  return [-0.5, -0.5, 1, 1];
}

export function minifigPlasticMaterial(opts: PlasticMatOpts): MaterialSpec {
  const usePrint = opts.printTextureId ? 1 : 0;
  const [r, g, b] = opts.tintRgb;
  const d = MINIFIG_ABS_DEFAULTS;
  return {
    shaderGraphId: MINIFIG_PLASTIC_SHADER_ID,
    name: opts.name,
    properties: {
      baseColor: [r, g, b, 1],
      roughness: d.roughness,
      metallic: opts.metallic ?? d.metallic,
      aoStrength: d.aoStrength,
      cavityStrength: d.cavityStrength,
      dirtAmount: d.dirtAmount,
      dirtColor: [...d.dirtColor],
      edgeWear: d.edgeWear,
      wearColor: [...d.wearColor],
      grainAmount: d.grainAmount,
      grainScale: d.grainScale,
      greaseGloss: d.greaseGloss,
      fingerprintAmount: d.fingerprintAmount,
      fingerprintScale: d.fingerprintScale,
      normalDetailScale: d.normalDetailScale,
      ior: d.ior,
      usePrint,
      printFrame: [...printFrameForPart(opts.partId ?? opts.name)],
      baseColorTexture: opts.printTextureId ?? MINIFIG_WHITE_TEXTURE_ID,
      usePlasticMaps: 0,
      plasticUvScale: 0.4,
      plasticNormalScale: 0.85,
      emissiveTexture: MINIFIG_WHITE_TEXTURE_ID,
      normalTexture: MINIFIG_FLAT_NORMAL_ID,
    },
  };
}
