/**
 * @file ldrawBakedMesh.test.ts
 * @description CL5a: bake + LDRC encode/decode + header invalidation.
 */

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { LDRAW_AGING_SIZE } from '../src/racer/hub/brick/ldraw/ldrawAgingBake';
import {
  bakeLdrawMesh,
  decodeLdrawBakedMesh,
  encodeLdrawBakedMesh,
  LDRAW_BAKE_VERSION,
  peekLdrawBakedMeshHeader,
} from '../src/racer/hub/brick/ldraw/ldrawBakedMesh';
import { LDRAW_CREASE_DEG } from '../src/racer/hub/brick/ldraw/ldrawGeometry';

/** Unit square in LDU on the XZ plane (two tris). */
function squareTris(): Float32Array {
  return Float32Array.from([
    0, 0, 0, 20, 0, 0, 20, 0, 20,
    0, 0, 0, 20, 0, 20, 0, 0, 20,
  ]);
}

function hashSource(tris: Float32Array, edges: Float32Array = new Float32Array(0)): Uint8Array {
  return createHash('sha1')
    .update(Buffer.from(tris.buffer, tris.byteOffset, tris.byteLength))
    .update(Buffer.from(edges.buffer, edges.byteOffset, edges.byteLength))
    .digest();
}

describe('bakeLdrawMesh', () => {
  it('builds vertices, indices, and a 256² aging atlas', () => {
    const mesh = bakeLdrawMesh(squareTris(), new Float32Array(0), 'ground-center');
    expect(mesh).not.toBeNull();
    expect(mesh!.triangleCount).toBeGreaterThan(0);
    expect(mesh!.vertices.length % 20).toBe(0);
    expect(mesh!.indices.length).toBe(mesh!.triangleCount * 6);
    expect(mesh!.aging.byteLength).toBe(LDRAW_AGING_SIZE * LDRAW_AGING_SIZE * 4);
    expect(mesh!.coverage.byteLength).toBe(LDRAW_AGING_SIZE * LDRAW_AGING_SIZE);
  });

  it('returns null for empty geometry', () => {
    expect(bakeLdrawMesh(new Float32Array(0))).toBeNull();
  });
});

describe('encode/decode LDRC', () => {
  it('round-trips mesh bytes', () => {
    const tris = squareTris();
    const edges = new Float32Array(0);
    const mesh = bakeLdrawMesh(tris, edges, 'origin')!;
    const sourceHash = hashSource(tris, edges);
    const blob = encodeLdrawBakedMesh(mesh, { sourceHash });
    const back = decodeLdrawBakedMesh(blob, { expectedHash: sourceHash });
    expect(back).not.toBeNull();
    expect(back!.triangleCount).toBe(mesh.triangleCount);
    expect(Array.from(back!.size)).toEqual(Array.from(Float32Array.from(mesh.size)));
    expect(Array.from(back!.vertices)).toEqual(Array.from(mesh.vertices));
    expect(Array.from(back!.indices)).toEqual(Array.from(mesh.indices));
    expect(Array.from(back!.aging)).toEqual(Array.from(mesh.aging));
    expect(Array.from(back!.coverage)).toEqual(Array.from(mesh.coverage));
  });

  it('rejects wrong version, aging size, crease, or hash', () => {
    const tris = squareTris();
    const mesh = bakeLdrawMesh(tris)!;
    const sourceHash = hashSource(tris);
    const blob = encodeLdrawBakedMesh(mesh, { sourceHash });
    const copy = blob.slice();

    expect(decodeLdrawBakedMesh(blob, { expectedVersion: LDRAW_BAKE_VERSION + 1 })).toBeNull();
    expect(decodeLdrawBakedMesh(blob, { expectedAgingSize: LDRAW_AGING_SIZE + 1 })).toBeNull();
    expect(decodeLdrawBakedMesh(blob, { expectedCreaseDeg: LDRAW_CREASE_DEG + 1 })).toBeNull();

    const badHash = sourceHash.slice();
    badHash[0] = (badHash[0]! ^ 0xff) & 0xff;
    expect(decodeLdrawBakedMesh(blob, { expectedHash: badHash })).toBeNull();

    // Corrupt magic
    copy[0] = 0;
    expect(decodeLdrawBakedMesh(copy, { expectedHash: sourceHash })).toBeNull();
  });

  it('peek reads header fields', () => {
    const tris = squareTris();
    const mesh = bakeLdrawMesh(tris)!;
    const sourceHash = hashSource(tris);
    const blob = encodeLdrawBakedMesh(mesh, { sourceHash });
    const header = peekLdrawBakedMeshHeader(blob)!;
    expect(header.version).toBe(LDRAW_BAKE_VERSION);
    expect(header.agingSize).toBe(LDRAW_AGING_SIZE);
    expect(header.creaseDeg).toBe(LDRAW_CREASE_DEG);
    expect(Array.from(header.sourceHash)).toEqual(Array.from(sourceHash));
    expect(header.triangleCount).toBe(mesh.triangleCount);
  });
});
