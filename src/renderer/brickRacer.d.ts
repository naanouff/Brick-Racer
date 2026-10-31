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

export type LdrawMeshAnchorIpc = 'ground-center' | 'origin';

export type LdrawBakedMeshIpc = {
  vertices: Float32Array;
  indices: Uint32Array;
  triangleCount: number;
  size: [number, number, number];
  aging: Uint8Array;
  coverage: Uint8Array;
};

export type LdrawPartMeshResult =
  | { ok: true; ldrawId: string; anchor: LdrawMeshAnchorIpc; mesh: LdrawBakedMeshIpc }
  | { ok: false; ldrawId: string; anchor: LdrawMeshAnchorIpc; error: string };

export type CatalogThumbWriteResult = { ok: boolean; path?: string; error?: string };
export type BrickManualWriteResult = { ok: boolean; path?: string; error?: string };
export type BrickManualListResult =
  | { ok: true; stems: string[] }
  | { ok: false; error: string };
export type BrickManualReadResult =
  | { ok: true; stem: string; manual: unknown; path: string }
  | { ok: false; error: string };

export interface BrickRacerApi {
  version: () => Promise<string>;
  mergeBc1Parts?: (staging: unknown) => Promise<Bc1MergeResult>;
  ldrawPartTriangles?: (ldrawId: string) => Promise<LdrawTrianglesResult>;
  ldrawPartMesh?: (
    ldrawId: string,
    anchor?: LdrawMeshAnchorIpc
  ) => Promise<LdrawPartMeshResult>;
  writeCatalogThumb?: (
    ldrawId: string,
    pngBytes: Uint8Array | ArrayBuffer | number[]
  ) => Promise<CatalogThumbWriteResult>;
  writeBrickManual?: (stem: string, json: unknown) => Promise<BrickManualWriteResult>;
  listBrickManuals?: () => Promise<BrickManualListResult>;
  readBrickManual?: (stem: string) => Promise<BrickManualReadResult>;
  /** Dev MCP: subscribe to bus commands; returns unsubscribe. */
  onBrickLabMcpCommand?: (
    handler: (cmd: unknown) => unknown | Promise<unknown>
  ) => () => void;
}

declare global {
  interface Window {
    brickRacer?: BrickRacerApi;
  }
}

export {};
