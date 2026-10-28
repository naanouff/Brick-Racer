/**
 * @file brickRacer.d.ts
 * @project brick-racer
 * @author Cyril TARRIET
 * @description Window API exposed by the Electron preload bridge.
 */

export type Bc1MergeResult = {
  ok: boolean;
  added: number;
  total: number;
  path?: string;
  error?: string;
};

export type LdrawTrianglesResult =
  | { ok: true; ldrawId: string; triangles: Float32Array; edges: Float32Array }
  | { ok: false; ldrawId: string; error: string };

export interface BrickRacerApi {
  version: () => Promise<string>;
  mergeBc1Parts?: (staging: unknown) => Promise<Bc1MergeResult>;
  ldrawPartTriangles?: (ldrawId: string) => Promise<LdrawTrianglesResult>;
}

declare global {
  interface Window {
    brickRacer?: BrickRacerApi;
  }
}

export {};
