/**
 * @file thumbRaster.ts
 * @description CPU iso render of a part mesh to RGBA, for catalog thumbnails (ED2).
 * Independent of the WebGPU swapchain, so it works in the single-canvas runtime.
 */

import type { BrickFootprint } from './types';
import { P, S } from '../brickUnits';

/** Interleaved W3DTS standard vertex: position at 0, normal at 7. */
const VERTEX_FLOATS = 20;
const ATTR_NORMAL = 7;

export type ThumbRasterOpts = {
  size?: number;
  /** sRGB 0..1 plastic colour. */
  rgb?: readonly [number, number, number];
  /** Fraction of the image left empty around the part. */
  margin?: number;
};

export type ThumbImage = {
  width: number;
  height: number;
  data: Uint8ClampedArray<ArrayBuffer>;
};

const YAW = Math.PI / 4;
const PITCH = Math.atan(1 / Math.SQRT2);
const LIGHT: readonly [number, number, number] = normalize([-0.45, 0.8, 0.4]);

function normalize(v: readonly [number, number, number]): [number, number, number] {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/** Camera basis for a classic LEGO-box iso view (front-right, from above). */
function viewBasis(): { right: number[]; up: number[]; fwd: number[] } {
  const cy = Math.cos(YAW);
  const sy = Math.sin(YAW);
  const cp = Math.cos(PITCH);
  const sp = Math.sin(PITCH);
  const fwd = [-sy * cp, -sp, -cy * cp];
  const right = [cy, 0, -sy];
  // right × fwd: world +Y stays "up". Screen mapping flips Y (canvas Y grows down).
  const up = [
    right[1]! * fwd[2]! - right[2]! * fwd[1]!,
    right[2]! * fwd[0]! - right[0]! * fwd[2]!,
    right[0]! * fwd[1]! - right[1]! * fwd[0]!,
  ];
  return { right, up, fwd };
}

/**
 * Project world points with the same iso basis + Y-down framing as {@link rasterizePartThumb}.
 * Used by tests to lock orientation (world +Y → smaller canvas Y).
 */
export function projectThumbPoints(
  points: ReadonlyArray<readonly [number, number, number]>,
  size = 128,
  margin = 0.08
): Array<{ x: number; y: number }> {
  const { right, up } = viewBasis();
  const proj = points.map(([x, y, z]) => ({
    x: x * right[0]! + y * right[1]! + z * right[2]!,
    y: x * up[0]! + y * up[1]! + z * up[2]!,
  }));
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of proj) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const span = Math.max(maxX - minX, maxY - minY, 1e-6);
  const scale = (size * (1 - 2 * margin)) / span;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return proj.map((p) => ({
    x: size / 2 + (p.x - cx) * scale,
    y: size / 2 - (p.y - cy) * scale,
  }));
}

/**
 * Render `vertices`/`indices` (W3DTS standard layout) with a z-buffer and Lambert shading.
 * Background stays transparent.
 */
