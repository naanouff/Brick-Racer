/**
 * @file blockoutKit.ts
 * @description Shared sun, blockout materials (debug grid / solid), unit primitives.
 */

import {
  BO_DEBUG_GRID_TEXTURE_ID,
  BO_DEBUG_TEX_SCALE_ENV,
  BO_DEBUG_TEX_SCALE_KART,
  resolveDebugTexEnabled,
} from '../../host/blockoutDebugTexture';
import type { GraphRef, LevelEntity, MaterialSpec, PrimitiveSpec } from './levelTypes';

export const BLOCKOUT_SHADER_GRAPHS: GraphRef[] = [
  { id: 'pbr', url: '/shader-graphs/PBRGraph.json' },
  { id: 'bo_grid', url: '/shader-graphs/BlockoutGridPBR.json' },
  { id: 'bo_grid_obj', url: '/shader-graphs/BlockoutGridObjectPBR.json' },
];

export const BLOCKOUT_PRIMITIVES: Record<string, PrimitiveSpec> = {
  bo_cube: { type: 'cube', params: { size: 1 } },
  bo_cyl: {
    type: 'cylinder',
    params: { radiusTop: 0.5, radiusBottom: 0.5, height: 1, radialSegments: 16, heightSegments: 1 },
  },
  bo_sphere: { type: 'sphere', params: { radius: 0.5, latitudeBands: 16, longitudeBands: 16 } },
  bo_capsule: {
    type: 'capsule',
    params: { radius: 0.25, height: 1.15, radialSegments: 12, ringsCylinder: 1, ringsCap: 4 },
  },
};

type TintSpec = {
  baseColor: number[];
  roughness: number;
  metallic: number;
  opacity?: number;
  alphaMode?: string;
  doubleSided?: boolean;
  tag?: string;
};

function solidMat(name: string, tint: TintSpec): MaterialSpec {
  const properties: Record<string, unknown> = {
    baseColor: tint.baseColor,
    roughness: tint.roughness,
    metallic: tint.metallic,
  };
  if (tint.opacity != null) properties.opacity = tint.opacity;
  if (tint.alphaMode) properties.alphaMode = tint.alphaMode;
  if (tint.doubleSided) properties.doubleSided = tint.doubleSided;
  if (tint.tag) properties.tag = tint.tag;
  return { shaderGraphId: 'pbr', name, properties };
}

function gridMat(name: string, tint: TintSpec, objectSpace = false): MaterialSpec {
  return {
    shaderGraphId: objectSpace ? 'bo_grid_obj' : 'bo_grid',
    name,
    properties: {
      baseColor: tint.baseColor.slice(0, 3),
      baseColorTexture: BO_DEBUG_GRID_TEXTURE_ID,
      texScale: objectSpace ? BO_DEBUG_TEX_SCALE_KART : BO_DEBUG_TEX_SCALE_ENV,
      blendSharpness: 8,
      roughness: tint.roughness,
      metallic: tint.metallic,
      opacity: tint.opacity ?? 1,
    },
  };
}

const OPAQUE_TINTS: Record<string, TintSpec> = {
  BO_Asphalt: { baseColor: [0.22, 0.24, 0.28], roughness: 0.92, metallic: 0 },
  BO_Wall: { baseColor: [0.85, 0.55, 0.12], roughness: 0.55, metallic: 0.05 },
  BO_Accent: { baseColor: [0.15, 0.55, 0.85], roughness: 0.4, metallic: 0.05 },
  BO_Boost: { baseColor: [0.95, 0.75, 0.1], roughness: 0.35, metallic: 0.1 },
  BO_Item: { baseColor: [0.55, 0.2, 0.85], roughness: 0.35, metallic: 0.15 },
  BO_Building: { baseColor: [0.72, 0.68, 0.62], roughness: 0.7, metallic: 0 },
  BO_Pad: { baseColor: [0.92, 0.78, 0.12], roughness: 0.45, metallic: 0.05 },
  BO_Gate: { baseColor: [0.55, 0.35, 0.75], roughness: 0.5, metallic: 0.08 },
  BO_Npc: { baseColor: [0.35, 0.75, 0.45], roughness: 0.55, metallic: 0 },
};

const KART_TINTS: Record<string, TintSpec> = {
  BK_Body: { baseColor: [0.85, 0.2, 0.18], roughness: 0.45, metallic: 0.08 },
  BK_Wheel: { baseColor: [0.12, 0.12, 0.14], roughness: 0.85, metallic: 0 },
  BK_Driver: { baseColor: [0.2, 0.55, 0.85], roughness: 0.5, metallic: 0.05 },
  BK_Wing: { baseColor: [0.95, 0.85, 0.15], roughness: 0.4, metallic: 0.1 },
  BM_Body: { baseColor: [0.15, 0.55, 0.35], roughness: 0.4, metallic: 0.1 },
  BM_Accent: { baseColor: [0.9, 0.75, 0.15], roughness: 0.35, metallic: 0.15 },
  BM_Seat: { baseColor: [0.12, 0.12, 0.14], roughness: 0.7, metallic: 0 },
  BP_Body: { baseColor: [0.2, 0.45, 0.85], roughness: 0.4, metallic: 0.12 },
  BP_Accent: { baseColor: [0.95, 0.55, 0.15], roughness: 0.35, metallic: 0.1 },
  BP_Wing: { baseColor: [0.85, 0.88, 0.92], roughness: 0.45, metallic: 0.08 },
};

/** Markers stay opaque — BLEND forced a transparent pass + fill cost for little gain. */
const MARKER_TINTS: Record<string, TintSpec> = {
  BO_Cp: { baseColor: [0.15, 0.85, 0.35], roughness: 0.45, metallic: 0.05 },
  BO_Trigger: { baseColor: [0.95, 0.85, 0.15], roughness: 0.4, metallic: 0.05 },
};

export function blockoutMaterials(opts?: { debugTex?: boolean }): Record<string, MaterialSpec> {
  const debug =
    opts?.debugTex ??
    resolveDebugTexEnabled(typeof window !== 'undefined' ? window.location.search : '');
  const out: Record<string, MaterialSpec> = {};
  for (const [id, tint] of Object.entries(OPAQUE_TINTS)) {
    out[id] = debug ? gridMat(id, tint, false) : solidMat(id, tint);
  }
  for (const [id, tint] of Object.entries(MARKER_TINTS)) {
    out[id] = debug ? gridMat(id, tint, false) : solidMat(id, tint);
  }
  for (const [id, tint] of Object.entries(KART_TINTS)) {
    out[id] = debug ? gridMat(id, tint, true) : solidMat(id, tint);
  }
  return out;
}

export function makeSunEntity(id = 'BO_Sun'): LevelEntity {
  return {
    id,
    name: id,
    parentId: null,
    transform: {
      position: [-28, 22, 14],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1],
    },
    components: [
      {
        type: 'directionalLight',
        color: [1, 0.97, 0.92],
        intensity: 3.2,
        castShadow: false,
        direction: [0.35, -0.85, 0.4],
      },
    ],
  };
}
