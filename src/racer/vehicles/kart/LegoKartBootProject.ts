/**
 * @file LegoKartBootProject.ts
 * @project brick-racer
 * @description Lit project that spawns the sandbox kart level (no SceneDD).
 */

import {
  CameraComponent,
  HierarchyComponent,
  LitAbstractProject,
  NameComponent,
  TransformComponent,
  type ComponentClass,
  type Engine,
  type Entity,
  type IComponent,
  type IEngineContext,
  type ProjectLoadParams,
  type World,
} from '@naanouff/w3dts-core';
import { LogChannel } from '@naanouff/w3dts-logger';
import { sandboxKartSpec, spawnSandboxKart } from '../../levels/sandboxKart';
import { applyLegoKartSceneRuntime, pinLegoKartLitGraph } from './legoKartSceneRuntime';
import { LEGO_KART_IBL_GAIN } from './legoTileFloorLook';
import { litRenderGraphPath } from '../../host/renderQuality';

export const LEGO_KART_BOOT_PROJECT_NAME = 'LegoKartBootProject';
export const SANDBOX_KART_LEVEL_ID = sandboxKartSpec.id;

const hierarchyCompQ = HierarchyComponent as unknown as ComponentClass<IComponent>;

function findEntityByName(world: World, name: string): Entity | null {
  for (const [entity, [nm]] of world.query<[NameComponent]>([NameComponent]).iter()) {
    if (nm.name === name) return entity;
  }
  return null;
}

function attachOrphanRootsToScene(engine: IEngineContext): void {
  const sceneRootId = engine.scene.entityId;
  const sceneHierarchy = engine.ecsWorld.getComponent(sceneRootId, HierarchyComponent);
  if (!sceneHierarchy) return;
  const query = engine.ecsWorld.query<[HierarchyComponent]>([hierarchyCompQ]);
  for (const [entity, [h]] of query.iter()) {
    if (entity === sceneRootId) continue;
    if (h.parent === null && !sceneHierarchy.children.includes(entity)) {
      h.parent = sceneRootId;
      sceneHierarchy.children.push(entity);
    }
  }
}

function rebindChaseCamera(world: World, engine: IEngineContext): void {
  const full = engine as Engine;
  const chaseId = findEntityByName(world, 'KartChaseCamera');
  if (chaseId === null) return;
  const camera = world.getComponent(chaseId, CameraComponent);
  const transform = world.getComponent(chaseId, TransformComponent);
  if (!camera || !transform) return;

  // Single-canvas host: scene pass uses getEditorCamera() first — point it at chase.
  for (const [entity, [cam]] of world.query<[CameraComponent]>([CameraComponent]).iter()) {
    if (entity === chaseId) continue;
    cam.isMain = false;
    cam.isActive = false;
  }

  camera.isActive = true;
  camera.isMain = true;
  full.setGameCameraEntity(chaseId);
  full.setEditorCameraEntity(chaseId);
  full.setGameViewCameraPreference('chase');
  full.cameraControllerManager.setCameraEntity(null);
}

/**
 * Spawns the sandbox kart level and applies kart runtime looks.
 */
export class LegoKartBootProject extends LitAbstractProject {
  constructor() {
    super(LEGO_KART_BOOT_PROJECT_NAME);
  }

  protected override getSceneRenderGraphPath(): string {
    return litRenderGraphPath();
  }

  protected override async initializeEnvironment(engine: Engine): Promise<void> {
    pinLegoKartLitGraph(this.name);
    await super.initializeEnvironment(engine);
    engine.renderer.iblIntensity = LEGO_KART_IBL_GAIN;
  }

  protected override async initializeScene(params: ProjectLoadParams): Promise<void> {
    const { world, logger, engine } = params;

    (
      globalThis as unknown as { __W3DTS_SCRIPT_PLAY_STATE__?: 'playing' | 'paused' | 'stopped' }
    ).__W3DTS_SCRIPT_PLAY_STATE__ = 'playing';

    try {
      await spawnSandboxKart(engine, sandboxKartSpec);
      attachOrphanRootsToScene(engine);
      await applyLegoKartSceneRuntime(engine);
      rebindChaseCamera(world, engine);

      logger.info(
        LogChannel.DataLifecycle,
        `[BrickRacer] Spawned level "${SANDBOX_KART_LEVEL_ID}". WASD to drive; X resets.`
      );
    } catch (e) {
      logger.error(
        LogChannel.DataLifecycle,
        `[BrickRacer] Failed to spawn sandbox kart level.`,
        e as Error
      );
      throw e;
    }
  }
}

