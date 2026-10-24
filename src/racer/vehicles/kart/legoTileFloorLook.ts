/**
 * @file legoTileFloorLook.ts
 * @project w3dts
 * @description Load LegoTileFloorProceduralPBR and apply to materials (Lego Kart floor, demos).
 */

import type { Engine, Material, ResourceManager, ShaderGraph } from '@naanouff/w3dts-core';
import { Material as MaterialClass } from '@naanouff/w3dts-core';
import { KART_TRACK } from '@naanouff/w3dts-physics';

export const LEGO_TILE_FLOOR_SHADER_ID = 'LegoTileFloorProceduralPBR';
export const LEGO_TILE_FLOOR_MATERIAL_NAME = 'LegoTileFloorPBRMaterial';

/**
 * World size of one LEGO stud under the kart (2-stud chassis scaled to {@link KART_TRACK}).
 * Shader cell UV: `pos.xz * tileScale` → one 1×1 plate = one stud when `tileScale = 1 / stud`.
 */
export const LEGO_KART_STUD_WORLD = KART_TRACK / 2;

/** Stronger IBL sky bounce on plate plastic (Lit procedural env). */
/** IBL gain — keep modest so grazing Fresnel does not whitewash the mosaic. */
export const LEGO_KART_IBL_GAIN = 1.65;

export const MOTOCROSS_PLATE_STUD_WORLD = 0.8;

/** Motocross track: 1×1 plate cell = 1 stud (0.8 wu). */
export const MOTOCROSS_TILE_FLOOR_OVERRIDES: Record<string, unknown> = {
  tileScale: 1 / MOTOCROSS_PLATE_STUD_WORLD,
  gapWidth: 0.045,
  studAmount: 0.08,
  normalDetailScale: 0.32,
  gapRoughness: 0.08,
  roughness: 0.3,
  roughnessVary: 0.14,
  colorA: [0.55, 0.72, 0.35],
  colorB: [0.42, 0.58, 0.28],
  colorC: [0.14, 0.14, 0.15],
  colorD: [0.72, 0.66, 0.55],
  accentA: [0.18, 0.55, 0.26],
  accentB: [0.78, 0.16, 0.14],
  accentC: [0.16, 0.42, 0.78],
  accentD: [0.92, 0.72, 0.12],
};

export const MOTOCROSS_TERRAIN_MATERIAL_NAME = 'MotocrossLegoPlateMaterial';

/** Kart track: 1×1 cell = 1 stud; multi-size plates stay proportional to the vehicle. */
export const LEGO_KART_TILE_FLOOR_OVERRIDES: Record<string, unknown> = {
  tileScale: 1 / LEGO_KART_STUD_WORLD,
  gapWidth: 0.045,
  studAmount: 0.05,
  normalDetailScale: 0.28,
  gapRoughness: 0.08,
  // Satin ABS: SSR carries kart/ramp mirrors; too-low roughness = white sky wash mid-field.
  roughness: 0.28,
  roughnessVary: 0.16,
  colorD: [0.72, 0.66, 0.55],
  accentC: [0.16, 0.42, 0.78],
  accentD: [0.92, 0.72, 0.12],
};

function propertyDefaults(graph: ShaderGraph): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!graph.properties) return out;
  for (const [key, entry] of Object.entries(graph.properties)) {
    if (entry && typeof entry === 'object' && 'defaultValue' in entry) {
      out[key] = entry.defaultValue;
    }
  }
  return out;
}

let graphCache: Promise<ShaderGraph> | null = null;

export async function loadLegoTileFloorShaderGraph(
  baseUrl = '/shader-graphs'
): Promise<ShaderGraph> {
  graphCache ??= (async () => {
    const res = await fetch(`${baseUrl}/${LEGO_TILE_FLOOR_SHADER_ID}.json`);
    if (!res.ok) {
      throw new Error(`Failed to load ${LEGO_TILE_FLOOR_SHADER_ID} shader graph`);
    }
    return (await res.json()) as ShaderGraph;
  })();
  return graphCache;
}

export function createLegoTileFloorMaterial(
  resourceManager: ResourceManager,
  graph: ShaderGraph,
  overrides: Record<string, unknown> = {},
  materialName = LEGO_TILE_FLOOR_MATERIAL_NAME
): Material {
  const sampler =
    resourceManager['device']?.createSampler?.({
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'linear',
      addressModeU: 'repeat',
      addressModeV: 'repeat',
      maxAnisotropy: 8,
    }) ?? undefined;
  const material = new MaterialClass({
    name: materialName,
    shadingModel: 'graph',
    shaderGraph: graph,
    properties: { ...propertyDefaults(graph), ...overrides },
    sampler,
  });
  resourceManager.uploadMaterial(material);
  return material;
}

/** Swap existing named materials onto LegoTileFloorProceduralPBR (SceneDD asphalt). */
export async function applyLegoTileFloorToMaterials(
  engine: Engine,
  materialNames: readonly string[],
  overrides: Record<string, unknown> = LEGO_KART_TILE_FLOOR_OVERRIDES
): Promise<void> {
  const graph = await loadLegoTileFloorShaderGraph();
  const defaults = { ...propertyDefaults(graph), ...overrides };
  const device = engine.webGPUContext.device;
  const sampler = device.createSampler({
    label: 'Sampler_LegoTileFloor',
    magFilter: 'linear',
    minFilter: 'linear',
    mipmapFilter: 'linear',
    maxAnisotropy: 8,
    addressModeU: 'repeat',
    addressModeV: 'repeat',
  });

  for (const name of materialNames) {
    const mat = engine.resourceManager.getMaterialByName(name);
    if (!mat) continue;
    mat.shadingModel = 'graph';
    mat.shaderGraph = graph;
    mat.diffuseTexture = undefined;
    mat.normalTexture = undefined;
    mat.properties.delete('baseColorTexture');
    mat.properties.delete('normalTexture');
    for (const [key, value] of Object.entries(defaults)) {
      mat.properties.set(key, value);
    }
    mat.sampler = sampler;
    mat.roughness = typeof defaults.roughness === 'number' ? defaults.roughness : mat.roughness;
    engine.resourceManager.uploadMaterial(mat);
  }
}
