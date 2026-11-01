/**
 * @file brickMaterialPresets.ts
 * @description MT2 — PBR property presets per BrickMaterialKind (on top of catalog 017B).
 */

import type { BrickColorDef, BrickMaterialKind } from '../catalog/types';
import { getColor, materialOf } from '../catalog/loadCatalog';

export type BrickMaterialPreset = {
  roughness: number;
  metallic: number;
  /** Kill AmbientCG plastic maps (rubber / chrome look cleaner). */
  usePlasticMaps?: 0 | 1;
  greaseGloss?: number;
  fingerprintAmount?: number;
  grainAmount?: number;
  specularFactor?: number;
  specularColorFactor?: [number, number, number];
  transmissionFactor?: number;
  ior?: number;
  opacity?: number;
  alphaMode?: 'OPAQUE' | 'BLEND' | 'MASK';
  doubleSided?: boolean;
  clearcoatFactor?: number;
  clearcoatRoughnessFactor?: number;
  edgeWear?: number;
  aoStrength?: number;
  /** Skip UV1 aging (glass / chrome). */
  useAgingMap?: 0 | 1;
  castShadow?: boolean;
};

/** Kart tire / Rubber Black — AmbientCG Rubber004 maps + shared with kartWheelLook. */
export const RUBBER_PRESET: BrickMaterialPreset = {
  roughness: 0.94,
  metallic: 0,
  /** AmbientCG Rubber004 via applyAmbientRubberMaps (surface.A + normal). */
  usePlasticMaps: 1,
  greaseGloss: 0,
  fingerprintAmount: 0,
  grainAmount: 0,
  specularFactor: 0.04,
  specularColorFactor: [0.1, 0.1, 0.1],
  edgeWear: 0.22,
  aoStrength: 0.65,
  castShadow: true,
};

export const TRANSPARENT_PRESET: BrickMaterialPreset = {
  roughness: 0.05,
  metallic: 0,
  usePlasticMaps: 0,
  greaseGloss: 0,
  fingerprintAmount: 0,
  grainAmount: 0,
  transmissionFactor: 0.9,
  ior: 1.58,
  opacity: 0.5,
  alphaMode: 'BLEND',
  doubleSided: true,
  useAgingMap: 0,
  edgeWear: 0,
  aoStrength: 0,
  castShadow: false,
};

const PLASTIC_PRESET: BrickMaterialPreset = {
  roughness: 0.34,
  metallic: 0.04,
  castShadow: true,
};

const CHROME_PRESET: BrickMaterialPreset = {
  roughness: 0.08,
  metallic: 1,
  usePlasticMaps: 0,
  greaseGloss: 0,
  useAgingMap: 0,
  castShadow: true,
};

const METALLIC_PRESET: BrickMaterialPreset = {
  roughness: 0.35,
  metallic: 0.85,
  usePlasticMaps: 0,
  castShadow: true,
};

const PEARL_PRESET: BrickMaterialPreset = {
  roughness: 0.25,
  metallic: 0.5,
  clearcoatFactor: 0.6,
  clearcoatRoughnessFactor: 0.2,
  castShadow: true,
};

const GLOW_PRESET: BrickMaterialPreset = {
  roughness: 0.4,
  metallic: 0.02,
  castShadow: true,
};

const GLITTER_PRESET: BrickMaterialPreset = {
  ...TRANSPARENT_PRESET,
  roughness: 0.18,
};

const SATIN_PRESET: BrickMaterialPreset = {
  ...TRANSPARENT_PRESET,
  roughness: 0.35,
  transmissionFactor: 0.75,
};

const SPECKLE_PRESET: BrickMaterialPreset = {
  roughness: 0.55,
  metallic: 0.08,
  castShadow: true,
};

const BY_KIND: Record<BrickMaterialKind, BrickMaterialPreset> = {
  plastic: PLASTIC_PRESET,
  rubber: RUBBER_PRESET,
  transparent: TRANSPARENT_PRESET,
  chrome: CHROME_PRESET,
  metallic: METALLIC_PRESET,
  pearl: PEARL_PRESET,
  glow: GLOW_PRESET,
  glitter: GLITTER_PRESET,
  satin: SATIN_PRESET,
  speckle: SPECKLE_PRESET,
};

export function presetFor(
  kind: BrickMaterialKind,
  color?: BrickColorDef | null
): BrickMaterialPreset {
  const base = { ...BY_KIND[kind] };
  if (kind === 'transparent' || kind === 'glitter' || kind === 'satin') {
    if (color?.alpha != null) base.opacity = color.alpha;
  }
  return base;
}

export function presetForColorId(colorId: string): BrickMaterialPreset {
  return presetFor(materialOf(colorId), getColor(colorId));
}

/** True when batches should use BLEND and skip shadow casting. */
export function materialKindNeedsBlend(kind: BrickMaterialKind): boolean {
  return kind === 'transparent' || kind === 'glitter' || kind === 'satin';
}

/**
 * Apply preset onto a properties bag (MaterialSpec.properties or Material.properties Map values).
 */
export function applyPresetToProps(
  props: Record<string, unknown>,
  preset: BrickMaterialPreset,
  tintRgb: readonly [number, number, number]
): void {
  props.roughness = preset.roughness;
  props.metallic = preset.metallic;
  const a = preset.opacity ?? 1;
  props.baseColor = [tintRgb[0], tintRgb[1], tintRgb[2], a];
  if (preset.usePlasticMaps != null) props.usePlasticMaps = preset.usePlasticMaps;
  if (preset.greaseGloss != null) props.greaseGloss = preset.greaseGloss;
  if (preset.fingerprintAmount != null) props.fingerprintAmount = preset.fingerprintAmount;
  if (preset.grainAmount != null) props.grainAmount = preset.grainAmount;
  if (preset.specularFactor != null) props.specularFactor = preset.specularFactor;
  if (preset.specularColorFactor) props.specularColorFactor = [...preset.specularColorFactor];
  if (preset.transmissionFactor != null) props.transmissionFactor = preset.transmissionFactor;
  if (preset.ior != null) props.ior = preset.ior;
  if (preset.opacity != null) props.opacity = preset.opacity;
  if (preset.alphaMode) props.alphaMode = preset.alphaMode;
  if (preset.doubleSided != null) props.doubleSided = preset.doubleSided;
  if (preset.clearcoatFactor != null) props.clearcoatFactor = preset.clearcoatFactor;
  if (preset.clearcoatRoughnessFactor != null) {
    props.clearcoatRoughnessFactor = preset.clearcoatRoughnessFactor;
  }
  if (preset.edgeWear != null) props.edgeWear = preset.edgeWear;
  if (preset.aoStrength != null) props.aoStrength = preset.aoStrength;
  if (preset.useAgingMap != null) props.useAgingMap = preset.useAgingMap;
}
