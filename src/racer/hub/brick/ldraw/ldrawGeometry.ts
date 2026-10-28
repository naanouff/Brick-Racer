/**
 * @file ldrawGeometry.ts
 * @description LDraw .dat → triangles + hard edges (LDU) and W3DTS-ready interleaved vertices (CL2a).
 * Pure: file access is injected, so main process and tests share the same code.
 */

import { P, S } from '../brickUnits';

/** Returns file text for a normalized ref (`stud.dat`, `s/3001s01.dat`, `48/1-4cyli.dat`), or null. */
export type LdrawFileReader = (ref: string) => string | null;

export const LDRAW_MAX_DEPTH = 16;

/** Fold angle above which an edge stays hard even without a type-2 line. */
export const LDRAW_CREASE_DEG = 50;

/** Vertex welding grid: 0.01 LDU absorbs float noise from nested sub-file matrices. */
const WELD_PER_LDU = 100;

/** Interleaved layout of W3DTS standard meshes (STANDARD_MESH_VERTEX_FLOATS). */
const VERTEX_FLOATS = 20;
const ATTR_UV0 = 3;
const ATTR_UV1 = 5;
const ATTR_NORMAL = 7;
const ATTR_TANGENT = 10;
const ATTR_BITANGENT = 13;
const ATTR_COLOR = 16;

/** Horizontal: 1 stud = 20 LDU. Vertical: 1 plate = 8 LDU (game grid squashes plates). */
const LDU_TO_GAME_XZ = S / 20;
const LDU_TO_GAME_Y = P / 8;

/** UV0 density: 1 unit = 10 cm, same cell as MINIFIG_UV_METERS_PER_CELL. */
const UV_PER_METER = 10;

/** LDU geometry: 9 floats per triangle, 6 floats per type-2 edge segment. */
export type LdrawGeometry = {
  triangles: Float32Array;
  edges: Float32Array;
};

export function normalizeLdrawRef(ref: string): string {
  return ref.trim().replace(/\\/g, '/').toLowerCase();
}

/**
 * Type-1 line matrix: x' = a*x + b*y + c*z + X (same convention as build_master_catalog.py).
 * Returns [a,b,c,X, d,e,f,Y, g,h,i,Z].
 */
function lineMatrix(tok: readonly string[]): number[] | null {
  const m = tok.slice(2, 14).map(Number);
  if (m.length !== 12 || m.some((v) => !Number.isFinite(v))) return null;
  const [x, y, z, a, b, c, d, e, f, g, h, i] = m as [
    number, number, number, number, number, number,
    number, number, number, number, number, number,
  ];
  return [a, b, c, x, d, e, f, y, g, h, i, z];
}

function pushTransformed(src: Float32Array, m: readonly number[], out: number[]): void {
  for (let v = 0; v < src.length; v += 3) {
    const x = src[v]!;
    const y = src[v + 1]!;
    const z = src[v + 2]!;
    out.push(
      m[0]! * x + m[1]! * y + m[2]! * z + m[3]!,
      m[4]! * x + m[5]! * y + m[6]! * z + m[7]!,
      m[8]! * x + m[9]! * y + m[10]! * z + m[11]!
    );
  }
}

/** Caches per-file geometry (local space of each file) across parts. */
export class LdrawGeometryCache {
  private readonly files = new Map<string, LdrawGeometry | null>();

  constructor(private readonly read: LdrawFileReader) {}

  /** Triangles + type-2 edges in LDU; null if the file can't be resolved. */
  geometry(ref: string): LdrawGeometry | null {
    return this.local(normalizeLdrawRef(ref), 0, new Set());
  }

  /** Triangles in LDU, 9 floats per triangle; null if the file can't be resolved. */
  triangles(ref: string): Float32Array | null {
    return this.geometry(ref)?.triangles ?? null;
  }