export function rasterizePartThumb(
  vertices: Float32Array,
  indices: Uint32Array,
  opts: ThumbRasterOpts = {}
): ThumbImage | null {
  const size = opts.size ?? 128;
  const rgb = opts.rgb ?? [0.63, 0.65, 0.68];
  const margin = opts.margin ?? 0.08;
  const vCount = Math.floor(vertices.length / VERTEX_FLOATS);
  if (vCount < 3 || indices.length < 3) return null;

  const { right, up, fwd } = viewBasis();
  const sx = new Float32Array(vCount);
  const sy = new Float32Array(vCount);
  const sz = new Float32Array(vCount);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < vCount; i++) {
    const o = i * VERTEX_FLOATS;
    const x = vertices[o]!;
    const y = vertices[o + 1]!;
    const z = vertices[o + 2]!;
    const px = x * right[0]! + y * right[1]! + z * right[2]!;
    const py = x * up[0]! + y * up[1]! + z * up[2]!;
    sx[i] = px;
    sy[i] = py;
    sz[i] = x * fwd[0]! + y * fwd[1]! + z * fwd[2]!;
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }
  const span = Math.max(maxX - minX, maxY - minY);
  if (!(span > 0)) return null;
  const scale = (size * (1 - 2 * margin)) / span;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  for (let i = 0; i < vCount; i++) {
    sx[i] = size / 2 + (sx[i]! - cx) * scale;
    sy[i] = size / 2 - (sy[i]! - cy) * scale;
  }

  const data = new Uint8ClampedArray(size * size * 4);
  const depth = new Float32Array(size * size).fill(Infinity);
  for (let t = 0; t + 2 < indices.length; t += 3) {
    const a = indices[t]!;
    const b = indices[t + 1]!;
    const c = indices[t + 2]!;
    if (a >= vCount || b >= vCount || c >= vCount) continue;
    const ax = sx[a]!;
    const ay = sy[a]!;
    const bx = sx[b]!;
    const by = sy[b]!;
    const cxp = sx[c]!;
    const cyp = sy[c]!;
    const area = (bx - ax) * (cyp - ay) - (by - ay) * (cxp - ax);
    if (Math.abs(area) < 1e-9) continue;

    const shade = (i: number): number => {
      const o = i * VERTEX_FLOATS + ATTR_NORMAL;
      const n = normalize([vertices[o]!, vertices[o + 1]!, vertices[o + 2]!]);
      const lambert = Math.abs(n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
      return 0.38 + 0.62 * lambert;
    };
    const la = shade(a);
    const lb = shade(b);
    const lc = shade(c);

    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cxp)));
    const x1 = Math.min(size - 1, Math.ceil(Math.max(ax, bx, cxp)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cyp)));
    const y1 = Math.min(size - 1, Math.ceil(Math.max(ay, by, cyp)));
    for (let y = y0; y <= y1; y++) {
      const py = y + 0.5;
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5;
        const w0 = ((bx - px) * (cyp - py) - (by - py) * (cxp - px)) / area;
        const w1 = ((cxp - px) * (ay - py) - (cyp - py) * (ax - px)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const d = w0 * sz[a]! + w1 * sz[b]! + w2 * sz[c]!;
        const k = y * size + x;
        if (d >= depth[k]!) continue;
        depth[k] = d;
        const l = w0 * la + w1 * lb + w2 * lc;
        const p = k * 4;
        data[p] = Math.round(rgb[0] * l * 255);
        data[p + 1] = Math.round(rgb[1] * l * 255);
        data[p + 2] = Math.round(rgb[2] * l * 255);
        data[p + 3] = 255;
      }
    }
  }
  return { width: size, height: size, data };
}

/** Flat-shaded box mesh (game units, ground-centred) for parts without LDraw geometry. */
export function footprintBoxMesh(fp: BrickFootprint): {
  vertices: Float32Array;
  indices: Uint32Array;
} {
  const hx = (fp[0] * S) / 2;
  const hy = fp[1] * P;
  const hz = (fp[2] * S) / 2;
  const faces: Array<{ n: [number, number, number]; c: Array<[number, number, number]> }> = [
    { n: [1, 0, 0], c: [[hx, 0, -hz], [hx, hy, -hz], [hx, hy, hz], [hx, 0, hz]] },
    { n: [-1, 0, 0], c: [[-hx, 0, hz], [-hx, hy, hz], [-hx, hy, -hz], [-hx, 0, -hz]] },
    { n: [0, 1, 0], c: [[-hx, hy, -hz], [-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz]] },
    { n: [0, -1, 0], c: [[-hx, 0, hz], [-hx, 0, -hz], [hx, 0, -hz], [hx, 0, hz]] },
    { n: [0, 0, 1], c: [[hx, 0, hz], [hx, hy, hz], [-hx, hy, hz], [-hx, 0, hz]] },
    { n: [0, 0, -1], c: [[-hx, 0, -hz], [-hx, hy, -hz], [hx, hy, -hz], [hx, 0, -hz]] },
  ];
  const vertices = new Float32Array(faces.length * 4 * VERTEX_FLOATS);
  const indices = new Uint32Array(faces.length * 6);
  faces.forEach((f, fi) => {
    f.c.forEach((p, ci) => {
      const o = (fi * 4 + ci) * VERTEX_FLOATS;
      vertices[o] = p[0];
      vertices[o + 1] = p[1];
      vertices[o + 2] = p[2];
      vertices[o + ATTR_NORMAL] = f.n[0];
      vertices[o + ATTR_NORMAL + 1] = f.n[1];
      vertices[o + ATTR_NORMAL + 2] = f.n[2];
    });
    const b = fi * 4;
    indices.set([b, b + 1, b + 2, b, b + 2, b + 3], fi * 6);
  });
  return { vertices, indices };
}
