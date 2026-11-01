/**
 * @file spawnLandmarkLdraw.ts
 * @description Spawn a brick landmark from BrickPose[] using real LDraw meshes + catalog plastic.
 * Missing meshes fall back to box proxies per part (ED3) — no global null.
 */

import { mat4, vec3 } from 'gl-matrix';
import {
  HierarchyComponent,
  InstancedMeshComponent,
  NameComponent,
  TransformComponent,
  type Engine,
  type Entity,
  type IEngineContext,
} from '@naanouff/w3dts-core';
import {
  BRICK_MESH_ID,
  brickMaterialId,
  groupBrickPoses,
  parseBrickBatchKey,
  resolvePartId,
  type BrickColorId,
  type BrickPose,
} from './brickCatalog';
import { packBrickInstanceData } from './brickInstanceData';
import { registerAgingTexture } from './catalog/catalogAgingTexture';
import { ensureLdrawUploadedMesh, fetchLdrawPart, hasLdrawIpc } from './catalog/ldrawMeshCache';
import { packLdrawInstanceData } from './brickLdrawInstanceData';
import {
  brickMaterialCastShadow,
  ensureBrickMaterial,
  landmarkAgingTextureId,
} from './landmarkPlasticMaterial';
import { materialOf } from './brickCatalog';
import { materialKindNeedsBlend } from './materials/brickMaterialPresets';
import type { BrickLandmarkSpec } from './spawnBrickLandmark';

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

/** Unique canonical LDraw design ids for the landmark poses. */
export function landmarkLdrawIds(spec: BrickLandmarkSpec): string[] {
  const ids = new Set<string>();
  for (const pose of spec.poses) {
    const id = resolvePartId(pose.partId) ?? pose.partId;
    ids.add(id);
  }
  return [...ids].sort();
}

