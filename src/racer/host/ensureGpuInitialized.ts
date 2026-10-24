/**
 * @file ensureGpuInitialized.ts
 * @project brick-racer
 * @description Serializes GPUManager.initialize so StrictMode remounts cannot configure the canvas before device exists.
 */

import { GPUManager } from '@naanouff/w3dts-core';
import type { ILogger } from '@naanouff/w3dts-logger';

let gpuInit: Promise<void> | null = null;

/**
 * Awaits a single shared GPUManager init. Concurrent callers (React StrictMode) share the same promise
 * so nobody reads `GPUManager.instance.device` while it is still undefined.
 */
export function ensureGpuInitialized(logger: ILogger): Promise<void> {
  gpuInit ??= GPUManager.initialize(logger).then(() => {
    if (!GPUManager.instance.device) {
      throw new Error(
        'WebGPU device is missing after GPUManager.initialize (adapter/device request failed).'
      );
    }
  });
  return gpuInit;
}
