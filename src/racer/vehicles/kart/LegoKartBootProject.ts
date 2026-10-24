/**
 * @file LegoKartBootProject.ts
 * @project brick-racer
 * @description Lit project: env + first level spawn via SceneDirector (no SceneDD).
 */

import {
  LitAbstractProject,
  type Engine,
  type ProjectLoadParams,
} from '@naanouff/w3dts-core';
import { LogChannel } from '@naanouff/w3dts-logger';
import type { LevelId } from '../../levels/registry';
import type { SceneDirector } from '../../scene/SceneDirector';
import type { SessionFlow } from '../../session/SessionFlow';
import { litRenderGraphPath } from '../../host/renderQuality';
import { pinLegoKartLitGraph } from './legoKartSceneRuntime';
import { LEGO_KART_IBL_GAIN } from './legoTileFloorLook';

export const LEGO_KART_BOOT_PROJECT_NAME = 'LegoKartBootProject';
/** @deprecated Use DEFAULT_LEVEL_ID from levels/registry. */
export const SANDBOX_KART_LEVEL_ID = 'sandbox-kart';

/**
 * Spawns the boot level through SceneDirector and applies kart runtime looks.
 */
export class LegoKartBootProject extends LitAbstractProject {
  constructor(
    private readonly scene: SceneDirector,
    private readonly flow: SessionFlow,
    private readonly initialLevelId: LevelId
  ) {
    super(LEGO_KART_BOOT_PROJECT_NAME);
  }

  protected override getSceneRenderGraphPath(): string {
    return litRenderGraphPath();
  }

  /** Game view must use the same lean graph (not LitAbstract production defaults). */
  protected override getGameRenderGraphPath(): string {
    return litRenderGraphPath();
  }

  protected override async initializeEnvironment(engine: Engine): Promise<void> {
    pinLegoKartLitGraph(this.name);
    await super.initializeEnvironment(engine);
    engine.renderer.iblIntensity = Math.min(LEGO_KART_IBL_GAIN, 1.1);
    // LitAbstractProject may re-enable shadows with the env — keep them off for fps.
    engine.renderer.shadowsEnabled = false;
  }

  protected override async initializeScene(params: ProjectLoadParams): Promise<void> {
    const { logger } = params;

    (
      globalThis as unknown as { __W3DTS_SCRIPT_PLAY_STATE__?: 'playing' | 'paused' | 'stopped' }
    ).__W3DTS_SCRIPT_PLAY_STATE__ = 'playing';

    try {
      await this.scene.load(this.initialLevelId);
      this.flow.syncFromLevel(this.initialLevelId);
      logger.info(
        LogChannel.DataLifecycle,
        `[BrickRacer] Boot level "${this.initialLevelId}". Switch with ?level= or the review HUD.`
      );
    } catch (e) {
      logger.error(
        LogChannel.DataLifecycle,
        `[BrickRacer] Failed to spawn boot level "${this.initialLevelId}".`,
        e as Error
      );
      throw e;
    }
  }
}
