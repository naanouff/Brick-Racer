/**
 * @file ensureGproc.ts
 * @description Register the gproc system once (sandbox kart + city minifig).
 */

import type { Engine, System } from '@naanouff/w3dts-core';
import { createGProcSystem } from '@naanouff/w3dts-gproc';

let installed = false;

export function levelNeedsGproc(levelId: string): boolean {
  return levelId === 'sandbox-kart' || levelId === 'city-test';
}

export function ensureGprocSystem(engine: Engine): void {
  if (installed) return;
  const device = engine.webGPUContext?.device;
  if (!device) return;
  engine.scheduler.addSystem(createGProcSystem(device) as System);
  installed = true;
}
