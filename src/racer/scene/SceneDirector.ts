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
import { buildCityTestTriggers, CITY_HUB_SPAWNS, CITY_TEST_SPAWN } from '../levels/cityTest';
import { spawnCityTest } from '../levels/cityTest/spawnCityTest';
import { spawnMinifigLab } from '../levels/minifigLab/spawnMinifigLab';
import { MINIFIG_LAB_CAMERA_ID } from '../levels/minifigLab/minifigLabSpec';
import {
  applyBrickLabView,
  BRICK_LAB_CAMERA_NAME,
  type BrickLabView,
} from '../levels/brickLab/brickLabCamera';
import { spawnBrickLab } from '../levels/brickLab/spawnBrickLab';
import { spawnCatalogLab } from '../levels/catalogLab/spawnCatalogLab';
import { buildRaceTestTriggers, raceSpawnForVehicle } from '../levels/raceTest';
import { getLevelSpec, isLevelId, type LevelId } from '../levels/registry';
import { spawnLevel, type LevelSpawnPose, type LevelTrigger } from '../levels/shared';
import { setArcadeKartLevelContext } from '../vehicles/kart/arcade';
import { applyLegoKartSceneRuntime } from '../vehicles/kart/legoKartSceneRuntime';
import { resolveVehicleKind } from '../vehicles/selectVehicle';
import { ensureGprocSystem, levelNeedsGproc } from '../host/ensureGproc';
import {
  activateHubSession,
  deactivateHubSession,
  FOOT_CHASE_CAMERA_NAME,
  getHubPossession,
  isHubActive,
} from '../hub/hubPossession';
import type { BrickManual } from '../hub/brick/manual/manualSchema';
import {
  clearCatalogPreview,
  catalogMeshFbx,
  catalogMeshGlb,
  catalogMeshObj,
  spawnCatalogMeshPreview,
  spawnCatalogPreview,
  type CatalogMeshPreviewOpts,
  type CatalogMeshPreviewResult,
  type CatalogPreviewOpts,
} from '../hub/brick/catalog/spawnCatalogPreview';
import {
  readBrickLabManualId,
  readBrickLabShell,
  readBrickLabView,
} from '../hub/brick/manuals/labPrefs';

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

function activeChaseName(): string {
  if (isHubActive()) {
    const mode = getHubPossession();
    if (mode === 'foot') return FOOT_CHASE_CAMERA_NAME;
    return CHASE_CAM_BY_VEHICLE[mode];
  }
  return CHASE_CAM_BY_VEHICLE[resolveVehicleKind()];
}

export function rebindActiveChaseCamera(world: World, engine: IEngineContext): void {
  const full = engine as Engine;
  const chaseName = activeChaseName();
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
  // requestResize ne met à jour que la caméra éditeur courante. Une caméra
  // jamais liée garde aspect = 1 et étire le buffer 16:9.
  const canvas = full.webGPUContext.canvas;
  if (canvas.width > 0 && canvas.height > 0) {
    camera.aspect = canvas.width / canvas.height;
  }
  full.setGameCameraEntity(chaseId);
  full.setEditorCameraEntity(chaseId);
  full.setGameViewCameraPreference('chase');
  full.cameraControllerManager.setCameraEntity(null);
}

const CATALOG_LAB_CAMERA_NAME = 'CL_OrbitCamera';

function isOrbitLab(id: LevelId): boolean {
  return id === 'brick-lab' || id === 'catalog-lab' || id === 'minifig-lab';
}

/** Bind orbit cam as game+editor; prefer orbital over leftover chase preference. */
function bindOrbitLabCamera(engine: Engine, cameraName: string): boolean {
  const world = engine.ecsWorld;
  const cam = findEntityByName(world, cameraName);
  if (cam === null) return false;
  const camera = world.getComponent(cam, CameraComponent);
  const transform = world.getComponent(cam, TransformComponent);
  if (!camera || !transform) return false;

  for (const [entity, [c]] of world.query<[CameraComponent]>([CameraComponent]).iter()) {
    if (entity === cam) continue;
    c.isMain = false;
    c.isActive = false;
  }
  camera.isActive = true;
  camera.isMain = true;
  const canvas = engine.webGPUContext.canvas;
  if (canvas.width > 0 && canvas.height > 0) {
    camera.aspect = canvas.width / canvas.height;
  }
  engine.setGameCameraEntity(cam);
  engine.setEditorCameraEntity(cam);
  engine.setGameViewCameraPreference('orbital');
  return true;
}

