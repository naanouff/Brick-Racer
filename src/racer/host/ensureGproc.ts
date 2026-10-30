/**
 * @file ensureGproc.ts
 * @description Register the gproc system once (sandbox kart + city minifig).
 */

import type { Engine, System } from '@naanouff/w3dts-core';
import { createGProcSystem } from '@naanouff/w3dts-gproc';

let installed = false;

export function levelNeedsGproc(levelId: string): boolean {
  // city-test / minifig-lab still register GPROC as LDraw fallback.
  return (
    levelId === 'sandbox-kart' || levelId === 'city-test' || levelId === 'minifig-lab'
  );
}

export function ensureGprocSystem(engine: Engine): void {
  if (installed) return;
  const device = engine.webGPUContext?.device;
  if (!device) return;
  // gproc types against core 0.0.36; the app pins 0.0.37. A direct cast fails tsc in CI.
  engine.scheduler.addSystem(createGProcSystem(device) as unknown as System);
  installed = true;
}
