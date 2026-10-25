/**
 * @file SceneDirector.ts
 * @project brick-racer
 * @description Load / unload TypeScript level modules (BRICK-BO1d).
 */

import {
  CameraComponent,
  NameComponent,
  TransformComponent,
  type Engine,
  type Entity,
  type IEngineContext,
  type World,
} from '@naanouff/w3dts-core';
import { LogChannel } from '@naanouff/w3dts-logger';
import { buildCityTestTriggers, CITY_TEST_SPAWN } from '../levels/cityTest';
import { buildRaceTestTriggers, raceSpawnForVehicle } from '../levels/raceTest';
import { getLevelSpec, isLevelId, type LevelId } from '../levels/registry';
import { spawnLevel, type LevelSpawnPose, type LevelTrigger } from '../levels/shared';
import { setArcadeKartLevelContext } from '../vehicles/kart/arcade';
import { applyLegoKartSceneRuntime } from '../vehicles/kart/legoKartSceneRuntime';
import { resolveVehicleKind } from '../vehicles/selectVehicle';

function arcadeContextForLevel(id: LevelId): {
  spawn: LevelSpawnPose;
  triggers: LevelTrigger[];
} {
  if (id === 'race-test') {
    return { spawn: raceSpawnForVehicle(), triggers: buildRaceTestTriggers() };
  }
  if (id === 'city-test') {
    return { spawn: CITY_TEST_SPAWN, triggers: buildCityTestTriggers() };
  }
  return {
    spawn: { position: [0, 0.22, 0], rotation: [0, 0, 0, 1] },
    triggers: [],
  };
}

function findEntityByName(world: World, name: string): Entity | null {
  for (const [entity, [nm]] of world.query<[NameComponent]>([NameComponent]).iter()) {
    if (nm.name === name) return entity;
  }
  return null;
}

const CHASE_CAM_BY_VEHICLE = {
  kart: 'KartChaseCamera',
  moto: 'MotoChaseCamera',
  plane: 'PlaneChaseCamera',
} as const;

function rebindChaseCamera(world: World, engine: IEngineContext): void {
  const full = engine as Engine;
  const chaseName = CHASE_CAM_BY_VEHICLE[resolveVehicleKind()];
  const chaseId = findEntityByName(world, chaseName);
  if (chaseId === null) return;
  const camera = world.getComponent(chaseId, CameraComponent);
  const transform = world.getComponent(chaseId, TransformComponent);
  if (!camera || !transform) return;

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

export class SceneDirector {
  private activeId: LevelId | null = null;
  private rootEntityIds: Entity[] = [];
  private loading = false;

  constructor(private readonly engine: Engine) {}

  getActiveId(): LevelId | null {
    return this.activeId;
  }

  /** @deprecated Prefer getActiveId — kept for host smoke. */
  getActive(): { id: string; url: string } | null {
    if (!this.activeId) return null;
    return { id: this.activeId, url: `level://${this.activeId}` };
  }

  isLoading(): boolean {
    return this.loading;
  }

  async unload(): Promise<void> {
    const world = this.engine.ecsWorld;
    for (const entity of this.rootEntityIds) {
      try {
        world.destroyEntity(entity);
      } catch {
        // Entity may already be gone after a partial failure.
      }
    }
    this.rootEntityIds = [];
    this.activeId = null;
  }

  /**
   * Unloads the current level (if any) and spawns `id`.
   */
  async load(id: LevelId | string): Promise<void> {
    if (!isLevelId(id)) {
      throw new Error(`Unknown level id: ${id}`);
    }
    if (this.loading) return;
    this.loading = true;
    try {
      await this.unload();
      const spec = getLevelSpec(id);
      const { rootEntityIds } = await spawnLevel(this.engine, spec);
      this.rootEntityIds = rootEntityIds;
      this.activeId = id;

      await applyLegoKartSceneRuntime(this.engine);
      rebindChaseCamera(this.engine.ecsWorld, this.engine);
      const arcade = arcadeContextForLevel(id);
      setArcadeKartLevelContext(arcade.spawn, arcade.triggers);

      // Compile shader-graph pipelines before the first playable frames — otherwise
      // createRenderPipelineAsync stalls mid-frame and FPS climbs from ~40 → refresh.
      const mats = this.engine.resourceManager.getResourceOverview().materials;
      await this.engine.pipelineManager.warmPipelines(mats, {
        isLDR: false,
        shadowsEnabled: this.engine.renderer.shadowsEnabled,
        iblEnabled: true,
      });

      this.engine.logger.info(
        LogChannel.DataLifecycle,
        `[BrickRacer] Level "${id}" loaded. WASD · Space drift · X reset · pad A/B · L1/R1 drift.`
      );
    } finally {
      this.loading = false;
    }
  }
}