export class SceneDirector {
  private activeId: LevelId | null = null;
  private rootEntityIds: Entity[] = [];
  /** Brick landmark entities only (for editor resync without respawning the lab). */
  private brickLabBrickIds: Entity[] = [];
  private loading = false;
  private brickLabSyncing = false;
  /** Latest manual waiting while a sync is in flight (drop older pending). */
  private brickLabPending: { manual: BrickManual; shell: boolean } | null = null;
  /** Last catalog / brush ghost — restored after brick-lab sync. */
  private lastCatalogPreview: CatalogPreviewOpts | null = null;

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
    this.brickLabPending = null;
    this.lastCatalogPreview = null;
    clearCatalogPreview(this.engine);
    const world = this.engine.ecsWorld;
    for (const entity of this.rootEntityIds) {
      try {
        world.destroyEntity(entity);
      } catch {
        // Entity may already be gone after a partial failure.
      }
    }
    this.rootEntityIds = [];
    this.brickLabBrickIds = [];
    this.activeId = null;
  }

  /** Catalog-lab (and brick-lab ghost): preview a part as bo_cube. */
  previewCatalogPart(opts: CatalogPreviewOpts): void {
    if (this.activeId !== 'catalog-lab' && this.activeId !== 'brick-lab') return;
    this.lastCatalogPreview = opts;
    spawnCatalogPreview(this.engine, opts);
  }

  /**
   * Catalog-lab studio mesh, or brick-lab brush ghost (position + yaw + opacity).
   * Triangle count is 0 when nothing spawned.
   */
  previewCatalogMesh(opts: CatalogMeshPreviewOpts): CatalogMeshPreviewResult {
    const ghost = opts.opacity != null && opts.opacity < 1;
    if (this.activeId === 'catalog-lab') {
      this.lastCatalogPreview = null;
      return spawnCatalogMeshPreview(this.engine, opts);
    }
    if (this.activeId === 'brick-lab' && ghost) {
      // Keep box restore payload if mesh miss; mesh ghosts refresh on pointermove.
      return spawnCatalogMeshPreview(this.engine, opts);
    }
    return { triangleCount: 0, ao: null, coverage: null };
  }

  clearCatalogPreview(): void {
    this.lastCatalogPreview = null;
    clearCatalogPreview(this.engine);
  }

  /**
   * Rebuild brick landmark from an in-memory manual (editor). Keeps ground / lights / camera.
   * Concurrent calls coalesce to the latest manual (no dropped poses).
   */
  async syncBrickLabManual(manual: BrickManual, shell = false): Promise<string | null> {
    if (this.activeId !== 'brick-lab') return null;
    if (this.brickLabSyncing) {
      this.brickLabPending = { manual, shell };
      return null;
    }
    this.brickLabSyncing = true;
    let lastStats: string | null = null;
    try {
      let current = { manual, shell };
      for (;;) {
        const world = this.engine.ecsWorld;
        for (const entity of this.brickLabBrickIds) {
          try {
            world.destroyEntity(entity);
          } catch {
            /* already gone */
          }
        }
        this.rootEntityIds = this.rootEntityIds.filter((e) => !this.brickLabBrickIds.includes(e));
        this.brickLabBrickIds = [];

        const lab = await spawnBrickLab(this.engine, {
          manual: current.manual,
          shell: current.shell,
          bricksOnly: true,
        });
        this.brickLabBrickIds = lab.brickEntityIds;
        this.rootEntityIds.push(...lab.brickEntityIds);
        lastStats = `${lab.manualId} shell=${lab.shell ? 1 : 0} bricks ${lab.report.kept}/${lab.report.total} batches ${lab.batches}`;

        const pending = this.brickLabPending;
        this.brickLabPending = null;
        if (!pending) break;
        current = pending;
      }
      if (this.lastCatalogPreview) {
        spawnCatalogPreview(this.engine, this.lastCatalogPreview);
      }
      return lastStats;
    } finally {
      this.brickLabSyncing = false;
    }
  }

  /** GLB of a mesh already previewed in catalog-lab. */
  exportCatalogGlb(ldrawId: string): Uint8Array | null {
    if (this.activeId !== 'catalog-lab') return null;
    return catalogMeshGlb(ldrawId);
  }

  /** OBJ of a mesh already previewed in catalog-lab. UV set is UV1. */
  exportCatalogObj(ldrawId: string): Uint8Array | null {
    if (this.activeId !== 'catalog-lab') return null;
    return catalogMeshObj(ldrawId);
  }

  /** FBX of a mesh already previewed in catalog-lab. UV0 and UV1. */
  exportCatalogFbx(ldrawId: string): Uint8Array | null {
    if (this.activeId !== 'catalog-lab') return null;
    return catalogMeshFbx(ldrawId);
  }

  /** Ortho Face / Côté / Dessus or restore orbit (brick-lab only). */
  setBrickLabView(view: BrickLabView): boolean {
    if (this.activeId !== 'brick-lab') return false;
    return applyBrickLabView(this.engine, view);
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
      let rootEntityIds: Entity[];
      let labStats: string | null = null;
      if (id === 'city-test') {
        ({ rootEntityIds } = await spawnCityTest(this.engine));
      } else if (id === 'brick-lab') {
        const lab = await spawnBrickLab(this.engine, {
          manualId: readBrickLabManualId(),
          shell: readBrickLabShell(),
        });
        rootEntityIds = lab.rootEntityIds;
        this.brickLabBrickIds = lab.brickEntityIds;
        labStats = `${lab.manualId} shell=${lab.shell ? 1 : 0} bricks ${lab.report.kept}/${lab.report.total} batches ${lab.batches}`;
      } else if (id === 'catalog-lab') {
        ({ rootEntityIds } = await spawnCatalogLab(this.engine));
        labStats = 'catalog preview';
      } else if (id === 'minifig-lab') {
        ({ rootEntityIds } = await spawnMinifigLab(this.engine));
        labStats = 'minifig LDraw';
      } else {
        ({ rootEntityIds } = await spawnLevel(this.engine, getLevelSpec(id)));
      }
      this.rootEntityIds = rootEntityIds;
      this.activeId = id;

      await applyLegoKartSceneRuntime(this.engine);
      // Graph reload / warm must not leave scripts/physics in editor Stop.
      (
        globalThis as unknown as { __W3DTS_SCRIPT_PLAY_STATE__?: 'playing' | 'paused' | 'stopped' }
      ).__W3DTS_SCRIPT_PLAY_STATE__ = 'playing';
      if (id === 'city-test') activateHubSession(CITY_HUB_SPAWNS);
      else deactivateHubSession();
      if (levelNeedsGproc(id)) ensureGprocSystem(this.engine);
      const orbitCamName =
        id === 'brick-lab'
          ? BRICK_LAB_CAMERA_NAME
          : id === 'catalog-lab'
            ? CATALOG_LAB_CAMERA_NAME
            : id === 'minifig-lab'
              ? MINIFIG_LAB_CAMERA_ID
              : null;
      if (orbitCamName) {
        if (!bindOrbitLabCamera(this.engine, orbitCamName)) {
          this.engine.logger.warn(
            LogChannel.Rendering,
            `[BrickRacer] ${id}: camera "${orbitCamName}" missing after spawn.`
          );
        }
      } else {
        rebindActiveChaseCamera(this.engine.ecsWorld, this.engine);
      }
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

      // Graph reload / warm can leave a stale chase preference — re-assert lab cam.
      if (orbitCamName) bindOrbitLabCamera(this.engine, orbitCamName);
      if (id === 'brick-lab') {
        applyBrickLabView(this.engine, readBrickLabView());
      }

      const hint =
        id === 'city-test'
          ? `[BrickRacer] Level "${id}" loaded. ZQSD caméra · souris / stick droit · F · X · pad Y.`
          : isOrbitLab(id)
            ? `[BrickRacer] Level "${id}" loaded. ${labStats ?? ''} · drag orbit · scroll zoom.`
            : `[BrickRacer] Level "${id}" loaded. WASD · Space drift · X reset · pad A/B · L1/R1 drift.`;
      this.engine.logger.info(LogChannel.DataLifecycle, hint);
    } finally {
      this.loading = false;
    }
  }
}
