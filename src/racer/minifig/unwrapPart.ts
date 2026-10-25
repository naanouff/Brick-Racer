/**
 * @file unwrapPart.ts
 * @description Deterministic UV unwrap for minifig GPROC meshes (BRICK-MF3a).
 *
 * Every surface uses the same texel density: one UV unit = `MINIFIG_UV_METERS_PER_CELL`
 * metres (10 cm). Projection is per triangle from the geometric face normal (box),
 * with vertices split on chart boundaries so a triangle never interpolates two axes.
 * UVs stay continuous (not fract'd per vertex) so a face that crosses a tile boundary
 * does not smear the whole texture. The debug grid sampler repeats.
 */

import { GAttribute, GDomain, type GeometrySet } from '@naanouff/w3dts-gproc';

export type MinifigUnwrapKind =
  | 'minifig-head'
  | 'minifig-torso'
  | 'minifig-arm-r'
  | 'minifig-arm-l'
  | 'minifig-leg-r'
  | 'minifig-leg-l'
  | 'minifig-hand'
  | 'minifig-hips'
  | 'minifig-hat'
  | 'minifig-wrench'
  | string;

export type UnwrapPartOpts = {
  /** After mirrorX geometry, flip U so L/R charts stay coherent. */
  mirrorU?: boolean;
};

/** World metres per UV unit (one debug-grid cell). */
export const MINIFIG_UV_METERS_PER_CELL = 0.1;

type NumArr = ArrayLike<number>;

function normalizeKind(kind: string): string {
  return kind.trim().toLowerCase();
}

function isLeftKind(kind: string): boolean {
  return kind.endsWith('-l') || kind.endsWith('_l');
}

/** 0 +X, 1 -X, 2 +Y, 3 -Y, 4 +Z, 5 -Z. */
function dominantAxis(nx: number, ny: number, nz: number): number {
  const ax = Math.abs(nx);
  const ay = Math.abs(ny);
  const az = Math.abs(nz);
  if (az >= ax && az >= ay) return nz >= 0 ? 4 : 5;
  if (ax >= ay) return nx >= 0 ? 0 : 1;
  return ny >= 0 ? 2 : 3;
}

/** Orthographic UV in world metres / cell. Same scale on U and V. */
function projectAxis(axis: number, x: number, y: number, z: number): [number, number] {
  const s = 1 / MINIFIG_UV_METERS_PER_CELL;
  switch (axis) {
    case 0:
      return [-z * s, y * s];
    case 1:
      return [z * s, y * s];
    case 2:
      return [x * s, z * s];
    case 3:
      return [x * s, -z * s];
    case 5:
      return [-x * s, y * s];
    default:
      return [x * s, y * s];
  }
}

function faceNormal(
  pos: NumArr,
  i0: number,
  i1: number,
  i2: number
): [number, number, number] {
  const ax = (pos[i1 * 3] ?? 0) - (pos[i0 * 3] ?? 0);
  const ay = (pos[i1 * 3 + 1] ?? 0) - (pos[i0 * 3 + 1] ?? 0);
  const az = (pos[i1 * 3 + 2] ?? 0) - (pos[i0 * 3 + 2] ?? 0);
  const bx = (pos[i2 * 3] ?? 0) - (pos[i0 * 3] ?? 0);
  const by = (pos[i2 * 3 + 1] ?? 0) - (pos[i0 * 3 + 1] ?? 0);
  const bz = (pos[i2 * 3 + 2] ?? 0) - (pos[i0 * 3 + 2] ?? 0);
  let nx = ay * bz - az * by;
  let ny = az * bx - ax * bz;
  let nz = ax * by - ay * bx;
  const len = Math.hypot(nx, ny, nz);
  if (len < 1e-12) return [0, 0, 1];
  return [nx / len, ny / len, nz / len];
}

/**
 * Writes point `uv` (and splits points on box-chart boundaries).
 * UV is continuous: 1 unit = 10 cm on every chart.
 */
