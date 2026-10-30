/**
 * @file spawnCatalogPreview.ts
 * @description W3DTS bo_cube preview for master catalog parts (CL1c) — no BC1 required.
 */

import { mat4, quat, vec3 } from 'gl-matrix';
import {
  HierarchyComponent,
  InstancedMeshComponent,
  Mesh,
  NameComponent,
  TransformComponent,
  type Engine,
  type Entity,
  type IEngineContext,
} from '@naanouff/w3dts-core';
import { P, S } from '../brickUnits';
import { BRICK_MESH_ID, brickMaterialId, type BrickColorId } from '../brickCatalog';
import { BRICK_INSTANCE_STRIDE_F } from '../brickInstanceData';
import { buildCatalogFbx, buildCatalogGlb, buildCatalogObj } from './catalogGlb';
import {
  neutralAgingPixels,
  uploadCatalogAgingTexture,
} from './catalogAgingTexture';
import {
  CATALOG_UV_GRID_MATERIAL_ID,
  CATALOG_UV_GRID_UV1_MATERIAL_ID,
  catalogPlasticMaterialId,
  type CatalogPlasticSet,
} from './catalogPlasticMaterials';
import { ensureLdrawUploadedMesh, getCachedLdrawMesh } from './ldrawMeshCache';
import type { BrickFootprint } from './types';

const PREVIEW_NAME = 'catalog.preview.box';
const DEFAULT_PLASTIC: CatalogPlasticSet = '003';

let previewEntities: Entity[] = [];

export type CatalogPreviewOpts = {
  footprint: BrickFootprint;
  colorId?: BrickColorId;
  /** AmbientCG plastic set, or `off` for tint-only ABS. Default `003`. */
  plasticSet?: CatalogPlasticSet;
  /** Debug: UV checkerboard on channel 0 (plastic) or 1 (aging atlas). */
  uvGrid?: 0 | 1 | false;
  /** AO / cavity / edge wear from the UV1 aging texture. Default on. */
  aging?: boolean;
};

function footprintSizeMeters(fp: BrickFootprint): [number, number, number] {
  return [fp[0] * S, fp[1] * P, fp[2] * S];
}

function packSizedInstance(
  position: [number, number, number],
  size: [number, number, number]
): Float32Array {
  const data = new Float32Array(BRICK_INSTANCE_STRIDE_F);
  const m = mat4.create();
  const inv = mat4.create();
  const q = quat.create();
  quat.identity(q);
  mat4.fromRotationTranslationScale(
    m,
    q,
    vec3.fromValues(position[0], position[1], position[2]),
    vec3.fromValues(size[0], size[1], size[2])
  );
  mat4.invert(inv, m);
  mat4.transpose(inv, inv);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      data[r * 4 + c] = m[r * 4 + c]!;
      data[16 + r * 4 + c] = inv[r * 4 + c]!;
    }
  }
  data[32] = 1;
  data[33] = 1;
  data[34] = 1;
  data[35] = 1;
  return data;
}

function attachToSceneRoot(engine: Engine, entity: Entity): void {
  const world = engine.ecsWorld;
  const sceneRootId = engine.scene.entityId;
  const sceneH = world.getComponent(sceneRootId, HierarchyComponent);
  const h = new HierarchyComponent(sceneRootId);
  world.addComponent(entity, h);
  if (sceneH && !sceneH.children.includes(entity)) {
    sceneH.children.push(entity);
  }
}

export function clearCatalogPreview(engine: IEngineContext): void {
  const world = (engine as Engine).ecsWorld;
  for (const entity of previewEntities) {
    try {
      world.destroyEntity(entity);
    } catch {
      /* already gone */
    }
  }
  previewEntities = [];
}

/**
 * Spawn / replace a single box proxy at origin (resting on y=0).
 * Returns created entity ids.
 */
export function spawnCatalogPreview(
  engine: IEngineContext,
  opts: CatalogPreviewOpts
): Entity[] {
  const full = engine as Engine;
  uploadCatalogAgingTexture(full, neutralAgingPixels());
  const mesh = full.resourceManager.getMeshByName(BRICK_MESH_ID);
  if (!mesh) {
    clearCatalogPreview(full);
    console.warn(`[CatalogPreview] missing mesh ${BRICK_MESH_ID}`);
    return [];
  }
  const size = footprintSizeMeters(opts.footprint);
  return spawnPreviewInstance(
    full,
    mesh,
    opts.colorId,
    opts.plasticSet,
    opts.uvGrid,
    opts.aging,
    packSizedInstance([0, size[1] * 0.5, 0], size),
    Math.max(size[0], size[1], size[2]) * 0.75 + 0.5
  );
}

export type CatalogMeshPreviewOpts = {
  /** Cache key (LDraw id). */
  key: string;
  /** Pre-baked mesh from IPC `ldrawPartMesh` (CL5). */
  baked?: {
    vertices: Float32Array;
    indices: Uint32Array;
    triangleCount: number;
    size: [number, number, number];
    aging: Uint8Array;
    coverage: Uint8Array;
  };
  /** Fallback: LDraw triangles in LDU (9 floats per triangle). */
  triangles?: Float32Array;
  /** LDraw type-2 edges in LDU (6 floats per segment), kept as hard edges when smoothing. */
  edges?: Float32Array;
  colorId?: BrickColorId;
  plasticSet?: CatalogPlasticSet;
  uvGrid?: 0 | 1 | false;
  /** AO / cavity / edge wear from the UV1 aging texture. Default on. */
  aging?: boolean;
};

export type CatalogMeshPreviewResult = {
  triangleCount: number;
  /** AO channel (B) of the UV1 bake, row 0 = v 0. Null when the mesh did not spawn. */
  ao: Uint8Array | null;
  coverage: Uint8Array | null;
};

