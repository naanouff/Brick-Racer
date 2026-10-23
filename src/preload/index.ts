/**
 * @file index.ts
 * @project brick-racer
 * @author Cyril TARRIET
 * @description Preload bridge: expose a minimal brickRacer API to the renderer.
 */

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('brickRacer', {
  version: (): Promise<string> => ipcRenderer.invoke('app-version'),
});