export function unwrapMinifigPart(
  geometry: GeometrySet,
  kind: MinifigUnwrapKind,
  opts: UnwrapPartOpts = {}
): GeometrySet {
  const geo = geometry.deepCopy();
  const posAttr = geo.getAttribute(GDomain.Point, 'position');
  const pos = posAttr?.materialize();
  if (!posAttr || !pos) return geo;

  const oldCount = posAttr.count;
  if (oldCount <= 0) return geo;

  const mirrorU = opts.mirrorU ?? isLeftKind(normalizeKind(String(kind)));
  const indexAttr = geo.getAttribute(GDomain.Face, 'indices');
  const indices = indexAttr?.materialize();
  const triCount =
    indices && indices.length >= 3 && indices.length % 3 === 0 ? indices.length / 3 : 0;

  if (triCount === 0) {
    const uvs = new Float32Array(oldCount * 2);
    for (let i = 0; i < oldCount; i++) {
      const [u, v] = projectAxis(4, pos[i * 3] ?? 0, pos[i * 3 + 1] ?? 0, pos[i * 3 + 2] ?? 0);
      uvs[i * 2] = mirrorU ? -u : u;
      uvs[i * 2 + 1] = v;
    }
    geo.setAttribute(GDomain.Point, new GAttribute('uv', 'vec2', oldCount, uvs));
    return geo;
  }

  const keyToNew = new Map<string, number>();
  const newFromOld: number[] = [];
  const newAxis: number[] = [];
  const newIndices = new Int32Array(indices!.length);

  for (let t = 0; t < triCount; t++) {
    const i0 = indices![t * 3] ?? 0;
    const i1 = indices![t * 3 + 1] ?? 0;
    const i2 = indices![t * 3 + 2] ?? 0;
    const [nx, ny, nz] = faceNormal(pos, i0, i1, i2);
    const axis = dominantAxis(nx, ny, nz);
    const corners = [i0, i1, i2];
    for (let c = 0; c < 3; c++) {
      const src = corners[c]!;
      const key = `${src}:${axis}`;
      let dst = keyToNew.get(key);
      if (dst === undefined) {
        dst = newFromOld.length;
        keyToNew.set(key, dst);
        newFromOld.push(src);
        newAxis.push(axis);
      }
      newIndices[t * 3 + c] = dst;
    }
  }

  const newCount = newFromOld.length;
  const pointAttrs = [...geo.getAttributes(GDomain.Point).entries()];
  geo.setDomainCount(GDomain.Point, newCount);
  for (const [name, attr] of pointAttrs) {
    if (name === 'uv' || name === 'indices') continue;
    const src = attr.materialize();
    const stride = attr.itemSize;
    const dst =
      attr.type === 'int' || attr.type === 'bool'
        ? new Int32Array(newCount * stride)
        : new Float32Array(newCount * stride);
    for (let n = 0; n < newCount; n++) {
      const s = newFromOld[n]!;
      for (let k = 0; k < stride; k++) {
        dst[n * stride + k] = src[s * stride + k] ?? 0;
      }
    }
    geo.setAttribute(GDomain.Point, new GAttribute(name, attr.type, newCount, dst));
  }

  const uvs = new Float32Array(newCount * 2);
  const newPos = geo.getAttribute(GDomain.Point, 'position')!.materialize();
  for (let n = 0; n < newCount; n++) {
    const axis = newAxis[n] ?? 4;
    const [u, v] = projectAxis(
      axis,
      newPos[n * 3] ?? 0,
      newPos[n * 3 + 1] ?? 0,
      newPos[n * 3 + 2] ?? 0
    );
    uvs[n * 2] = Number.isFinite(u) ? (mirrorU ? -u : u) : 0;
    uvs[n * 2 + 1] = Number.isFinite(v) ? v : 0;
  }

  geo.setAttribute(GDomain.Point, new GAttribute('uv', 'vec2', newCount, uvs));
  geo.setAttribute(
    GDomain.Face,
    new GAttribute('indices', 'int', newIndices.length, newIndices)
  );
  return geo;
}
