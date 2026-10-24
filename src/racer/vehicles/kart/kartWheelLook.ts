/**
 * @file kartWheelLook.ts
 * @project w3dts
 * @description Bulged rubber tire mesh + MeshMaps bake (AO / curvature) for LegoKart.
 */

import {
  Mesh,
  Material as MaterialClass,
  type Engine,
  type Material,
  type ResourceManager,
  type ShaderGraph,
} from '@naanouff/w3dts-core';
import {
  bakeMeshMapsOnGeometrySet,
  buildMeshGeometry,
  engineMeshToPreviewBuffers,
  geometrySetToEngineMesh,
  type GeometrySet,
} from '@naanouff/w3dts-gproc';

export const KART_RUBBER_SHADER_ID = 'RockProceduralPBR';
export const KART_RUBBER_MATERIAL_NAME = 'KartRubberTirePBR';

/** RockProceduralPBR overrides — matte rubber, not ABS plastic. */
export const KART_RUBBER_PROPERTY_OVERRIDES: Record<string, unknown> = {
  rockColor: [0.07, 0.07, 0.08],
  mossColor: [0.04, 0.04, 0.045],
  wearColor: [0.28, 0.26, 0.24],
  mossAmount: 0.42,
  edgeWear: 0.62,
  aoStrength: 0.72,
  heightInfluence: 0.28,
  roughness: 0.96,
  metallic: 0,
  triplanarScale: 22,
  normalDetailScale: 0.09,
  macroAlbedo: 0.12,
  greaseGloss: 0,
  seed: 11,
};

/** SceneDD / PBR tire — kill IBL chrome on black rubber. */
export const KART_RUBBER_PBR_OVERRIDES = {
  roughness: 0.96,
  metallic: 0,
  specularFactor: 0.04,
  specularColorFactor: [0.1, 0.1, 0.1] as [number, number, number],
};

export function applyKartRubberToMaterials(
  engine: Engine,
  materialNames: readonly string[] = [KART_RUBBER_MATERIAL_NAME, 'LK_WheelTire']
): void {
  for (const name of materialNames) {
    const mat = engine.resourceManager.getMaterialByName(name);
    if (!mat) continue;
    mat.metallic = KART_RUBBER_PBR_OVERRIDES.metallic;
    mat.roughness = KART_RUBBER_PBR_OVERRIDES.roughness;
    mat.properties.set('metallic', KART_RUBBER_PBR_OVERRIDES.metallic);
    mat.properties.set('roughness', KART_RUBBER_PBR_OVERRIDES.roughness);
    mat.properties.set('specularFactor', KART_RUBBER_PBR_OVERRIDES.specularFactor);
    mat.properties.set('specularColorFactor', [...KART_RUBBER_PBR_OVERRIDES.specularColorFactor]);
    mat.properties.set('greaseGloss', 0);
    engine.resourceManager.uploadMaterial(mat);
  }
}

export type BulgedTireOptions = {
  radius: number;
  width: number;
  /** Extra radius at the tread equator (0 = cylinder). */
  bulge?: number;
  radialSegments?: number;
  heightSegments?: number;
  aoRadius?: number;
};

/**
 * Lathed tire: Y-up cylinder with convex (bombé) tread radius peaking at mid-width.
 * Caps included so MeshMaps AO darkens the rim wells.
 */
