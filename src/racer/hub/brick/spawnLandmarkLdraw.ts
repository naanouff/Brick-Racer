/**
 * @file spawnLandmarkLdraw.ts
 * @description Spawn a brick landmark from BrickPose[] using real LDraw meshes + catalog plastic.
 * Falls back to null when IPC is absent or any part fails to load (caller keeps boxes).
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
  groupBrickPoses,
  parseBrickBatchKey,
  resolvePartId,
  type BrickColorId,
} from './brickCatalog';
import { registerAgingTexture } from './catalog/catalogAgingTexture';
import { ensureLdrawUploadedMesh, fetchLdrawPart, hasLdrawIpc } from './catalog/ldrawMeshCache';
import { packLdrawInstanceData } from './brickLdrawInstanceData';
import {
  ensureLandmarkPlasticMaterial,
  landmarkAgingTextureId,
} from './landmarkPlasticMaterial';
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

/**
 * Upload LDraw meshes for every unique part, then spawn InstancedMesh batches
 * with catalog 017B plastic + per-part UV1 aging.
 * Returns null when any mesh is missing so the caller can keep the box proxy.
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
      return null;
    }
    const entry = ensureLdrawUploadedMesh(full, {
      key: id,
      ...result.source,
      meshNamePrefix: 'landmark.ldraw',
      anchor: 'ground-center',
    });
    if (!entry) {
      console.warn(`[LandmarkLDraw] ${spec.id} ${id}: empty mesh`);
      return null;
    }
    meshes.set(id, entry);
    if (registerAgingTexture(full, landmarkAgingTextureId(id), entry.aging)) {
      agingReady.add(id);
    }
  }

  const { ecsWorld: world } = full;
  const batches = groupBrickPoses(spec.poses);
  const created: Entity[] = [];
  const castShadow = spec.castShadow ?? false;

  for (const [key, poses] of batches) {
    const { partId, colorId } = parseBrickBatchKey(key);
    const ldrawId = resolvePartId(partId) ?? partId;
    const meshEntry = meshes.get(ldrawId);
    if (!meshEntry) return null;

    const resolvedMat = ensureLandmarkPlasticMaterial(
      full,
      ldrawId,
      colorId as BrickColorId,
      agingReady.has(ldrawId)
    );
    if (!resolvedMat) {
      console.warn(`[LandmarkLDraw] material missing for ${key} — skip`);
      continue;
    }

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

  if (created.length === 0) {
    console.warn(`[LandmarkLDraw] ${spec.id}: no batches spawned`);
    return null;
  }

  console.info(
    `[LandmarkLDraw] ${spec.id}: ${spec.poses.length} parts / ${created.length} batches / aging=${agingReady.size}/${partIds.length} (${partIds.join(',')})`
  );
  return created;
}
