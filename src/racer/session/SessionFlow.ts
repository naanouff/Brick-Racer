/**
 * @file SessionFlow.ts
 * @project brick-racer
 * @description Session state machine stub — SandboxKart only in P0 (B2f).
 */

export type SessionState = 'SandboxKart';

export class SessionFlow {
  private state: SessionState = 'SandboxKart';

  getState(): SessionState {
    return this.state;
  }
}