  private local(key: string, depth: number, stack: Set<string>): LdrawGeometry | null {
    const cached = this.files.get(key);
    if (cached !== undefined) return cached;
    if (depth > LDRAW_MAX_DEPTH || stack.has(key)) return null;

    const text = this.read(key);
    if (text == null) {
      this.files.set(key, null);
      return null;
    }

    stack.add(key);
    const tris: number[] = [];
    const edges: number[] = [];
    for (const raw of text.split(/\r?\n/)) {
      const tok = raw.trim().split(/\s+/);
      const type = tok[0];
      if (type === '3' && tok.length >= 11) {
        for (let k = 2; k < 11; k++) tris.push(Number(tok[k]));
      } else if (type === '4' && tok.length >= 14) {
        const q = tok.slice(2, 14).map(Number);
        tris.push(q[0]!, q[1]!, q[2]!, q[3]!, q[4]!, q[5]!, q[6]!, q[7]!, q[8]!);
        tris.push(q[0]!, q[1]!, q[2]!, q[6]!, q[7]!, q[8]!, q[9]!, q[10]!, q[11]!);
      } else if (type === '2' && tok.length >= 8) {
        for (let k = 2; k < 8; k++) edges.push(Number(tok[k]));
      } else if (type === '1' && tok.length >= 15) {
        const m = lineMatrix(tok);
        if (!m) continue;
        // File names may contain spaces: everything after the 14 numeric tokens.
        const child = this.local(normalizeLdrawRef(tok.slice(14).join(' ')), depth + 1, stack);
        if (!child) continue;
        pushTransformed(child.triangles, m, tris);
        pushTransformed(child.edges, m, edges);
      }
    }
    stack.delete(key);

    const geo = { triangles: Float32Array.from(tris), edges: Float32Array.from(edges) };
    this.files.set(key, geo);
    return geo;
  }
}

export type LdrawPreviewGeometry = {
  vertices: Float32Array;
  indices: Uint32Array;
  /** Source triangles rendered (each emitted on both faces). */
  triangleCount: number;
  /** Game-space extents (m) after grounding. */
  size: [number, number, number];
};

/** 0 = X, 1 = Y, 2 = Z. Ties match unwrapPart: Z, then X, then Y. */
function unsignedAxis(nx: number, ny: number, nz: number): number {
  const ax = Math.abs(nx);
  const ay = Math.abs(ny);
  const az = Math.abs(nz);
  if (az >= ax && az >= ay) return 2;
  if (ax >= ay) return 0;
  return 1;
}

/** 0 +X, 1 -X, 2 +Y, 3 -Y, 4 +Z, 5 -Z. Same as unwrapPart.dominantAxis. */
function signedAxis(nx: number, ny: number, nz: number): number {
  const ax = Math.abs(nx);
  const ay = Math.abs(ny);
  const az = Math.abs(nz);
  if (az >= ax && az >= ay) return nz >= 0 ? 4 : 5;
  if (ax >= ay) return nx >= 0 ? 0 : 1;
  return ny >= 0 ? 2 : 3;
}

