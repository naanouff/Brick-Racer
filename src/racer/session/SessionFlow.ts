/**
 * @file SessionFlow.ts
 * @project brick-racer
 * @description Session states for blockout playtest (BRICK-BO1d). Full race transitions → BRICK-B3.
 */

import type { LevelId } from '../levels/registry';

export type SessionState = 'SandboxKart' | 'CityTest' | 'RaceActive';

export type SessionTransition =
  | { type: 'startRace'; sceneId?: LevelId }
  | { type: 'endRace'; reason?: 'finish' | 'quit' }
  | { type: 'gotoCity' }
  | { type: 'gotoSandbox' };

function stateForLevel(id: LevelId): SessionState {
  switch (id) {
    case 'city-test':
      return 'CityTest';
    case 'race-test':
      return 'RaceActive';
    case 'sandbox-kart':
      return 'SandboxKart';
  }
}

export class SessionFlow {
  private state: SessionState = 'RaceActive';

  getState(): SessionState {
    return this.state;
  }

  /** Sync flow label after SceneDirector.load. */
  syncFromLevel(id: LevelId): void {
    this.state = stateForLevel(id);
  }

  /**
   * Stub transitions for BO1 — callers still own SceneDirector.load.
   * Returns the suggested level id to load (if any).
   */
  requestTransition(transition: SessionTransition): LevelId | null {
    switch (transition.type) {
      case 'startRace':
        this.state = 'RaceActive';
        return transition.sceneId ?? 'race-test';
      case 'endRace':
        this.state = 'SandboxKart';
        return 'sandbox-kart';
      case 'gotoCity':
        this.state = 'CityTest';
        return 'city-test';
      case 'gotoSandbox':
        this.state = 'SandboxKart';
        return 'sandbox-kart';
    }
  }
}
