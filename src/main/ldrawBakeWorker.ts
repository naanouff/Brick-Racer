/**
 * @file ldrawBakeWorker.ts
 * @description Worker thread: bake LDraw mesh + UV1 aging into an LDRC blob (CL5b).
 */

import { parentPort } from 'node:worker_threads';
import {
  bakeLdrawMesh,
  encodeLdrawBakedMesh,
} from '../racer/hub/brick/ldraw/ldrawBakedMesh';
import type { LdrawMeshAnchor } from '../racer/hub/brick/ldraw/ldrawGeometry';

export type LdrawBakeWorkerRequest = {
  triangles: Float32Array;
  edges: Float32Array;
  anchor: LdrawMeshAnchor;
  sourceHash: Uint8Array;
};

export type LdrawBakeWorkerResponse =
  | { ok: true; blob: Uint8Array }
  | { ok: false; error: string };

parentPort?.on('message', (msg: LdrawBakeWorkerRequest) => {
  try {
    const mesh = bakeLdrawMesh(msg.triangles, msg.edges, msg.anchor);
    if (!mesh) {
      const res: LdrawBakeWorkerResponse = { ok: false, error: 'mesh vide' };
      parentPort!.postMessage(res);
      return;
    }
    const blob = encodeLdrawBakedMesh(mesh, { sourceHash: msg.sourceHash });
    const res: LdrawBakeWorkerResponse = { ok: true, blob };
    parentPort!.postMessage(res, [blob.buffer as ArrayBuffer]);
  } catch (err) {
    const res: LdrawBakeWorkerResponse = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    parentPort!.postMessage(res);
  }
});