/** Orthographic UV. 1 unit = 10 cm on every axis. */
function projectBoxUv(axis: number, x: number, y: number, z: number): [number, number] {
  const s = UV_PER_METER;
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

/** World direction of +U for a box axis. */
function axisTangent(axis: number): [number, number, number] {
  switch (axis) {
    case 0:
      return [0, 0, -1];
    case 1:
      return [0, 0, 1];
    case 5:
      return [-1, 0, 0];
    default:
      return [1, 0, 0];
  }
}

const CURVATURE_CONTRAST = 2.6;
const AO_RADIUS = 0.09;
const AO_NEIGHBOR_CAP = 28;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function posKey(x: number, y: number, z: number): string {
  const s = 1e4;
  return `${Math.round(x * s)},${Math.round(y * s)},${Math.round(z * s)}`;
}

/**
 * Substance-style mesh maps into vertex color, same packing as W3DTS BakeMeshMaps:
 * R concavity, G convexity, B AO (1 = open), A height.
 * Seams use hard edges (split vertex normals). Front faces are baked; back faces copy them.
 */
function bakeLdrawVertexColors(
  vertices: Float32Array,
  vertCount: number,
  indices: Uint32Array,
  faceCount: number
): void {
  if (vertCount === 0 || faceCount === 0) return;
  const at = (i: number): [number, number, number] => {
    const o = i * VERTEX_FLOATS;
    return [vertices[o]!, vertices[o + 1]!, vertices[o + 2]!];
  };
  const nrm = (i: number): [number, number, number] => {
    const o = i * VERTEX_FLOATS + ATTR_NORMAL;
    return [vertices[o]!, vertices[o + 1]!, vertices[o + 2]!];
  };
  const concavity = new Float32Array(vertCount);
  const convexity = new Float32Array(vertCount);
  type EdgeRec = {
    vertex: number;
    normal: [number, number, number];
    opposite: [number, number, number];
  };
  const edges = new Map<string, EdgeRec[]>();
  for (let f = 0; f < faceCount; f++) {
    const corners = [indices[f * 6]!, indices[f * 6 + 1]!, indices[f * 6 + 2]!];
    const p = corners.map(at);
    const e1x = p[1]![0] - p[0]![0];
    const e1y = p[1]![1] - p[0]![1];
    const e1z = p[1]![2] - p[0]![2];
    const e2x = p[2]![0] - p[0]![0];
    const e2y = p[2]![1] - p[0]![1];
    const e2z = p[2]![2] - p[0]![2];
    let nx = e1y * e2z - e1z * e2y;
    let ny = e1z * e2x - e1x * e2z;
    let nz = e1x * e2y - e1y * e2x;
    const nl = Math.hypot(nx, ny, nz) || 1;
    const faceN: [number, number, number] = [nx / nl, ny / nl, nz / nl];
    const pairs: [number, number, number][] = [
      [0, 1, 2],
      [1, 2, 0],
      [2, 0, 1],
    ];
    for (const [a, b, c] of pairs) {
      const pa = p[a]!;
      const pb = p[b]!;
      const ka = posKey(pa[0], pa[1], pa[2]);
      const kb = posKey(pb[0], pb[1], pb[2]);
      const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      const list = edges.get(key) ?? [];
      list.push({ vertex: corners[a]!, normal: faceN, opposite: p[c]! });
      list.push({ vertex: corners[b]!, normal: faceN, opposite: p[c]! });
      edges.set(key, list);
    }
  }
  for (const recs of edges.values()) {
    for (let i = 0; i < recs.length; i++) {
      for (let j = i + 1; j < recs.length; j++) {
        const A = recs[i]!;
        const B = recs[j]!;
        const nd = A.normal[0] * B.normal[0] + A.normal[1] * B.normal[1] + A.normal[2] * B.normal[2];
        if (nd > 0.999) continue;
        const na = nrm(A.vertex);
        const nb = nrm(B.vertex);
        if (na[0] * nb[0] + na[1] * nb[1] + na[2] * nb[2] > 0.9) continue;
        const amount = clamp01((1 - nd) * CURVATURE_CONTRAST);
        const crx = A.normal[1] * B.normal[2] - A.normal[2] * B.normal[1];
        const cry = A.normal[2] * B.normal[0] - A.normal[0] * B.normal[2];
        const crz = A.normal[0] * B.normal[1] - A.normal[1] * B.normal[0];
        const dx = A.opposite[0] - B.opposite[0];
        const dy = A.opposite[1] - B.opposite[1];
        const dz = A.opposite[2] - B.opposite[2];
        const concave = crx * dx + cry * dy + crz * dz < 0;
        for (const v of [A.vertex, B.vertex]) {
          if (concave) concavity[v] = Math.max(concavity[v]!, amount);
          else convexity[v] = Math.max(convexity[v]!, amount);
        }
      }
    }
  }

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxY = -Infinity;
  for (let v = 0; v < vertCount; v++) {
    const [x, y, z] = at(v);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
  }
  const inv = 1 / AO_RADIUS;
  const cells = new Map<string, number[]>();
  for (let v = 0; v < vertCount; v++) {
    const [x, y, z] = at(v);
    const key = `${Math.floor((x - minX) * inv)}|${Math.floor((y - minY) * inv)}|${Math.floor((z - minZ) * inv)}`;
    const list = cells.get(key);
    if (list) list.push(v);
    else cells.set(key, [v]);
  }
  const heightSpan = Math.max(maxY - minY, 1e-6);
  const ao = new Float32Array(vertCount).fill(1);
  for (let v = 0; v < vertCount; v++) {
    const [x, y, z] = at(v);
    const n = nrm(v);
    const cx = Math.floor((x - minX) * inv);
    const cy = Math.floor((y - minY) * inv);
    const cz = Math.floor((z - minZ) * inv);
    let occ = 0;
    let samples = 0;
    let seen = 0;
    for (let ix = -1; ix <= 1 && seen < AO_NEIGHBOR_CAP; ix++) {
      for (let iy = -1; iy <= 1 && seen < AO_NEIGHBOR_CAP; iy++) {
        for (let iz = -1; iz <= 1 && seen < AO_NEIGHBOR_CAP; iz++) {
          const bucket = cells.get(`${cx + ix}|${cy + iy}|${cz + iz}`);
          if (!bucket) continue;
          for (const u of bucket) {
            if (seen >= AO_NEIGHBOR_CAP) break;
            if (u === v) continue;
            seen++;
            const [ux, uy, uz] = at(u);
            const dx = ux - x;
            const dy = uy - y;
            const dz = uz - z;
            const dist = Math.hypot(dx, dy, dz);
            if (dist < 1e-8 || dist >= AO_RADIUS) continue;
            const un = nrm(u);
            if (n[0] * un[0] + n[1] * un[1] + n[2] * un[2] > 0.88) continue;
            if ((n[0] * dx + n[1] * dy + n[2] * dz) / dist <= 0.12) continue;
            occ += 1 - dist / AO_RADIUS;
            samples++;
          }
        }
      }
    }
    if (samples > 0) ao[v] = clamp01(1 - occ / samples);
    const o = v * VERTEX_FLOATS + ATTR_COLOR;
    vertices[o] = concavity[v]!;
    vertices[o + 1] = convexity[v]!;
    vertices[o + 2] = ao[v]!;
    vertices[o + 3] = clamp01((at(v)[1] - minY) / heightSpan);
  }
  for (let f = 0; f < faceCount; f++) {
    const pairs: [number, number][] = [
      [indices[f * 6 + 3]!, indices[f * 6]!],
      [indices[f * 6 + 4]!, indices[f * 6 + 2]!],
      [indices[f * 6 + 5]!, indices[f * 6 + 1]!],
    ];
    for (const [back, front] of pairs) {
      const src = front * VERTEX_FLOATS + ATTR_COLOR;
      const dst = back * VERTEX_FLOATS + ATTR_COLOR;
      vertices[dst] = vertices[src]!;
      vertices[dst + 1] = vertices[src + 1]!;
      vertices[dst + 2] = vertices[src + 2]!;
      vertices[dst + 3] = vertices[src + 3]!;
    }
  }
}

type UvRect = { w: number; h: number; x: number; y: number };

/** Shelf layout for one row width. Returns the square side needed (max of width, height). */
function shelfLayout(rects: UvRect[], order: number[], rowLimit: number, gap: number): number {
  let cursorX = 0;
  let cursorY = 0;
  let shelfH = 0;
  let width = 0;
  for (const i of order) {
    const r = rects[i]!;
    if (cursorX > 0 && cursorX + r.w > rowLimit) {
      cursorY += shelfH + gap;
      cursorX = 0;
      shelfH = 0;
    }
    r.x = cursorX;
    r.y = cursorY;
    cursorX += r.w + gap;
    width = Math.max(width, r.x + r.w);
    if (r.h > shelfH) shelfH = r.h;
  }
  return Math.max(width, cursorY + shelfH, 1e-8);
}

/**
 * Shelf-pack chart rectangles into a square, then map them into [margin, 1-margin].
 * The row width is searched so the atlas fills both U and V (texel density for the aging bake).
 */
function packUvCharts(rects: UvRect[]): { scale: number; margin: number } {
  const area = rects.reduce((sum, r) => sum + r.w * r.h, 0);
  const gap = 0.02 * Math.max(Math.sqrt(area), 1e-4);
  const widest = Math.max(...rects.map((r) => r.w), 1e-4);
  const order = rects.map((_, i) => i).sort((a, b) => rects[b]!.h - rects[a]!.h);
  const base = Math.max(Math.sqrt(area), 1e-4);
  let bestLimit = Math.max(base, widest);
  let bestSide = Infinity;
  for (let k = 0.7; k <= 2.0001; k += 0.05) {
    const limit = Math.max(base * k, widest);
    const side = shelfLayout(rects, order, limit, gap);
    if (side < bestSide) {
      bestSide = side;
      bestLimit = limit;
    }
  }
  const atlas = shelfLayout(rects, order, bestLimit, gap);
  return { scale: 0.96 / atlas, margin: 0.02 };
}

/**
 * LDU triangles → W3DTS interleaved indexed vertices in game space:
 * game X = LDraw Z, game Y = -LDraw Y (LDraw is Y-down), game Z = LDraw X (BC1 long side on Z).
 * Grounded (min Y = 0) and centered in XZ. Double-sided (no BFC handling).
 *
 * Normals are smoothed across shared edges, except hard edges: type-2 lines (`edgesLdu`)
 * or folds sharper than `creaseDeg`. Without BFC, winding is unreliable, so faces are
 * compared and averaged orientation-free (|dot|, sign-aligned sum).
 *
 * UV0 is a box projection (1 unit = 10 cm) so plastic maps tile evenly.
 * UV1 packs the same charts into [0,1]. Catalog aging reads a 256² bake of that channel.
 * A chart stops on a hard edge or a projection-axis change, so UV seams sit in creases.
 */
export function buildLdrawPreviewGeometry(
  trisLdu: Float32Array,
  edgesLdu: Float32Array = new Float32Array(0),
  creaseDeg: number = LDRAW_CREASE_DEG
): LdrawPreviewGeometry {
  const empty: LdrawPreviewGeometry = {
    vertices: new Float32Array(0),
    indices: new Uint32Array(0),
    triangleCount: 0,
    size: [0, 0, 0],
  };
  const srcTris = Math.floor(trisLdu.length / 9);
  if (srcTris === 0) return empty;

  // Weld positions in LDU, then convert to game space.
  const weldKey = (x: number, y: number, z: number): string =>
    `${Math.round(x * WELD_PER_LDU)},${Math.round(y * WELD_PER_LDU)},${Math.round(z * WELD_PER_LDU)}`;
  const welded = new Map<string, number>();
  const gpos: number[] = [];
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  const weld = (x: number, y: number, z: number): number => {
    const k = weldKey(x, y, z);
    let id = welded.get(k);
    if (id === undefined) {
      id = gpos.length / 3;
      welded.set(k, id);
      const gx = z * LDU_TO_GAME_XZ;
      const gy = -y * LDU_TO_GAME_Y;
      const gz = x * LDU_TO_GAME_XZ;
      gpos.push(gx, gy, gz);
      if (gx < minX) minX = gx;
      if (gx > maxX) maxX = gx;
      if (gy < minY) minY = gy;
      if (gy > maxY) maxY = gy;
      if (gz < minZ) minZ = gz;
      if (gz > maxZ) maxZ = gz;
    }
    return id;
  };

  // Faces: welded corner ids, unit normal, corner angles. Degenerate ones dropped.
  const triV: number[] = [];
  const faceN: number[] = [];
  const faceArea: number[] = [];
  const cornerW: number[] = [];
  for (let t = 0; t < srcTris; t++) {
    const b = t * 9;
    const a = weld(trisLdu[b]!, trisLdu[b + 1]!, trisLdu[b + 2]!);
    const c1 = weld(trisLdu[b + 3]!, trisLdu[b + 4]!, trisLdu[b + 5]!);
    const c2 = weld(trisLdu[b + 6]!, trisLdu[b + 7]!, trisLdu[b + 8]!);
    if (a === c1 || c1 === c2 || a === c2) continue;
    const ids = [a, c1, c2];
    const e1x = gpos[c1 * 3]! - gpos[a * 3]!, e1y = gpos[c1 * 3 + 1]! - gpos[a * 3 + 1]!, e1z = gpos[c1 * 3 + 2]! - gpos[a * 3 + 2]!;
    const e2x = gpos[c2 * 3]! - gpos[a * 3]!, e2y = gpos[c2 * 3 + 1]! - gpos[a * 3 + 1]!, e2z = gpos[c2 * 3 + 2]! - gpos[a * 3 + 2]!;
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    const nl = Math.hypot(nx, ny, nz);
    if (nl < 1e-12) continue;
    triV.push(a, c1, c2);
    faceN.push(nx / nl, ny / nl, nz / nl);
    faceArea.push(nl);
    for (let k = 0; k < 3; k++) {
      const p = ids[k]!, q = ids[(k + 1) % 3]!, r = ids[(k + 2) % 3]!;
      const ux = gpos[q * 3]! - gpos[p * 3]!, uy = gpos[q * 3 + 1]! - gpos[p * 3 + 1]!, uz = gpos[q * 3 + 2]! - gpos[p * 3 + 2]!;
      const wx = gpos[r * 3]! - gpos[p * 3]!, wy = gpos[r * 3 + 1]! - gpos[p * 3 + 1]!, wz = gpos[r * 3 + 2]! - gpos[p * 3 + 2]!;
      const d = (ux * wx + uy * wy + uz * wz) / (Math.hypot(ux, uy, uz) * Math.hypot(wx, wy, wz));
      cornerW.push(Math.acos(Math.max(-1, Math.min(1, d))));
    }
  }
  const faceCount = triV.length / 3;
  if (faceCount === 0) return empty;
  const vertCount = gpos.length / 3;

  const edgeKey = (p: number, q: number): number => (p < q ? p * vertCount + q : q * vertCount + p);
  const edgeFaces = new Map<number, number[]>();
  for (let f = 0; f < faceCount; f++) {
    for (let k = 0; k < 3; k++) {
      const key = edgeKey(triV[f * 3 + k]!, triV[f * 3 + ((k + 1) % 3)]!);
      const list = edgeFaces.get(key);
      if (list) list.push(f);
      else edgeFaces.set(key, [f]);
    }
  }
  const hard = new Set<number>();
  for (let e = 0; e + 6 <= edgesLdu.length; e += 6) {
    const p = welded.get(weldKey(edgesLdu[e]!, edgesLdu[e + 1]!, edgesLdu[e + 2]!));
    const q = welded.get(weldKey(edgesLdu[e + 3]!, edgesLdu[e + 4]!, edgesLdu[e + 5]!));
    if (p !== undefined && q !== undefined && p !== q) hard.add(edgeKey(p, q));
  }

  // Vertex → incident corners (CSR).
  const vStart = new Uint32Array(vertCount + 1);
  for (const v of triV) vStart[v + 1]!++;
  for (let v = 0; v < vertCount; v++) vStart[v + 1]! += vStart[v]!;
  const vCorners = new Uint32Array(triV.length);
  const fill = vStart.slice(0, vertCount);
  for (let c = 0; c < triV.length; c++) vCorners[fill[triV[c]!]!++] = c;

  const dotN = (f: number, g: number): number =>
    faceN[f * 3]! * faceN[g * 3]! + faceN[f * 3 + 1]! * faceN[g * 3 + 1]! + faceN[f * 3 + 2]! * faceN[g * 3 + 2]!;
  const cosCrease = Math.cos((creaseDeg * Math.PI) / 180);

  // Per vertex: faces connected through smooth edges form one smoothing group.
  const cornerGroup = new Int32Array(triV.length);
  const cornerFlip = new Uint8Array(triV.length);
  const groupN: number[] = [];
  const groupV: number[] = [];
  const parent: number[] = [];
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  };
  for (let v = 0; v < vertCount; v++) {
    const s = vStart[v]!;
    const m = vStart[v + 1]! - s;
    parent.length = m;
    for (let i = 0; i < m; i++) parent[i] = i;
    for (let i = 0; i < m; i++) {
      const c = vCorners[s + i]!;
      const f = (c / 3) | 0;
      const k = c % 3;
      for (const u of [triV[f * 3 + ((k + 1) % 3)]!, triV[f * 3 + ((k + 2) % 3)]!]) {
        const key = edgeKey(v, u);
        if (hard.has(key)) continue;
        for (const g of edgeFaces.get(key)!) {
          if (g === f || Math.abs(dotN(f, g)) < cosCrease) continue;
          for (let j = 0; j < m; j++) {
            if (((vCorners[s + j]! / 3) | 0) !== g) continue;
            const ri = find(i), rj = find(j);
            if (ri !== rj) parent[ri] = rj;
            break;
          }
        }
      }
    }
    const rootGroup = new Map<number, { id: number; ref: number }>();
    for (let i = 0; i < m; i++) {
      const c = vCorners[s + i]!;
      const f = (c / 3) | 0;
      const root = find(i);
      let grp = rootGroup.get(root);
      if (!grp) {
        grp = { id: groupV.length, ref: f };
        rootGroup.set(root, grp);
        groupV.push(v);
        groupN.push(0, 0, 0);
      }
      const flip = dotN(f, grp.ref) < 0;
      const w = cornerW[c]! * (flip ? -1 : 1);
      groupN[grp.id * 3]! += w * faceN[f * 3]!;
      groupN[grp.id * 3 + 1]! += w * faceN[f * 3 + 1]!;
      groupN[grp.id * 3 + 2]! += w * faceN[f * 3 + 2]!;
      cornerGroup[c] = grp.id;
      cornerFlip[c] = flip ? 1 : 0;
    }
  }

  // Charts: smooth edges of the same projection axis. Hard edges and axis changes are seams.
  const faceChart = new Int32Array(faceCount).fill(-1);
  const chartFaces: number[][] = [];
  for (let f = 0; f < faceCount; f++) {
    if (faceChart[f]! >= 0) continue;
    const members: number[] = [];
    const stack = [f];
    faceChart[f] = chartFaces.length;
    while (stack.length > 0) {
      const g = stack.pop()!;
      members.push(g);
      const axisG = unsignedAxis(faceN[g * 3]!, faceN[g * 3 + 1]!, faceN[g * 3 + 2]!);
      for (let k = 0; k < 3; k++) {
        const key = edgeKey(triV[g * 3 + k]!, triV[g * 3 + ((k + 1) % 3)]!);
        if (hard.has(key)) continue;
        for (const h of edgeFaces.get(key)!) {
          if (h === g || faceChart[h]! >= 0) continue;
          if (Math.abs(dotN(g, h)) < cosCrease) continue;
          const axisH = unsignedAxis(faceN[h * 3]!, faceN[h * 3 + 1]!, faceN[h * 3 + 2]!);
          if (axisH !== axisG) continue;
          faceChart[h] = faceChart[g]!;
          stack.push(h);
        }
      }
    }
    chartFaces.push(members);
  }

  const chartAxis = new Int32Array(chartFaces.length);
  for (let c = 0; c < chartFaces.length; c++) {
    const members = chartFaces[c]!;
    const ref = members[0]!;
    let sx = 0;
    let sy = 0;
    let sz = 0;
    for (const f of members) {
      let nx = faceN[f * 3]!;
      let ny = faceN[f * 3 + 1]!;
      let nz = faceN[f * 3 + 2]!;
      if (dotN(f, ref) < 0) {
        nx = -nx;
        ny = -ny;
        nz = -nz;
      }
      const area = faceArea[f]!;
      sx += nx * area;
      sy += ny * area;
      sz += nz * area;
    }
    chartAxis[c] = signedAxis(sx, sy, sz);
  }

  const ox = (minX + maxX) * 0.5;
  const oz = (minZ + maxZ) * 0.5;
  const oy = minY;
  const centered = (v: number): [number, number, number] => [
    gpos[v * 3]! - ox,
    gpos[v * 3 + 1]! - oy,
    gpos[v * 3 + 2]! - oz,
  ];

  const rects: UvRect[] = chartFaces.map(() => ({ w: 0, h: 0, x: 0, y: 0 }));
  const chartMinU = new Float64Array(chartFaces.length);
  const chartMinV = new Float64Array(chartFaces.length);
  for (let c = 0; c < chartFaces.length; c++) {
    let minU = Infinity;
    let minV = Infinity;
    let maxU = -Infinity;
    let maxV = -Infinity;
    const axis = chartAxis[c]!;
    for (const f of chartFaces[c]!) {
      for (let k = 0; k < 3; k++) {
        const [px, py, pz] = centered(triV[f * 3 + k]!);
        const [u, v] = projectBoxUv(axis, px, py, pz);
        if (u < minU) minU = u;
        if (v < minV) minV = v;
        if (u > maxU) maxU = u;
        if (v > maxV) maxV = v;
      }
    }
    chartMinU[c] = minU;
    chartMinV[c] = minV;
    rects[c]!.w = Math.max(maxU - minU, 1e-6);
    rects[c]!.h = Math.max(maxV - minV, 1e-6);
  }
  const packed = packUvCharts(rects);

  // One vertex per (smoothing group, chart, side): UV seams don't cross a smooth chart.
  const chartCount = chartFaces.length;
  const slot = new Map<number, number>();
  const vertices = new Float32Array(faceCount * 6 * VERTEX_FLOATS);
  let w = 0;
  const vertexFor = (
    g: number,
    chart: number,
    side: number,
    u0: number,
    v0: number,
    u1: number,
    v1: number
  ): number => {
    const key = (g * chartCount + chart) * 2 + side;
    const existing = slot.get(key);
    if (existing !== undefined) return existing;
    let nx = groupN[g * 3]!;
    let ny = groupN[g * 3 + 1]!;
    let nz = groupN[g * 3 + 2]!;
    const nl = Math.hypot(nx, ny, nz) || 1;
    const sign = side ? -1 : 1;
    nx = (nx / nl) * sign;
    ny = (ny / nl) * sign;
    nz = (nz / nl) * sign;
    let [tx, ty, tz] = axisTangent(chartAxis[chart]!);
    const nd = nx * tx + ny * ty + nz * tz;
    tx -= nx * nd;
    ty -= ny * nd;
    tz -= nz * nd;
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl;
    ty /= tl;
    tz /= tl;
    const vert = groupV[g]!;
    const [px, py, pz] = centered(vert);
    const o = w * VERTEX_FLOATS;
    vertices[o] = px;
    vertices[o + 1] = py;
    vertices[o + 2] = pz;
    vertices[o + ATTR_UV0] = u0;
    vertices[o + ATTR_UV0 + 1] = v0;
    vertices[o + ATTR_UV1] = u1;
    vertices[o + ATTR_UV1 + 1] = v1;
    vertices[o + ATTR_NORMAL] = nx;
    vertices[o + ATTR_NORMAL + 1] = ny;
    vertices[o + ATTR_NORMAL + 2] = nz;
    vertices[o + ATTR_TANGENT] = tx;
    vertices[o + ATTR_TANGENT + 1] = ty;
    vertices[o + ATTR_TANGENT + 2] = tz;
    vertices[o + ATTR_BITANGENT] = ny * tz - nz * ty;
    vertices[o + ATTR_BITANGENT + 1] = nz * tx - nx * tz;
    vertices[o + ATTR_BITANGENT + 2] = nx * ty - ny * tx;
    vertices[o + ATTR_COLOR] = 1;
    vertices[o + ATTR_COLOR + 1] = 1;
    vertices[o + ATTR_COLOR + 2] = 1;
    vertices[o + ATTR_COLOR + 3] = 1;
    slot.set(key, w);
    return w++;
  };

  const indices = new Uint32Array(faceCount * 6);
  let ii = 0;
  const emitCorner = (f: number, k: number, side: number): number => {
    const chart = faceChart[f]!;
    const [px, py, pz] = centered(triV[f * 3 + k]!);
    const [u0, v0] = projectBoxUv(chartAxis[chart]!, px, py, pz);
    const rect = rects[chart]!;
    const u1 = packed.margin + (u0 - chartMinU[chart]! + rect.x) * packed.scale;
    const v1 = packed.margin + (v0 - chartMinV[chart]! + rect.y) * packed.scale;
    return vertexFor(cornerGroup[f * 3 + k]!, chart, side, u0, v0, u1, v1);
  };
  for (let f = 0; f < faceCount; f++) {
    for (const k of [0, 1, 2]) indices[ii++] = emitCorner(f, k, cornerFlip[f * 3 + k]!);
    for (const k of [0, 2, 1]) indices[ii++] = emitCorner(f, k, cornerFlip[f * 3 + k]! ^ 1);
  }

  const baked = vertices.subarray(0, w * VERTEX_FLOATS);
  bakeLdrawVertexColors(baked, w, indices, faceCount);

  return {
    vertices: baked,
    indices,
    triangleCount: faceCount,
    size: [maxX - minX, maxY - minY, maxZ - minZ],
  };
}
