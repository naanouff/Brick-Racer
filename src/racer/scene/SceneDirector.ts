/**
 * @file SceneDirector.ts
 * @project brick-racer
 * @description Minimal scene load/unload façade (architecture B2f; used from B2d+).
 */

import type { Engine } from '@naanouff/w3dts-core';

export type SceneLoadTarget = {
  /** Logical id (e.g. `lego-kart`). */
  id: string;
  /** Public URL for SceneDD JSON. */
  url: string;
};

/**
 * Thin director: tracks the active scene id. Full unload/reload lands with SessionFlow transitions.
 * P0 loads once via the boot project; `load` records the target for host API surface.
 */
export class SceneDirector {
  private active: SceneLoadTarget | null = null;

  constructor(private readonly _engine: Engine) {}

  getActive(): SceneLoadTarget | null {
    return this.active;
  }

  /**
   * Records the active scene. Engine content swap is owned by the boot / SessionFlow project for P0.
   */
  async load(target: SceneLoadTarget): Promise<void> {
    this.active = target;
  }

  async unload(): Promise<void> {
    this.active = null;
  }
}
