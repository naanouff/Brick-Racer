/**
 * @file bootEngine.ts
 * @project brick-racer
 * @description GPUManager + EngineBuilder + vehicle/physics/gproc/scripts/chase + sandbox kart spawn.
 */

import {
  EngineBuilder,
  createChaseCameraSystem,
  setMsaaSampleCount,
  type Engine,
  type System,
} from '@naanouff/w3dts-core';
import {
  KART_PHYSICS_PRESET,
  createPhysicsSystem,
  createVehicleSystem,
  createVehicleWheelVisualSystem,
  registerVehicleScriptNodes,
} from '@naanouff/w3dts-physics';
import { createGProcSystem } from '@naanouff/w3dts-gproc';
import {
  createScriptsSystem,
  registerInputScriptNodes,
  type ScriptGraph,
} from '@naanouff/w3dts-scripts';
import { Logger, NullEventBus, type IEventEmitter } from '@naanouff/w3dts-logger';
import {
  LEGO_KART_BOOT_PROJECT_NAME,
  SANDBOX_KART_LEVEL_ID,
  LegoKartBootProject,
} from '../vehicles/kart/LegoKartBootProject';
import { SceneDirector } from '../scene/SceneDirector';
import { SessionFlow } from '../session/SessionFlow';
import { ensureGpuInitialized } from './ensureGpuInitialized';
import { NullModelLoader } from './nullModelLoader';

export type BootEngineResult = {
  engine: Engine;
  scene: SceneDirector;
  flow: SessionFlow;
};

/**
 * Physics / gproc / scripts type against core 0.0.36; app pins 0.0.37 — cast until republish.
 */
function asCoreSystem(system: unknown): System {
  return system as System;
}

/**
 * Initializes WebGPU, builds the engine, prepends systems, spawns sandbox kart.
 */
export async function bootEngine(canvas: HTMLCanvasElement): Promise<BootEngineResult> {
  const uiBus: IEventEmitter = new NullEventBus();
  const logger = new Logger(uiBus);

  await ensureGpuInitialized(logger);
  setMsaaSampleCount(1);

  canvas.tabIndex = 0;
  canvas.style.outline = 'none';

  const engine = await new EngineBuilder(canvas)
    .setUIBus(uiBus)
    .setLogger(logger)
    .withModelLoader(new NullModelLoader())
    .build();

  engine.setInputTarget(canvas);
  canvas.focus({ preventScroll: true });

  // Vehicle / physics / wheels / chase before transform / cull (viewer EngineMain order).
  engine.scheduler.prependSystems([
    asCoreSystem(createVehicleSystem()),
    asCoreSystem(createPhysicsSystem(KART_PHYSICS_PRESET)),
    asCoreSystem(createVehicleWheelVisualSystem()),
    createChaseCameraSystem(engine),
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

  const device = engine.webGPUContext.device;
  if (device) {
    engine.scheduler.addSystem(asCoreSystem(createGProcSystem(device)));
  }

  const flow = new SessionFlow();
  const scene = new SceneDirector(engine);
  await scene.load({ id: SANDBOX_KART_LEVEL_ID, url: `level://${SANDBOX_KART_LEVEL_ID}` });

  engine.director.register(new LegoKartBootProject());
  await engine.start(LEGO_KART_BOOT_PROJECT_NAME);

  engine.requestResize(canvas.width || canvas.clientWidth, canvas.height || canvas.clientHeight);

  return { engine, scene, flow };
}

