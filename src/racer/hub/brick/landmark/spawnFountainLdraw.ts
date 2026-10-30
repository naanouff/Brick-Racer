/**
 * @file spawnFountainLdraw.ts
 * @description Real LDraw fountain. Falls back to the box manual when IPC is absent.
 */

import { quat, vec3 } from 'gl-matrix';
import {
  HierarchyComponent,
  NameComponent,
  RenderableComponent,
  TransformComponent,
  type Engine,
  type Entity,
  type IEngineContext,
} from '@naanouff/w3dts-core';
import { ensureLdrawUploadedMesh, fetchLdrawPart, hasLdrawIpc } from '../catalog/ldrawMeshCache';
import { brickMaterialId } from '../brickCatalog';
import { FOUNTAIN_LDRAW_PARTS, fountainLdrawGamePose, fountainLdrawIds } from './fountainLdraw';

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
 * Spawn the photo fountain at `origin` (ground centre).
 * Returns null when any part mesh is missing, so the caller keeps the box manual.
 */
export async function spawnFountainLdraw(
  engine: IEngineContext,
  origin: readonly [number, number, number]
): Promise<Entity[] | null> {
  const full = engine as Engine;
  if (!hasLdrawIpc()) return null;

  const meshes = new Map<string, ReturnType<typeof ensureLdrawUploadedMesh>>();
  const loaded = await Promise.all(
    fountainLdrawIds().map(async (id) => {
      try {
        return { id, result: await fetchLdrawPart(id, 'origin') };
      } catch (err) {
        console.warn(`[FountainLDraw] ${id}:`, err);
        return { id, result: null };
      }
    })
  );

  for (const { id, result } of loaded) {
    if (!result || !result.ok) {
      if (result && !result.ok) console.warn(`[FountainLDraw] ${id}: ${result.error}`);
      return null;
    }
    const entry = ensureLdrawUploadedMesh(full, {
      key: id,
      ...result.source,
      meshNamePrefix: 'fountain.ldraw',
      anchor: 'origin',
    });
    if (!entry) return null;
    meshes.set(id, entry);
  }

  const { resourceManager, ecsWorld: world } = full;
  for (const part of FOUNTAIN_LDRAW_PARTS) {
    if (!meshes.get(part.ldrawId)) return null;
    if (!resourceManager.getMaterialByName(brickMaterialId(part.colorId))) return null;
  }

  const created: Entity[] = [];
  for (let i = 0; i < FOUNTAIN_LDRAW_PARTS.length; i++) {
    const part = FOUNTAIN_LDRAW_PARTS[i]!;
    const mesh = meshes.get(part.ldrawId)!;
    const mat = resourceManager.getMaterialByName(brickMaterialId(part.colorId))!;
    const pose = fountainLdrawGamePose(part, origin);
    const entity = world.createEntity();
    world.addComponent(entity, new NameComponent(`landmark.fountain.ldraw.${i}`));
    const tf = new TransformComponent();
    vec3.set(tf.position, pose.position[0], pose.position[1], pose.position[2]);
    quat.set(tf.rotation, pose.rotation[0], pose.rotation[1], pose.rotation[2], pose.rotation[3]);
    tf.updateLocalTransform();
    world.addComponent(entity, tf);
    attachToSceneRoot(full, entity);
    world.addComponent(entity, new RenderableComponent(mesh.mesh, mat, false, true));
    created.push(entity);
  }

  console.info(`[FountainLDraw] ${created.length} parts at ${origin.join(',')}`);
  return created;
}
