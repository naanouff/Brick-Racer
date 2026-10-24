/**
 * @file bootEngine.ts
 * @project brick-racer
 * @description GPUManager + EngineBuilder + vehicle/physics/gproc/scripts/chase + level spawn.
 */

import {
  EngineBuilder,
  createChaseCameraSystem,
  setLayeredRefractionMode,
  setMsaaSampleCount,
  type Engine,
  type System,
} from '@naanouff/w3dts-core';
import * as W3dtsPhysics from '@naanouff/w3dts-physics';
import {
  KART_PHYSICS_PRESET,
  createPhysicsSystem,
  createVehicleSystem,
  createVehicleWheelVisualSystem,
  registerVehicleScriptNodes,
} from '@naanouff/w3dts-physics';
import {
  createArcadeCameraSystem,
  createArcadeKartSystem,
  initArcadeKartRuntime,
} from '../vehicles/kart/arcade';
import { createArcadePlaneSystem } from '../vehicles/plane/arcadePlaneSystem';
import { resolveVehicleKind, VEHICLE_CHASSIS_NAME } from '../vehicles/selectVehicle';

/** Mono physics only (npm 0.0.28 has no export — Vite aliases to mono when available). */
function applyKartPhysicsCollisionTuningSafe(): void {
  const fn = (W3dtsPhysics as { applyKartPhysicsCollisionTuning?: () => void })
    .applyKartPhysicsCollisionTuning;
  fn?.();
}
import { createGProcSystem } from '@naanouff/w3dts-gproc';
import {
  createScriptsSystem,
  registerInputScriptNodes,
  type ScriptGraph,
} from '@naanouff/w3dts-scripts';
import { Logger, NullEventBus, type IEventEmitter } from '@naanouff/w3dts-logger';
import {
  DEFAULT_LEVEL_ID,
  resolveLevelIdFromSearch,
  type LevelId,
} from '../levels/registry';
import {
  LEGO_KART_BOOT_PROJECT_NAME,
  LegoKartBootProject,
} from '../vehicles/kart/LegoKartBootProject';
import { SceneDirector } from '../scene/SceneDirector';
import { SessionFlow } from '../session/SessionFlow';
import { fitCanvasBuffer } from './canvasResolution';
import { ensureGpuInitialized } from './ensureGpuInitialized';
import { NullModelLoader } from './nullModelLoader';

export type BootEngineResult = {
  engine: Engine;
  scene: SceneDirector;
  flow: SessionFlow;
  levelId: LevelId;
};

/**
 * Physics / gproc / scripts type against core 0.0.36; app pins 0.0.37 — cast until republish.
 */
function asCoreSystem(system: unknown): System {
  return system as System;
}

export type BootEngineOptions = {
  /** Override `?level=` (tests / host). */
  levelId?: LevelId;
  /** search string, default `window.location.search`. */
  search?: string;
};

/**
 * Initializes WebGPU, builds the engine, prepends systems, spawns boot level.
 */
export async function bootEngine(
  canvas: HTMLCanvasElement,
  options: BootEngineOptions = {}
): Promise<BootEngineResult> {
  const uiBus: IEventEmitter = new NullEventBus();
  const logger = new Logger(uiBus);

  await ensureGpuInitialized(logger);
  setMsaaSampleCount(1);
  // No nested transmission SSR ping-pong (blockout has no glass stacks).
  setLayeredRefractionMode('off');

  canvas.tabIndex = 0;
  canvas.style.outline = 'none';

  const engine = await new EngineBuilder(canvas)
    .setUIBus(uiBus)
    .setLogger(logger)
    .withModelLoader(new NullModelLoader())
    .build();

  engine.setInputTarget(canvas);
  canvas.focus({ preventScroll: true });
  // Racing target ≥60 fps: no shadow maps for now (re-enable with showcase later).
  engine.renderer.shadowsEnabled = false;

  const search =
    options.search ??
    (typeof window !== 'undefined' ? window.location.search : '');
  const levelId = options.levelId ?? resolveLevelIdFromSearch(search) ?? DEFAULT_LEVEL_ID;

  applyKartPhysicsCollisionTuningSafe();
  initArcadeKartRuntime({ search });
  const vehicleKind = resolveVehicleKind(search);
  const chassisName = VEHICLE_CHASSIS_NAME[vehicleKind];
  engine.scheduler.prependSystems([
    asCoreSystem(createVehicleSystem()),
    asCoreSystem(
      createArcadeKartSystem({
        getInput: () => engine.inputManager,
        chassisName,
      })
    ),
    ...(vehicleKind === 'plane'
      ? [
          asCoreSystem(
            createArcadePlaneSystem({
              getInput: () => engine.inputManager,
            })
          ),
        ]
      : []),
    asCoreSystem(
      createPhysicsSystem({
        ...KART_PHYSICS_PRESET,
        // 60 Hz physics matches display target and halves solver cost vs 120.
        fixedTimeStep: 1 / 60,
        maxStepsPerFrame: 3,
      })
    ),
    asCoreSystem(createVehicleWheelVisualSystem()),
    createChaseCameraSystem(engine),
    asCoreSystem(createArcadeCameraSystem()),
  ]);

  engine.scheduler.addSystem(
    asCoreSystem(
      createScriptsSystem({
        resolveGraph: (component) => {
          if (component.graphId) {
            const resource = engine.resourceManager
              .getCachedGraphs('script-graph')
              .get(component.graphId);
            if (resource && typeof resource === 'object') return resource as ScriptGraph;
          }
          return component.graph;
        },
        getScriptInputReader: () => engine.inputManager,
        getScriptInputController: () => engine.inputManager,
        registerExtraNodes: (registry) => {
          registerInputScriptNodes(registry);
          registerVehicleScriptNodes(registry);
        },
      })
    )
  );

  // gproc only needed for sandbox LEGO kart — skip on race/city blockout.
  const device = engine.webGPUContext.device;
  if (device && levelId === 'sandbox-kart') {
    engine.scheduler.addSystem(asCoreSystem(createGProcSystem(device)));
  }

  const flow = new SessionFlow();
  const scene = new SceneDirector(engine);

  engine.director.register(new LegoKartBootProject(scene, flow, levelId));
  await engine.start(LEGO_KART_BOOT_PROJECT_NAME);

  const buf = fitCanvasBuffer(canvas);
  engine.requestResize(buf.width, buf.height);

  // Keep buffer at CSS pixels (DPR capped) when the window resizes.
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => {
      const next = fitCanvasBuffer(canvas);
      engine.requestResize(next.width, next.height);
    });
    ro.observe(canvas);
  }

  return { engine, scene, flow, levelId };
}