function aoView(rgba: Uint8Array, coverage: Uint8Array): { ao: Uint8Array; coverage: Uint8Array } {
  const ao = new Uint8Array(coverage.length);
  for (let i = 0; i < coverage.length; i++) ao[i] = rgba[i * 4 + 2]!;
  return { ao, coverage: coverage.slice() };
}

/**
 * Spawn / replace the preview with the real LDraw geometry (already grounded + centered).
 * Returns the triangle count (0 if nothing spawned) and the UV1 AO channel.
 */
export function spawnCatalogMeshPreview(
  engine: IEngineContext,
  opts: CatalogMeshPreviewOpts
): CatalogMeshPreviewResult {
  const empty: CatalogMeshPreviewResult = { triangleCount: 0, ao: null, coverage: null };
  const full = engine as Engine;
  const entry = ensureLdrawUploadedMesh(full, {
    key: opts.key,
    baked: opts.baked,
    triangles: opts.triangles,
    edges: opts.edges,
  });
  if (!entry) return empty;
  uploadCatalogAgingTexture(full, entry.aging);
  const [sx, sy, sz] = entry.size;
  const spawned = spawnPreviewInstance(
    full,
    entry.mesh,
    opts.colorId,
    opts.plasticSet,
    opts.uvGrid,
    opts.aging,
    packSizedInstance([0, 0, 0], [1, 1, 1]),
    Math.hypot(sx, sy, sz) * 0.5 + 0.5
  );
  if (spawned.length === 0) return empty;
  const view = aoView(entry.aging, entry.coverage);
  return { triangleCount: entry.triangleCount, ao: view.ao, coverage: view.coverage };
}

function cachedMesh(ldrawId: string) {
  const entry = getCachedLdrawMesh(ldrawId);
  if (!entry) return null;
  return {
    name: ldrawId,
    vertices: entry.vertices,
    indices: entry.indices,
    triangleCount: entry.triangleCount,
    aging: entry.aging,
  };
}

/** GLB of the last previewed mesh for `ldrawId` (UV0, UV1, AO on UV1). */
export function catalogMeshGlb(ldrawId: string): Uint8Array | null {
  const mesh = cachedMesh(ldrawId);
  return mesh ? buildCatalogGlb(mesh) : null;
}

/** OBJ of the last previewed mesh. The single UV set is UV1. */
export function catalogMeshObj(ldrawId: string): Uint8Array | null {
  const mesh = cachedMesh(ldrawId);
  return mesh ? buildCatalogObj(mesh) : null;
}

/** FBX of the last previewed mesh. UV0 and UV1 are both written. */
export function catalogMeshFbx(ldrawId: string): Uint8Array | null {
  const mesh = cachedMesh(ldrawId);
  return mesh ? buildCatalogFbx(mesh) : null;
}

function resolvePreviewMaterial(
  full: Engine,
  colorId: BrickColorId | undefined,
  plasticSet: CatalogPlasticSet | undefined,
  uvGrid: 0 | 1 | false | undefined,
  aging: boolean | undefined
) {
  if (uvGrid === 0 || uvGrid === 1) {
    const id = uvGrid === 1 ? CATALOG_UV_GRID_UV1_MATERIAL_ID : CATALOG_UV_GRID_MATERIAL_ID;
    const grid = full.resourceManager.getMaterialByName(id);
    if (grid) return grid;
  }
  const color = colorId ?? 'gray';
  const set = plasticSet ?? DEFAULT_PLASTIC;
  const plasticId = catalogPlasticMaterialId(set, color, aging !== false);
  const plastic = full.resourceManager.getMaterialByName(plasticId);
  if (plastic) return plastic;
  const fallbackId = brickMaterialId(color);
  return full.resourceManager.getMaterialByName(fallbackId) ?? null;
}

function spawnPreviewInstance(
  full: Engine,
  mesh: Mesh,
  colorId: BrickColorId | undefined,
  plasticSet: CatalogPlasticSet | undefined,
  uvGrid: 0 | 1 | false | undefined,
  aging: boolean | undefined,
  instData: Float32Array,
  radius: number
): Entity[] {
  clearCatalogPreview(full);

  const device = full.webGPUContext?.device;
  if (!device) return [];

  const mat = resolvePreviewMaterial(full, colorId, plasticSet, uvGrid, aging);
  if (!mat) {
    console.warn(
      `[CatalogPreview] missing material ${
        uvGrid === 0 || uvGrid === 1
          ? uvGrid === 1
            ? CATALOG_UV_GRID_UV1_MATERIAL_ID
            : CATALOG_UV_GRID_MATERIAL_ID
          : catalogPlasticMaterialId(plasticSet ?? DEFAULT_PLASTIC, colorId ?? 'gray', aging !== false)
      }`
    );
    return [];
  }

  const instanceBuffer = device.createBuffer({
    label: 'CatalogPreviewInst',
    size: instData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Float32Array(instanceBuffer.getMappedRange()).set(instData);
  instanceBuffer.unmap();

  const world = full.ecsWorld;
  const entity = world.createEntity();
  world.addComponent(entity, new NameComponent(PREVIEW_NAME));
  const tf = new TransformComponent();
  vec3.set(tf.position, 0, 0, 0);
  tf.updateLocalTransform();
  mat4.copy(tf.worldTransform, tf.localTransform);
  world.addComponent(entity, tf);
  attachToSceneRoot(full, entity);

  const im = new InstancedMeshComponent(
    mesh,
    mat,
    instanceBuffer,
    1,
    Infinity,
    0,
    undefined,
    undefined,
    false
  );
  im.instancedBoundingRadius = radius;
  im.instanceMatricesCpu = instData;
  world.addComponent(entity, im);
  previewEntities = [entity];
  return previewEntities;
}