function spawnBoxBatches(
  full: Engine,
  spec: BrickLandmarkSpec,
  posesByKey: Map<string, BrickPose[]>
): Entity[] {
  const device = full.webGPUContext?.device;
  if (!device) return [];
  const { resourceManager, ecsWorld: world } = full;
  const resolvedMesh = resourceManager.getMeshByName(BRICK_MESH_ID);
  if (!resolvedMesh) return [];

  const created: Entity[] = [];
  const castShadow = spec.castShadow ?? false;

  for (const [key, poses] of posesByKey) {
    const { colorId } = parseBrickBatchKey(key);
    const matId = brickMaterialId(colorId);
    const resolvedMat = resourceManager.getMaterialByName(matId);
    if (!resolvedMat) continue;

    const instData = packBrickInstanceData(poses);
    const instanceBuffer = device.createBuffer({
      label: `BrickInst_${spec.id}_${key}`,
      size: instData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(instanceBuffer.getMappedRange()).set(instData);
    instanceBuffer.unmap();

    const entity = world.createEntity();
    world.addComponent(entity, new NameComponent(`${spec.id}.brick.${key}`));
    const tf = new TransformComponent();
    vec3.set(tf.position, spec.anchor[0], spec.anchor[1], spec.anchor[2]);
    tf.updateLocalTransform();
    mat4.copy(tf.worldTransform, tf.localTransform);
    world.addComponent(entity, tf);
    attachToSceneRoot(full, entity);

    const im = new InstancedMeshComponent(
      resolvedMesh,
      resolvedMat,
      instanceBuffer,
      poses.length,
      Infinity,
      0,
      undefined,
      undefined,
      castShadow
    );
    im.instancedBoundingRadius = spec.boundingRadius;
    im.instanceMatricesCpu = instData;
    world.addComponent(entity, im);
    created.push(entity);
  }
  return created;
}

/**
 * Upload LDraw meshes for every unique part, then spawn InstancedMesh batches
 * with catalog 017B plastic + per-part UV1 aging.
 * Parts that fail to load are spawned as box proxies; returns [] only when nothing spawned.
 */
export async function spawnLandmarkLdraw(
  engine: IEngineContext,
  spec: BrickLandmarkSpec
): Promise<Entity[] | null> {
  const full = engine as Engine;
  const device = full.webGPUContext?.device;
  if (!device || spec.poses.length === 0) return null;

  if (!hasLdrawIpc()) return null;

  const partIds = landmarkLdrawIds(spec);
  const meshes = new Map<string, NonNullable<ReturnType<typeof ensureLdrawUploadedMesh>>>();
  const agingReady = new Set<string>();
  const failedIds = new Set<string>();

  const loaded = await Promise.all(
    partIds.map(async (id) => {
      try {
        return { id, result: await fetchLdrawPart(id, 'ground-center') };
      } catch (err) {
        console.warn(`[LandmarkLDraw] ${spec.id} ${id}:`, err);
        return { id, result: null };
      }
    })
  );

  for (const { id, result } of loaded) {
    if (!result || !result.ok) {
      if (result && !result.ok) console.warn(`[LandmarkLDraw] ${spec.id} ${id}: ${result.error}`);
      failedIds.add(id);
      continue;
    }
    const entry = ensureLdrawUploadedMesh(full, {
      key: id,
      ...result.source,
      meshNamePrefix: 'landmark.ldraw',
      anchor: 'ground-center',
    });
    if (!entry) {
      console.warn(`[LandmarkLDraw] ${spec.id} ${id}: empty mesh`);
      failedIds.add(id);
      continue;
    }
    meshes.set(id, entry);
    if (registerAgingTexture(full, landmarkAgingTextureId(id), entry.aging)) {
      agingReady.add(id);
    }
  }

  const { ecsWorld: world } = full;
  const batches = groupBrickPoses(spec.poses);
  const created: Entity[] = [];
  const castShadowDefault = spec.castShadow ?? false;
  const boxBatches = new Map<string, BrickPose[]>();
  /** Opaque first, then BLEND (transparent / glitter / satin). */
  const orderedKeys = [...batches.keys()].sort((a, b) => {
    const ka = materialKindNeedsBlend(materialOf(parseBrickBatchKey(a).colorId)) ? 1 : 0;
    const kb = materialKindNeedsBlend(materialOf(parseBrickBatchKey(b).colorId)) ? 1 : 0;
    return ka - kb;
  });

  for (const key of orderedKeys) {
    const poses = batches.get(key)!;
    const { partId, colorId } = parseBrickBatchKey(key);
    const ldrawId = resolvePartId(partId) ?? partId;
    const meshEntry = meshes.get(ldrawId);
    if (!meshEntry) {
      boxBatches.set(key, poses);
      continue;
    }

    const resolvedMat = ensureBrickMaterial(
      full,
      ldrawId,
      colorId as BrickColorId,
      agingReady.has(ldrawId)
    );
    if (!resolvedMat) {
      console.warn(`[LandmarkLDraw] material missing for ${key} — box fallback`);
      boxBatches.set(key, poses);
      continue;
    }

    const castShadow = brickMaterialCastShadow(colorId as BrickColorId, castShadowDefault);

    const instData = packLdrawInstanceData(poses);
    const instanceBuffer = device.createBuffer({
      label: `LdrawInst_${spec.id}_${key}`,
      size: instData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(instanceBuffer.getMappedRange()).set(instData);
    instanceBuffer.unmap();

    const entity = world.createEntity();
    world.addComponent(entity, new NameComponent(`${spec.id}.ldraw.${key}`));
    const tf = new TransformComponent();
    vec3.set(tf.position, spec.anchor[0], spec.anchor[1], spec.anchor[2]);
    tf.updateLocalTransform();
    mat4.copy(tf.worldTransform, tf.localTransform);
    world.addComponent(entity, tf);
    attachToSceneRoot(full, entity);

    const im = new InstancedMeshComponent(
      meshEntry.mesh,
      resolvedMat,
      instanceBuffer,
      poses.length,
      Infinity,
      0,
      undefined,
      undefined,
      castShadow
    );
    im.instancedBoundingRadius = spec.boundingRadius;
    im.instanceMatricesCpu = instData;
    world.addComponent(entity, im);
    created.push(entity);
  }

  if (boxBatches.size > 0) {
    created.push(...spawnBoxBatches(full, spec, boxBatches));
  }

  if (created.length === 0) {
    console.warn(`[LandmarkLDraw] ${spec.id}: no batches spawned`);
    return null;
  }

  console.info(
    `[LandmarkLDraw] ${spec.id}: ${spec.poses.length} parts / ${created.length} batches / ` +
      `ldraw=${meshes.size}/${partIds.length} box=${failedIds.size} (${[...failedIds].join(',') || '—'})`
  );
  return created;
}
