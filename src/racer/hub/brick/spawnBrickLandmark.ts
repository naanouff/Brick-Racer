/**
 * @file spawnBrickLandmark.ts
 * @description Upload InstancedMesh batches for a brick landmark (BW1).
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
  type BrickPose,
} from './brickCatalog';
import { packBrickInstanceData } from './brickInstanceData';

export type BrickLandmarkSpec = {
  /** Stable landmark id (e.g. landmark.fountain). */
  id: string;
  poses: readonly BrickPose[];
  /** Batch transform / cull anchor (world). */
  anchor: [number, number, number];
  /** Frustum sphere radius (m). */
  boundingRadius: number;
  castShadow?: boolean;
};

/**
 * Attach orphan roots under the scene so the transform system writes worldTransform
 * (InstancedMesh frustum cull uses Transform.worldTransform as sphere center).
 */
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

/**
 * Creates one InstancedMesh entity per (part × color) batch.
 * Instance matrices are world-space (same as Medieval Village trees); the entity
 * Transform is the frustum-cull anchor only.
 * Returns created entity ids (for teardown with the level).
 */
export function spawnBrickLandmark(
  engine: IEngineContext,
  spec: BrickLandmarkSpec
): Entity[] {
  const full = engine as Engine;
  const device = full.webGPUContext?.device;
  if (!device || spec.poses.length === 0) return [];

  const { resourceManager, ecsWorld: world } = full;
  const resolvedMesh = resourceManager.getMeshByName(BRICK_MESH_ID);
  if (!resolvedMesh) {
    console.warn(`[BrickLandmark] mesh '${BRICK_MESH_ID}' missing — skip ${spec.id}`);
    return [];
  }

  const batches = groupBrickPoses(spec.poses);
  const created: Entity[] = [];
  const castShadow = spec.castShadow ?? false;

  for (const [key, poses] of batches) {
    const { colorId } = parseBrickBatchKey(key);
    const matId = brickMaterialId(colorId);
    const resolvedMat = resourceManager.getMaterialByName(matId);
    if (!resolvedMat) {
      console.warn(`[BrickLandmark] material '${matId}' missing — skip batch ${key}`);
      continue;
    }

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
    // First frame before hierarchy propagate — cull sphere must sit on the plaza.
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

  if (created.length === 0) {
    console.warn(`[BrickLandmark] no batches spawned for ${spec.id}`);
  } else {
    console.info(
      `[BrickLandmark] ${spec.id}: ${spec.poses.length} bricks in ${created.length} batches`
    );
  }

  return created;
}
