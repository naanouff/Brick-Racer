/**
 * @file arcadeCameraSystem.ts
 * @description Post-chase FOV / slight pullback from speed + boost (BO1g).
 */

import {
  CameraComponent,
  GameCameraControllerComponent,
  type ComponentClass,
  type IComponent,
  type System,
  type World,
} from '@naanouff/w3dts-core';
import { getArcadeKartRuntime } from './arcadeKartRuntime';
import { getKartTelemetry } from './kartTelemetry';
import { clamp } from './arcadeKartMath';

const BASE_FOV_BY_ENTITY = new Map<number, number>();
const BASE_DIST_BY_ENTITY = new Map<number, number>();

export function createArcadeCameraSystem(): System {
  return function arcadeCameraSystem(world: World, dt: number): void {
    const stepDt = Math.max(0, Math.min(0.05, dt));
    const tel = getKartTelemetry();
    const rt = getArcadeKartRuntime();
    const vmax = rt?.profile.maxSpeed ?? 20;
    const speedNorm = clamp(tel.speedMs / Math.max(1, vmax), 0, 1.4);
    const boostNorm = tel.boostTimer > 0 ? 1 : 0;
    const fovMul = 1 + 0.12 * Math.min(1, speedNorm) + 0.04 * boostNorm;
    const distMul = 1 + 0.08 * boostNorm + 0.04 * Math.min(1, speedNorm);

    for (const [entity, comps] of world
      .query([CameraComponent, GameCameraControllerComponent])
      .iter()) {
      const cam = comps[0] as CameraComponent;
      const ctrl = comps[1] as GameCameraControllerComponent;
      if (ctrl.mode !== 'chase') continue;

      const distNow = ctrl.chaseDistance ?? 7.2;
      if (!BASE_FOV_BY_ENTITY.has(entity)) {
        BASE_FOV_BY_ENTITY.set(entity, cam.fov);
      }
      if (!BASE_DIST_BY_ENTITY.has(entity)) {
        BASE_DIST_BY_ENTITY.set(entity, distNow);
      }
      const baseFov = BASE_FOV_BY_ENTITY.get(entity)!;
      const baseDist = BASE_DIST_BY_ENTITY.get(entity)!;
      const targetFov = baseFov * fovMul;
      const targetDist = baseDist * distMul;
      const blend = 1 - Math.exp(-6 * stepDt);
      cam.fov = cam.fov + (targetFov - cam.fov) * blend;
      ctrl.chaseDistance = distNow + (targetDist - distNow) * blend;

      void (entity as unknown as ComponentClass<IComponent>);
    }
  };
}
