/**
 * @file ldrawBakedMesh.ts
 * @description Bake LDraw preview mesh + UV1 aging atlas, and binary encode/decode (CL5).
 * Pure: no Node crypto / fs — callers supply the source hash for the disk cache.
 */

import { bakeLdrawAgingTexture, LDRAW_AGING_SIZE } from './ldrawAgingBake';
import {
  buildLdrawPreviewGeometry,
  LDRAW_CREASE_DEG,
  type LdrawMeshAnchor,
} from './ldrawGeometry';

/**
 * Bump when geometry, UV packing, crease, aging bake, or vertex layout changes.
 * Invalidates every file under `data/ldraw-cache/`.
 */
export const LDRAW_BAKE_VERSION = 1;

const MAGIC = 0x4352444c; // 'LDRC' little-endian
const HASH_BYTES = 20;
/** Fixed header before payload (4-byte aligned). */
const HEADER_BYTES = 64;

export type LdrawBakedMesh = {
  vertices: Float32Array;
  indices: Uint32Array;
  triangleCount: number;
  size: [number, number, number];
  aging: Uint8Array;
  coverage: Uint8Array;
};

export type LdrawBakedMeshEncodeMeta = {
  sourceHash: Uint8Array;
  agingSize?: number;
  creaseDeg?: number;
  version?: number;
};

export type LdrawBakedMeshHeader = {
  version: number;
  agingSize: number;
  creaseDeg: number;
  sourceHash: Uint8Array;
  vertexFloatCount: number;
  indexCount: number;
  triangleCount: number;
  size: [number, number, number];
};

/** Geometry + UV1 aging atlas for one part and anchor. */
export function bakeLdrawMesh(
  triangles: Float32Array,
  edges: Float32Array = new Float32Array(0),
  anchor: LdrawMeshAnchor = 'ground-center',
  creaseDeg: number = LDRAW_CREASE_DEG
): LdrawBakedMesh | null {
  const geo = buildLdrawPreviewGeometry(triangles, edges, creaseDeg, anchor);
  if (geo.triangleCount === 0) return null;
  const baked = bakeLdrawAgingTexture(geo.vertices, geo.indices, geo.triangleCount);
  return {
    vertices: geo.vertices,
    indices: geo.indices,
    triangleCount: geo.triangleCount,
    size: geo.size,
    aging: baked.rgba,
    coverage: baked.coverage,
  };
}

function align4(n: number): number {
  return (n + 3) & ~3;
}

/** Pack mesh + meta into a little-endian LDRC blob. */
export function encodeLdrawBakedMesh(
  mesh: LdrawBakedMesh,
  meta: LdrawBakedMeshEncodeMeta
): Uint8Array {
  if (meta.sourceHash.byteLength !== HASH_BYTES) {
    throw new Error(`sourceHash must be ${HASH_BYTES} bytes`);
  }
  const agingSize = meta.agingSize ?? LDRAW_AGING_SIZE;
  const creaseDeg = meta.creaseDeg ?? LDRAW_CREASE_DEG;
  const version = meta.version ?? LDRAW_BAKE_VERSION;
  const agingBytes = agingSize * agingSize * 4;
  const coverageBytes = agingSize * agingSize;
  if (mesh.aging.byteLength !== agingBytes || mesh.coverage.byteLength !== coverageBytes) {
    throw new Error('aging/coverage size mismatch');
  }

  const vertexFloatCount = mesh.vertices.length;
  const indexCount = mesh.indices.length;
  const verticesBytes = vertexFloatCount * 4;
  const indicesBytes = indexCount * 4;
  const coveragePadded = align4(coverageBytes);
  const total = HEADER_BYTES + verticesBytes + indicesBytes + agingBytes + coveragePadded;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);

  view.setUint32(0, MAGIC, true);
  view.setUint32(4, version, true);
  view.setUint32(8, agingSize, true);
  view.setFloat32(12, creaseDeg, true);
  out.set(meta.sourceHash, 16);
  view.setUint32(36, vertexFloatCount, true);
  view.setUint32(40, indexCount, true);
  view.setUint32(44, mesh.triangleCount, true);
  view.setFloat32(48, mesh.size[0], true);
  view.setFloat32(52, mesh.size[1], true);
  view.setFloat32(56, mesh.size[2], true);
  view.setUint32(60, 0, true); // reserved

  let o = HEADER_BYTES;
  out.set(new Uint8Array(mesh.vertices.buffer, mesh.vertices.byteOffset, verticesBytes), o);
  o += verticesBytes;
  out.set(new Uint8Array(mesh.indices.buffer, mesh.indices.byteOffset, indicesBytes), o);
  o += indicesBytes;
  out.set(mesh.aging, o);
  o += agingBytes;
  out.set(mesh.coverage, o);

  return out;
}

function hashesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Decode an LDRC blob. Returns null if magic/version/sizes/hash fail.
 * Pass `expectedHash` to require a match (disk-cache hit path).
 */
export function decodeLdrawBakedMesh(
  buf: Uint8Array,
  opts?: {
    expectedHash?: Uint8Array;
    expectedVersion?: number;
    expectedAgingSize?: number;
    expectedCreaseDeg?: number;
  }
): LdrawBakedMesh | null {
  if (buf.byteLength < HEADER_BYTES) return null;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (view.getUint32(0, true) !== MAGIC) return null;

  const version = view.getUint32(4, true);
  const agingSize = view.getUint32(8, true);
  const creaseDeg = view.getFloat32(12, true);
  const sourceHash = buf.subarray(16, 16 + HASH_BYTES);
  const vertexFloatCount = view.getUint32(36, true);
  const indexCount = view.getUint32(40, true);
  const triangleCount = view.getUint32(44, true);
  const size: [number, number, number] = [
    view.getFloat32(48, true),
    view.getFloat32(52, true),
    view.getFloat32(56, true),
  ];

  const expectedVersion = opts?.expectedVersion ?? LDRAW_BAKE_VERSION;
  const expectedAging = opts?.expectedAgingSize ?? LDRAW_AGING_SIZE;
  const expectedCrease = opts?.expectedCreaseDeg ?? LDRAW_CREASE_DEG;
  if (version !== expectedVersion) return null;
  if (agingSize !== expectedAging) return null;
  if (creaseDeg !== expectedCrease) return null;
  if (opts?.expectedHash && !hashesEqual(sourceHash, opts.expectedHash)) return null;

  const agingBytes = agingSize * agingSize * 4;
  const coverageBytes = agingSize * agingSize;
  const verticesBytes = vertexFloatCount * 4;
  const indicesBytes = indexCount * 4;
  const coveragePadded = align4(coverageBytes);
  const need = HEADER_BYTES + verticesBytes + indicesBytes + agingBytes + coveragePadded;
  if (buf.byteLength < need) return null;
  if (vertexFloatCount % 20 !== 0) return null;
  if (indexCount !== triangleCount * 6) return null;

  let o = HEADER_BYTES;
  const vertices = new Float32Array(vertexFloatCount);
  new Uint8Array(vertices.buffer).set(buf.subarray(o, o + verticesBytes));
  o += verticesBytes;
  const indices = new Uint32Array(indexCount);
  new Uint8Array(indices.buffer).set(buf.subarray(o, o + indicesBytes));
  o += indicesBytes;
  const aging = buf.slice(o, o + agingBytes);
  o += agingBytes;
  const coverage = buf.slice(o, o + coverageBytes);

  return { vertices, indices, triangleCount, size, aging, coverage };
}

/** Peek header fields without copying payload (for cache diagnostics). */
export function peekLdrawBakedMeshHeader(buf: Uint8Array): LdrawBakedMeshHeader | null {
  if (buf.byteLength < HEADER_BYTES) return null;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (view.getUint32(0, true) !== MAGIC) return null;
  return {
    version: view.getUint32(4, true),
    agingSize: view.getUint32(8, true),
    creaseDeg: view.getFloat32(12, true),
    sourceHash: buf.slice(16, 16 + HASH_BYTES),
    vertexFloatCount: view.getUint32(36, true),
    indexCount: view.getUint32(40, true),
    triangleCount: view.getUint32(44, true),
    size: [
      view.getFloat32(48, true),
      view.getFloat32(52, true),
      view.getFloat32(56, true),
    ],
  };
}
