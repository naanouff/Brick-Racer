/**
 * @file brickRacer.d.ts
 * @project brick-racer
 * @author Cyril TARRIET
 * @description Window API exposed by the Electron preload bridge.
 */

export interface BrickRacerApi {
  version: () => Promise<string>;
}

declare global {
  interface Window {
    brickRacer?: BrickRacerApi;
  }
}

export {};