export function createBulgedTireGeometry(options: BulgedTireOptions): GeometrySet {
  const radius = options.radius;
  const width = options.width;
  const bulge = options.bulge ?? 0.14;
  const radialSegments = options.radialSegments ?? 28;
  const heightSegments = Math.max(4, options.heightSegments ?? 10);
  const half = width * 0.5;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const faceCounts: number[] = [];

  const ringCount = heightSegments + 1;
  const vertsPerRing = radialSegments + 1;

  for (let iy = 0; iy < ringCount; iy++) {
    const v = iy / heightSegments;
    const y = (1 - v) * width - half;
    const t = y / half;
    const radiusHere = radius * (1 + bulge * Math.cos(t * Math.PI * 0.5));
    const drdy = radius * bulge * ((-0.5 * Math.PI) / half) * Math.sin(t * Math.PI * 0.5);

    for (let ix = 0; ix < vertsPerRing; ix++) {
      const u = ix / radialSegments;
      const theta = u * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      const px = cos * radiusHere;
      const pz = sin * radiusHere;
      positions.push(px, y, pz);

      // Outward normal following the revolved profile.
      let nx = cos;
      let ny = -drdy;
      let nz = sin;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      normals.push(nx, ny, nz);
      uvs.push(u, v);
    }
  }

  for (let iy = 0; iy < heightSegments; iy++) {
    for (let ix = 0; ix < radialSegments; ix++) {
      const a = iy * vertsPerRing + ix;
      const b = a + vertsPerRing;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
      faceCounts.push(3, 3);
    }
  }

  const topRing = 0;
  const botRing = heightSegments;
  const topCenter = positions.length / 3;
  positions.push(0, half, 0);
  normals.push(0, 1, 0);
  uvs.push(0.5, 0.5);
  const botCenter = positions.length / 3;
  positions.push(0, -half, 0);
  normals.push(0, -1, 0);
  uvs.push(0.5, 0.5);

  for (let ix = 0; ix < radialSegments; ix++) {
    const a = topRing * vertsPerRing + ix;
    const c = a + 1;
    indices.push(topCenter, a, c);
    faceCounts.push(3);
    const ba = botRing * vertsPerRing + ix;
    const bc = ba + 1;
    indices.push(botCenter, bc, ba);
    faceCounts.push(3);
  }

  return buildMeshGeometry({ positions, normals, uvs, indices, faceCounts });
}

export function bakeKartTireMeshMaps(geometry: GeometrySet, aoRadius = 0.035): GeometrySet {
  return bakeMeshMapsOnGeometrySet(geometry, {
    curvatureContrast: 3.2,
    aoRadius,
    aoSamples: 12,
    heightScale: 1.2,
    bakeCurvature: true,
    bakeAO: true,
    bakeHeight: true,
  });
}

/** Build uploaded engine Mesh with MeshMaps in vertex COLOR. */
export function createKartTireMesh(options: BulgedTireOptions): Mesh {
  const geom = bakeKartTireMeshMaps(
    createBulgedTireGeometry(options),
    options.aoRadius ?? Math.max(0.02, options.radius * 0.4)
  );
  const engineMesh = geometrySetToEngineMesh(geom, 1);
  const buffers = engineMesh ? engineMeshToPreviewBuffers(engineMesh) : null;
  if (!buffers) {
    throw new Error('Kart tire mesh bake produced empty buffers');
  }
  return new Mesh(buffers.vertices, buffers.indices, 'KartRubberTire');
}

function propertyDefaults(graph: ShaderGraph): Record<string, unknown> {
  const out: Record<string, unknown> = { ...KART_RUBBER_PROPERTY_OVERRIDES };
  if (!graph.properties) return out;
  for (const [key, entry] of Object.entries(graph.properties)) {
    if (out[key] !== undefined) continue;
    if (entry && typeof entry === 'object' && 'defaultValue' in entry) {
      out[key] = entry.defaultValue;
    }
  }
  return out;
}

export async function loadKartRubberShaderGraph(baseUrl = '/shader-graphs'): Promise<ShaderGraph> {
  const res = await fetch(`${baseUrl}/RockProceduralPBR.json`);
  if (!res.ok) {
    throw new Error('Failed to load RockProceduralPBR for kart rubber tire');
  }
  return (await res.json()) as ShaderGraph;
}

export function createKartRubberMaterial(
  resourceManager: ResourceManager,
  graph: ShaderGraph
): Material {
  const sampler =
    resourceManager['device']?.createSampler?.({ magFilter: 'linear', minFilter: 'linear' }) ??
    undefined;
  const material = new MaterialClass({
    name: KART_RUBBER_MATERIAL_NAME,
    shadingModel: 'graph',
    shaderGraph: graph,
    properties: propertyDefaults(graph),
    sampler,
  });
  resourceManager.uploadMaterial(material);
  return material;
}
