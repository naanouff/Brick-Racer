/**
 * @file startBrickRacerHost.ts
 * @project brick-racer
 * @author Cyril TARRIET
 * @description Host boot: engine + SceneDirector multi-level + SessionFlow (BRICK-BO1).
 */

import type { Engine } from '@naanouff/w3dts-core';
import { bootEngine } from './bootEngine';
import type { LevelId } from '../levels/registry';
import type { SceneDirector } from '../scene/SceneDirector';
import type { SessionFlow } from '../session/SessionFlow';

export interface BrickRacerHost {
  readonly ready: true;
  readonly engine: Engine;
  readonly scene: SceneDirector;
  readonly flow: SessionFlow;
  readonly levelId: LevelId;
  /** Hot-swap level (unload + spawn). Also updates SessionFlow. */
  loadLevel: (id: LevelId) => Promise<void>;
}

/** One boot per page — React StrictMode remounts must not spawn a second Engine/WebGPUContext. */
let hostBoot: Promise<BrickRacerHost> | null = null;

/**
 * Boots the W3DTS engine, loads `?level=` (default race-test), exposes SceneDirector + SessionFlow.
 */
export async function startBrickRacerHost(canvas: HTMLCanvasElement): Promise<BrickRacerHost> {
  canvas.dataset.testid = 'game-view-canvas';
  canvas.dataset.brickRacerHost = 'blockout';

  hostBoot ??= bootEngine(canvas)
    .then(({ engine, scene, flow, levelId }) => {
      const loadLevel = async (id: LevelId): Promise<void> => {
        await scene.load(id);
        flow.syncFromLevel(id);
        canvas.dataset.levelId = id;
        const url = new URL(window.location.href);
        url.searchParams.set('level', id);
        window.history.replaceState({}, '', url);
      };
      canvas.dataset.levelId = levelId;
      return { ready: true as const, engine, scene, flow, levelId, loadLevel };
    })
    .catch((err) => {
      hostBoot = null;
      throw err;
    });

  return hostBoot;
}
