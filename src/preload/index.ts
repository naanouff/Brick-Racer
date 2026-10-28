/**
 * @file index.ts
 * @project brick-racer
 * @author Cyril TARRIET
 * @description Preload bridge: expose a minimal brickRacer API to the renderer.
 */

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('brickRacer', {
  version: (): Promise<string> => ipcRenderer.invoke('app-version'),
  /** Dev: merge staging into src/.../catalog/data/parts.json */
  mergeBc1Parts: (staging: unknown): Promise<{
    ok: boolean;
    added: number;
    total: number;
    path?: string;
    error?: string;
  }> => ipcRenderer.invoke('bc1-merge-parts', staging),
  /** Dev: LDraw part triangles (9 floats) + type-2 edges (6 floats), LDU, from local data/ldraw. */
  ldrawPartTriangles: (
    ldrawId: string
  ): Promise<
    | { ok: true; ldrawId: string; triangles: Float32Array; edges: Float32Array }
    | { ok: false; ldrawId: string; error: string }
  > => ipcRenderer.invoke('ldraw-part-triangles', ldrawId),
});
