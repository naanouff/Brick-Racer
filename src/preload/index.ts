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
  /** Dev: baked mesh + UV1 aging atlas (disk-cached under data/ldraw-cache). */
  ldrawPartMesh: (
    ldrawId: string,
    anchor: 'ground-center' | 'origin' = 'ground-center'
  ): Promise<
    | {
        ok: true;
        ldrawId: string;
        anchor: 'ground-center' | 'origin';
        mesh: {
          vertices: Float32Array;
          indices: Uint32Array;
          triangleCount: number;
          size: [number, number, number];
          aging: Uint8Array;
          coverage: Uint8Array;
        };
      }
    | { ok: false; ldrawId: string; anchor: 'ground-center' | 'origin'; error: string }
  > => ipcRenderer.invoke('ldraw-part-mesh', ldrawId, anchor),
  /** Dev: write PNG thumb under public/catalog/thumbs/<id>.png */
  writeCatalogThumb: (
    ldrawId: string,
    pngBytes: Uint8Array | ArrayBuffer | number[]
  ): Promise<{ ok: boolean; path?: string; error?: string }> => {
    // Prefer a plain number[] — most reliable across Electron structured clone.
    const payload =
      pngBytes instanceof Uint8Array
        ? Array.from(pngBytes)
        : pngBytes instanceof ArrayBuffer
          ? Array.from(new Uint8Array(pngBytes))
          : pngBytes;
    return ipcRenderer.invoke('catalog-write-thumb', ldrawId, payload);
  },
  /** Dev: write manuals/<stem>.manual.json */
  writeBrickManual: (
    stem: string,
    json: unknown
  ): Promise<{ ok: boolean; path?: string; error?: string }> =>
    ipcRenderer.invoke('brick-manual-write', stem, json),
  /** Dev: list stems under manuals/*.manual.json */
  listBrickManuals: (): Promise<
    { ok: true; stems: string[] } | { ok: false; error: string }
  > => ipcRenderer.invoke('brick-manual-list'),
  /** Dev: read one manuals/<stem>.manual.json */
  readBrickManual: (
    stem: string
  ): Promise<
    | { ok: true; stem: string; manual: unknown; path: string }
    | { ok: false; error: string }
  > => ipcRenderer.invoke('brick-manual-read', stem),
  /**
   * Dev MCP bus: register a command handler. Main sends `brick-lab-mcp-cmd` (id, cmd);
   * reply with `brick-lab-mcp-reply` (id, result).
   */
  onBrickLabMcpCommand: (
    handler: (cmd: unknown) => unknown | Promise<unknown>
  ): (() => void) => {
    const listener = (_evt: Electron.IpcRendererEvent, id: number, cmd: unknown): void => {
      void Promise.resolve()
        .then(() => handler(cmd))
        .then((result) => {
          ipcRenderer.send('brick-lab-mcp-reply', id, result);
        })
        .catch((err: unknown) => {
          ipcRenderer.send('brick-lab-mcp-reply', id, {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          });
        });
    };
    ipcRenderer.on('brick-lab-mcp-cmd', listener);
    return () => {
      ipcRenderer.removeListener('brick-lab-mcp-cmd', listener);
    };
  },
});
