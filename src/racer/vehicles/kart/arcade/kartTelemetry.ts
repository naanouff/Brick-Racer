/**
 * @file kartTelemetry.ts
 * @description Simple store for HUD (speed, cc, drift, boost).
 */

import type { CcTier } from './arcadeKartProfile';
import type { DriftCharge } from './arcadeKartState';

export type KartTelemetrySnapshot = {
  speedMs: number;
  speedKmh: number;
  cc: CcTier;
  drifting: boolean;
  charge: DriftCharge;
  boostTimer: number;
  grounded: boolean;
};

let snapshot: KartTelemetrySnapshot = {
  speedMs: 0,
  speedKmh: 0,
  cc: 100,
  drifting: false,
  charge: 'none',
  boostTimer: 0,
  grounded: false,
};

const listeners = new Set<() => void>();

export function publishKartTelemetry(next: KartTelemetrySnapshot): void {
  snapshot = next;
  for (const l of listeners) l();
}

export function getKartTelemetry(): KartTelemetrySnapshot {
  return snapshot;
}

export function subscribeKartTelemetry(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
