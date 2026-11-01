/**
 * @file orthoClipSystem.ts
 * @description Rewrite orthographic projections to WebGPU clip space.
 *
 * `mat4.ortho` (NO) is linear in NDC z [-1, 1]. WebGPU clips z to [0, 1], so the
 * mesh disappears and the only thing left on screen is the skybox cubemap.
 * Runs immediately after the engine camera system and before frustum culling.
 * Also clears cull tags so a frame that already culled with the OpenGL matrix
 * still draws.
 */

import {
  CameraComponent,
  CulledComponent,
  CulledGameComponent,
  type System,
  type World,
} from '@naanouff/w3dts-core';
import { mat4 } from 'gl-matrix';

function stripCullTags(world: World): void {
  const sceneCulled: number[] = [];
  const gameCulled: number[] = [];
  for (const [entity] of world.query([CulledComponent]).iter()) sceneCulled.push(entity);
  for (const [entity] of world.query([CulledGameComponent]).iter()) gameCulled.push(entity);
  for (const entity of sceneCulled) world.removeComponent(entity, CulledComponent);
  for (const entity of gameCulled) world.removeComponent(entity, CulledGameComponent);
}

export function createOrthoClipSystem(): System {
  return function orthoClipSystem(world: World): void {
    let orthographic = false;
    for (const [, comps] of world.query([CameraComponent]).iter()) {
      const camera = comps[0] as CameraComponent;
      if (camera.projectionMode !== 'orthographic' || !camera.isMain) continue;
      orthographic = true;
      const aspect = camera.aspect > 1e-6 ? camera.aspect : 1;
      const halfH = Math.max(1e-6, camera.orthographicHalfHeight || 1);
      const halfW = halfH * aspect;
      mat4.orthoZO(
        camera.projectionMatrix,
        -halfW,
        halfW,
        -halfH,
        halfH,
        camera.near,
        camera.far
      );
      mat4.multiply(camera.viewProjectionMatrix, camera.projectionMatrix, camera.viewMatrix);
    }
    if (orthographic) stripCullTags(world);
  };
}
