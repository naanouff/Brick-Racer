/**
 * @file arcadeKartState.ts
 * @description Mutable arcade kart runtime state (drift / boost).
 */

import type { LevelSpawnPose, LevelTrigger } from '../../../levels/shared/levelTriggers';
import type { ArcadeKartProfile, CcTier } from './arcadeKartProfile';

export type DriftCharge = 'none' | 'blue' | 'orange';

export type ArcadeKartState = {
  profile: ArcadeKartProfile;
  cc: CcTier;
  drifting: boolean;
  driftDir: number;
  driftTime: number;
  /** Countdown while hop may leave wheels unloaded without ending drift. */
  hopAirTimer: number;
  boostTimer: number;
  grounded: boolean;
  speed: number;
  triggers: LevelTrigger[];
  spawn: LevelSpawnPose;
  /** Trigger ids already consumed this pass (re-arm when exit). */
  insideTriggers: Set<string>;
};

export function createArcadeKartState(
  profile: ArcadeKartProfile,
  spawn: LevelSpawnPose,
  triggers: LevelTrigger[] = []
): ArcadeKartState {
  return {
    profile,
    cc: profile.cc,
    drifting: false,
    driftDir: 0,
    driftTime: 0,
    hopAirTimer: 0,
    boostTimer: 0,
    grounded: false,
    speed: 0,
    triggers,
    spawn,
    insideTriggers: new Set(),
  };
}

export function driftChargeLevel(state: ArcadeKartState): DriftCharge {
  if (!state.drifting) return 'none';
  if (state.driftTime >= state.profile.chargeOrange) return 'orange';
  if (state.driftTime >= state.profile.chargeBlue) return 'blue';
  return 'none';
}
