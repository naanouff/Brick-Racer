/**
 * @file startBrickRacerHost.ts
 * @project brick-racer
 * @author Cyril TARRIET
 * @description Host boot: engine + kart SceneDD + SandboxKart session (BRICK-B2).
 */

import type { Engine } from '@naanouff/w3dts-core';
import { bootEngine } from './bootEngine';
import type { SceneDirector } from '../scene/SceneDirector';
import type { SessionFlow } from '../session/SessionFlow';

export interface BrickRacerHost {
  readonly ready: true;
  readonly engine: Engine;
  readonly scene: SceneDirector;
  readonly flow: SessionFlow;
}

/** One boot per page — React StrictMode remounts must not spawn a second Engine/WebGPUContext. */
let hostBoot: Promise<BrickRacerHost> | null = null;

/**
 * Boots the W3DTS engine, loads lego-kart, exposes SceneDirector + SessionFlow (SandboxKart).
 * @param canvas - Visible game surface.
 */
export async function startBrickRacerHost(canvas: HTMLCanvasElement): Promise<BrickRacerHost> {
  canvas.dataset.testid = 'game-view-canvas';
  canvas.dataset.brickRacerHost = 'lego-kart';

  hostBoot ??= bootEngine(canvas)
    .then(({ engine, scene, flow }) => ({ ready: true as const, engine, scene, flow }))
    .catch((err) => {
      hostBoot = null;
      throw err;
    });

  return hostBoot;
}
