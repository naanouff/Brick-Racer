/**
 * @file arcadeKartRuntime.ts
 * @description Mutable runtime config shared by arcade systems + SceneDirector.
 */

import type { LevelSpawnPose, LevelTrigger } from '../../../levels/shared/levelTriggers';
import { profileForCc, resolveCcTier, type ArcadeKartProfile, type CcTier } from './arcadeKartProfile';
import { createArcadeKartState, type ArcadeKartState } from './arcadeKartState';

export type ArcadeKartRuntime = {
  cc: CcTier;
  profile: ArcadeKartProfile;
  state: ArcadeKartState;
};

let runtime: ArcadeKartRuntime | null = null;

export function initArcadeKartRuntime(opts?: {
  search?: string;
  spawn?: LevelSpawnPose;
  triggers?: LevelTrigger[];
}): ArcadeKartRuntime {
  const search =
    opts?.search ?? (typeof window !== 'undefined' ? window.location.search : '');
  const cc = resolveCcTier(search);
  const profile = profileForCc(cc);
  const spawn = opts?.spawn ?? { position: [0, 0.55, 0], rotation: [0, 0, 0, 1] };
  const state = createArcadeKartState(profile, spawn, opts?.triggers ?? []);
  runtime = { cc, profile, state };
  return runtime;
}

export function getArcadeKartRuntime(): ArcadeKartRuntime | null {
  return runtime;
}

export function setArcadeKartLevelContext(
  spawn: LevelSpawnPose,
  triggers: LevelTrigger[]
): void {
  if (!runtime) initArcadeKartRuntime({ spawn, triggers });
  else {
    runtime.state.spawn = spawn;
    runtime.state.triggers = triggers;
    runtime.state.insideTriggers.clear();
  }
}
