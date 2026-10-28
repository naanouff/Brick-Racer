/**
 * @file ldrawAgingBake.ts
 * @description Rasterize LDraw mesh maps into a UV1 atlas (R cavity, G edge, B AO, A height).
 * Cavity and edge wear are sampled in world space, like a Substance curvature bake,
 * so a UV seam on a smooth surface does not become a stripe.
 */

/** Atlas resolution. bytesPerRow must stay 256-byte aligned (size * 4). */
export const LDRAW_AGING_SIZE = 256;

/** World-space width of the crease band, in game meters (~0.7 mm at stud scale). */
const EDGE_WIDTH = 0.03;
const CURVATURE_CONTRAST = 2.6;
/**
 * AO ray length in game meters. Long enough for the soft cavity shade Substance
 * bakes (under a brim, inside a bowl), short of the whole part.
 */
const AO_RAY = 0.12;
const AO_RAYS = 24;
/** Ray origin offset along the shading normal, against self-hits. */
const RAY_BIAS = 0.001;
/** Blur only between texels this close in world space (same chart neighbourhood). */
const BLUR_WORLD_RADIUS = 0.03;
/** Dilation around charts so bilinear filtering doesn't pull neutral gutter texels. */
const GUTTER_PX = 3;
const STRIDE = 20;
const ATTR_UV1 = 5;
const ATTR_NORMAL = 7;

export type LdrawAgingBake = {
  rgba: Uint8Array;
  /** 1 on texels covered by a front triangle, before the 1px gutter dilation. */
  coverage: Uint8Array;
  size: number;
};

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function posKey(x: number, y: number, z: number): string {
  const s = 1e4;
  return `${Math.round(x * s)},${Math.round(y * s)},${Math.round(z * s)}`;
}

function dist2ToSegment(
  px: number,
  py: number,
  pz: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const ab2 = abx * abx + aby * aby + abz * abz;
  let t = 0;
  if (ab2 > 1e-12) {
    t = ((px - ax) * abx + (py - ay) * aby + (pz - az) * abz) / ab2;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
  }
  const dx = px - (ax + abx * t);
  const dy = py - (ay + aby * t);
  const dz = pz - (az + abz * t);
  return dx * dx + dy * dy + dz * dz;
}

type Seg = {
  ax: number;
  ay: number;
  az: number;
  bx: number;
  by: number;
  bz: number;
  faces: number[];
  concavity: number;
  convexity: number;
};

/**
 * Bake mesh maps at `size`². UV1 is sampled directly (v = 0 is the first row).
 * Gutters stay neutral: R = 0, G = 0, B = 1, A = 0.
 */
export function bakeLdrawAgingTexture(
  vertices: Float32Array,
  indices: Uint32Array,
  faceCount: number,
  size = LDRAW_AGING_SIZE
): LdrawAgingBake {
  const pixels = size * size;
  const rgba = new Uint8Array(pixels * 4);
  const coverage = new Uint8Array(pixels);
  for (let i = 0; i < pixels; i++) rgba[i * 4 + 2] = 255;
  if (faceCount === 0 || vertices.length < STRIDE) {
    return { rgba, coverage, size };
  }

  const at = (v: number): [number, number, number] => {
    const o = v * STRIDE;
    return [vertices[o]!, vertices[o + 1]!, vertices[o + 2]!];
  };
  const nrm = (v: number): [number, number, number] => {
    const o = v * STRIDE + ATTR_NORMAL;
    return [vertices[o]!, vertices[o + 1]!, vertices[o + 2]!];
  };
  const uv1 = (v: number): [number, number] => {
    const o = v * STRIDE + ATTR_UV1;
    return [vertices[o]!, vertices[o + 1]!];
  };

  const faceOf = new Int32Array(pixels).fill(-1);
  const posX = new Float32Array(pixels);
  const posY = new Float32Array(pixels);
  const posZ = new Float32Array(pixels);
  const nrmX = new Float32Array(pixels);
  const nrmY = new Float32Array(pixels);
  const nrmZ = new Float32Array(pixels);

  const eps = 1e-4;
  for (let f = 0; f < faceCount; f++) {
    const i0 = indices[f * 6]!;
    const i1 = indices[f * 6 + 1]!;
    const i2 = indices[f * 6 + 2]!;
    const p0 = at(i0);
    const p1 = at(i1);
    const p2 = at(i2);
    const n0 = nrm(i0);
    const n1 = nrm(i1);
    const n2 = nrm(i2);
    const t0 = uv1(i0);
    const t1 = uv1(i1);
    const t2 = uv1(i2);
    const ax = t0[0] * size;
    const ay = t0[1] * size;
    const bx = t1[0] * size;
    const by = t1[1] * size;
    const cx = t2[0] * size;
    const cy = t2[1] * size;
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(den) < 1e-8) continue;
    let minX = Math.floor(Math.min(ax, bx, cx));
    let maxX = Math.ceil(Math.max(ax, bx, cx));
    let minY = Math.floor(Math.min(ay, by, cy));
    let maxY = Math.ceil(Math.max(ay, by, cy));
    if (minX < 0) minX = 0;
    if (minY < 0) minY = 0;
    if (maxX > size - 1) maxX = size - 1;
    if (maxY > size - 1) maxY = size - 1;
    let wrote = 0;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const w0 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den;
        const w1 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den;
        const w2 = 1 - w0 - w1;
        if (w0 < -eps || w1 < -eps || w2 < -eps) continue;
        const id = y * size + x;
        posX[id] = p0[0] * w0 + p1[0] * w1 + p2[0] * w2;
        posY[id] = p0[1] * w0 + p1[1] * w1 + p2[1] * w2;
        posZ[id] = p0[2] * w0 + p1[2] * w1 + p2[2] * w2;
        nrmX[id] = n0[0] * w0 + n1[0] * w1 + n2[0] * w2;
        nrmY[id] = n0[1] * w0 + n1[1] * w1 + n2[1] * w2;
        nrmZ[id] = n0[2] * w0 + n1[2] * w1 + n2[2] * w2;
        faceOf[id] = f;
        coverage[id] = 1;
        wrote++;
      }
    }
    if (wrote === 0) {
      const cu = (t0[0] + t1[0] + t2[0]) / 3;
      const cv = (t0[1] + t1[1] + t2[1]) / 3;
      const x = Math.min(size - 1, Math.max(0, Math.floor(cu * size)));
      const y = Math.min(size - 1, Math.max(0, Math.floor(cv * size)));
      const id = y * size + x;
      posX[id] = (p0[0] + p1[0] + p2[0]) / 3;
      posY[id] = (p0[1] + p1[1] + p2[1]) / 3;
      posZ[id] = (p0[2] + p1[2] + p2[2]) / 3;
      nrmX[id] = (n0[0] + n1[0] + n2[0]) / 3;
      nrmY[id] = (n0[1] + n1[1] + n2[1]) / 3;
      nrmZ[id] = (n0[2] + n1[2] + n2[2]) / 3;
      faceOf[id] = f;
      coverage[id] = 1;
    }
  }

  const facePixels: number[][] = Array.from({ length: faceCount }, () => []);
  for (let id = 0; id < pixels; id++) {
    const face = faceOf[id]!;
    if (face >= 0) facePixels[face]!.push(id);
  }

  type Rec = {
    face: number;
    vertex: number;
    normal: [number, number, number];
    opposite: [number, number, number];
  };
  type Bucket = { ax: number; ay: number; az: number; bx: number; by: number; bz: number; recs: Rec[] };
  const edges = new Map<string, Bucket>();
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
      let bucket = edges.get(key);
      if (!bucket) {
        const flip = ka > kb;
        bucket = {
          ax: flip ? pb[0] : pa[0],
          ay: flip ? pb[1] : pa[1],
          az: flip ? pb[2] : pa[2],
          bx: flip ? pa[0] : pb[0],
          by: flip ? pa[1] : pb[1],
          bz: flip ? pa[2] : pb[2],
          recs: [],
        };
        edges.set(key, bucket);
      }
      bucket.recs.push({ face: f, vertex: corners[a]!, normal: faceN, opposite: p[c]! });
      bucket.recs.push({ face: f, vertex: corners[b]!, normal: faceN, opposite: p[c]! });
    }
  }

  const segs: Seg[] = [];
  for (const bucket of edges.values()) {
    let vote = 0;
    let mag = 0;
    const faces: number[] = [];
    const byFace = new Map<number, Rec>();
    for (const rec of bucket.recs) if (!byFace.has(rec.face)) byFace.set(rec.face, rec);
    const unique = [...byFace.values()];
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        const A = unique[i]!;
        const B = unique[j]!;
        const nd =
          A.normal[0] * B.normal[0] + A.normal[1] * B.normal[1] + A.normal[2] * B.normal[2];
        const und = Math.abs(nd);
        if (und > 0.999) continue;
        const na = nrm(A.vertex);
        const nb = nrm(B.vertex);
        if (Math.abs(na[0] * nb[0] + na[1] * nb[1] + na[2] * nb[2]) > 0.9) continue;
        const amount = clamp01((1 - und) * CURVATURE_CONTRAST);
        // Winding is unreliable: flip B so both normals point to the same side.
        const s = nd < 0 ? -1 : 1;
        const ax = A.normal[0];
        const ay = A.normal[1];
        const az = A.normal[2];
        const bx = B.normal[0] * s;
        const by = B.normal[1] * s;
        const bz = B.normal[2] * s;
        let nx = ax + bx;
        let ny = ay + by;
        let nz = az + bz;
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl;
        ny /= nl;
        nz /= nl;
        const mx = (bucket.ax + bucket.bx) * 0.5;
        const my = (bucket.ay + bucket.by) * 0.5;
        const mz = (bucket.az + bucket.bz) * 0.5;
        const ox = (A.opposite[0] + B.opposite[0]) * 0.5 - mx;
        const oy = (A.opposite[1] + B.opposite[1]) * 0.5 - my;
        const oz = (A.opposite[2] + B.opposite[2]) * 0.5 - mz;
        // Opposite points sit on the outward side of a valley, on the inward side of a ridge.
        const concave = ox * nx + oy * ny + oz * nz > 0;
        vote += concave ? -1 : 1;
        mag = Math.max(mag, amount);
        if (!faces.includes(A.face)) faces.push(A.face);
        if (!faces.includes(B.face)) faces.push(B.face);
      }
    }
    if (mag > 0 && faces.length > 0) {
      segs.push({
        ax: bucket.ax,
        ay: bucket.ay,
        az: bucket.az,
        bx: bucket.bx,
        by: bucket.by,
        bz: bucket.bz,
        faces,
        concavity: vote < 0 ? mag : 0,
        convexity: vote < 0 ? 0 : mag,
      });
    }
  }

  const cav = new Float32Array(pixels);
  const vex = new Float32Array(pixels);
  // World-space query: a texel takes the crease it actually sits next to,
  // including across a UV chart border.
  if (segs.length > 0) {
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    for (const seg of segs) {
      if (seg.ax < minX) minX = seg.ax;
      if (seg.bx < minX) minX = seg.bx;
      if (seg.ay < minY) minY = seg.ay;
      if (seg.by < minY) minY = seg.by;
      if (seg.az < minZ) minZ = seg.az;
      if (seg.bz < minZ) minZ = seg.bz;
    }
    const inv = 1 / EDGE_WIDTH;
    const segCells = new Map<number, number[]>();
    for (let si = 0; si < segs.length; si++) {
      const seg = segs[si]!;
      const span = Math.hypot(seg.bx - seg.ax, seg.by - seg.ay, seg.bz - seg.az);
      const steps = Math.max(1, Math.ceil(span / (EDGE_WIDTH * 0.5)));
      let prev = -1;
      for (let step = 0; step <= steps; step++) {
        const u = step / steps;
        const key = cellKey(
          Math.floor((seg.ax + (seg.bx - seg.ax) * u - minX) * inv),
          Math.floor((seg.ay + (seg.by - seg.ay) * u - minY) * inv),
          Math.floor((seg.az + (seg.bz - seg.az) * u - minZ) * inv)
        );
        if (key === prev) continue;
        prev = key;
        const list = segCells.get(key);
        if (list) list.push(si);
        else segCells.set(key, [si]);
      }
    }
    const edge2 = EDGE_WIDTH * EDGE_WIDTH;
    const seen = new Int32Array(segs.length);
    let seenId = 0;
    for (let id = 0; id < pixels; id++) {
      if (faceOf[id]! < 0) continue;
      const cx = Math.floor((posX[id]! - minX) * inv);
      const cy = Math.floor((posY[id]! - minY) * inv);
      const cz = Math.floor((posZ[id]! - minZ) * inv);
      seenId++;
      for (let ix = -1; ix <= 1; ix++) {
        for (let iy = -1; iy <= 1; iy++) {
          for (let iz = -1; iz <= 1; iz++) {
            const list = segCells.get(cellKey(cx + ix, cy + iy, cz + iz));
            if (!list) continue;
            for (const si of list) {
              if (seen[si] === seenId) continue;
              seen[si] = seenId;
              const seg = segs[si]!;
              const d2 = dist2ToSegment(
                posX[id]!,
                posY[id]!,
                posZ[id]!,
                seg.ax,
                seg.ay,
                seg.az,
                seg.bx,
                seg.by,
                seg.bz
              );
              if (d2 >= edge2) continue;
              let t = 1 - Math.sqrt(d2) / EDGE_WIDTH;
              t = t * t * (3 - 2 * t);
              if (seg.concavity > 0) cav[id] = Math.max(cav[id]!, t * seg.concavity);
              if (seg.convexity > 0) vex[id] = Math.max(vex[id]!, t * seg.convexity);
            }
          }
        }
      }
    }
  }
  // A texel is a valley or a ridge. Overlap reads as blotchy wear on the mesh.
  for (let id = 0; id < pixels; id++) {
    if (cav[id]! <= 0 || vex[id]! <= 0) continue;
    if (cav[id]! >= vex[id]!) vex[id] = 0;
    else cav[id] = 0;
  }

  const tris = buildTriangleGrid(vertices, indices, faceCount);
  const ao = new Float32Array(pixels).fill(1);
  const height = new Float32Array(pixels);
  const span = Math.max(tris.maxY - tris.minY, 1e-6);
  for (let f = 0; f < faceCount; f++) {
    const ids = facePixels[f]!;
    if (ids.length === 0) continue;
    const fo = f * 9;
    const e1x = tris.data[fo + 3]!;
    const e1y = tris.data[fo + 4]!;
    const e1z = tris.data[fo + 5]!;
    const e2x = tris.data[fo + 6]!;
    const e2y = tris.data[fo + 7]!;
    const e2z = tris.data[fo + 8]!;
    let gx = e1y * e2z - e1z * e2y;
    let gy = e1z * e2x - e1x * e2z;
    let gz = e1x * e2y - e1y * e2x;
    const gl = Math.hypot(gx, gy, gz);
    if (gl < 1e-12) continue;
    gx /= gl;
    gy /= gl;
    gz /= gl;
    // Winding is unreliable without BFC: pick the more open side once per face (the outside).
    const probes = [ids[0]!, ids[ids.length >> 1]!, ids[ids.length - 1]!];
    let upSum = 0;
    let downSum = 0;
    for (const id of probes) {
      upSum += traceOpenness(tris, f, posX[id]!, posY[id]!, posZ[id]!, gx, gy, gz, id);
      downSum += traceOpenness(tris, f, posX[id]!, posY[id]!, posZ[id]!, -gx, -gy, -gz, id);
    }
    const side = downSum > upSum ? -1 : 1;
    // Probes that nearly tie are a flipped thin face: the dark side is the cavity, not the shell.
    const ambiguous = Math.abs(upSum - downSum) < 0.12 * probes.length;
    for (const id of ids) {
      height[id] = clamp01((posY[id]! - tris.minY) / span);
      let sx = nrmX[id]!;
      let sy = nrmY[id]!;
      let sz = nrmZ[id]!;
      const sl = Math.hypot(sx, sy, sz) || 1;
      sx /= sl;
      sy /= sl;
      sz /= sl;
      if (sx * gx * side + sy * gy * side + sz * gz * side < 0) {
        sx = -sx;
        sy = -sy;
        sz = -sz;
      }
      const first = traceOpenness(tris, f, posX[id]!, posY[id]!, posZ[id]!, sx, sy, sz, id);
      if (!ambiguous || first > 0.92) {
        ao[id] = first;
        continue;
      }
      const other = traceOpenness(tris, f, posX[id]!, posY[id]!, posZ[id]!, -sx, -sy, -sz, id + 1);
      ao[id] = Math.max(first, other);
    }
  }
  blurWithinCharts(ao, faceOf, posX, posY, posZ, size, 2);

  const src = new Int32Array(pixels).fill(-1);
  for (let id = 0; id < pixels; id++) if (faceOf[id]! >= 0) src[id] = id;
  for (let pass = 0; pass < GUTTER_PX; pass++) {
    const next = src.slice();
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const id = y * size + x;
        if (src[id]! >= 0) continue;
        for (let k = 0; k < 8; k++) {
          const nx = x + NEIGHBOR_DX[k]!;
          const ny = y + NEIGHBOR_DY[k]!;
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
          const from = src[ny * size + nx]!;
          if (from >= 0) {
            next[id] = from;
            break;
          }
        }
      }
    }
    src.set(next);
  }

  for (let id = 0; id < pixels; id++) {
    const from = src[id]!;
    if (from < 0) continue;
    rgba[id * 4] = Math.round(clamp01(cav[from]!) * 255);
    rgba[id * 4 + 1] = Math.round(clamp01(vex[from]!) * 255);
    rgba[id * 4 + 2] = Math.round(clamp01(ao[from]!) * 255);
    rgba[id * 4 + 3] = Math.round(clamp01(height[from]!) * 255);
  }

  return { rgba, coverage, size };
}

const NEIGHBOR_DX = [1, -1, 0, 0, 1, -1, 1, -1];
const NEIGHBOR_DY = [0, 0, 1, -1, 1, 1, -1, -1];

type TriangleGrid = {
  /** Per face: v0 (3), e1 (3), e2 (3). */
  data: Float64Array;
  cells: Map<number, number[]>;
  minX: number;
  minY: number;
  minZ: number;
  maxY: number;
  stamp: Int32Array;
  stampId: number;
  candidates: number[];
};

function cellKey(ix: number, iy: number, iz: number): number {
  return ((ix + 1024) * 2048 + (iy + 1024)) * 2048 + (iz + 1024);
}

/** Uniform grid (cell = AO ray length) over front triangles. */
function buildTriangleGrid(
  vertices: Float32Array,
  indices: Uint32Array,
  faceCount: number
): TriangleGrid {
  const data = new Float64Array(faceCount * 9);
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxY = -Infinity;
  for (let f = 0; f < faceCount; f++) {
    const a = indices[f * 6]! * STRIDE;
    const b = indices[f * 6 + 1]! * STRIDE;
    const c = indices[f * 6 + 2]! * STRIDE;
    const o = f * 9;
    for (let k = 0; k < 3; k++) {
      data[o + k] = vertices[a + k]!;
      data[o + 3 + k] = vertices[b + k]! - vertices[a + k]!;
      data[o + 6 + k] = vertices[c + k]! - vertices[a + k]!;
    }
    for (const v of [a, b, c]) {
      minX = Math.min(minX, vertices[v]!);
      minY = Math.min(minY, vertices[v + 1]!);
      maxY = Math.max(maxY, vertices[v + 1]!);
      minZ = Math.min(minZ, vertices[v + 2]!);
    }
  }
  const inv = 1 / AO_RAY;
  const cells = new Map<number, number[]>();
  for (let f = 0; f < faceCount; f++) {
    const o = f * 9;
    const xs = [data[o]!, data[o]! + data[o + 3]!, data[o]! + data[o + 6]!];
    const ys = [data[o + 1]!, data[o + 1]! + data[o + 4]!, data[o + 1]! + data[o + 7]!];
    const zs = [data[o + 2]!, data[o + 2]! + data[o + 5]!, data[o + 2]! + data[o + 8]!];
    const x0 = Math.floor((Math.min(...xs) - minX) * inv);
    const x1 = Math.floor((Math.max(...xs) - minX) * inv);
    const y0 = Math.floor((Math.min(...ys) - minY) * inv);
    const y1 = Math.floor((Math.max(...ys) - minY) * inv);
    const z0 = Math.floor((Math.min(...zs) - minZ) * inv);
    const z1 = Math.floor((Math.max(...zs) - minZ) * inv);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iy = y0; iy <= y1; iy++) {
        for (let iz = z0; iz <= z1; iz++) {
          const key = cellKey(ix, iy, iz);
          const list = cells.get(key);
          if (list) list.push(f);
          else cells.set(key, [f]);
        }
      }
    }
  }
  return {
    data,
    cells,
    minX,
    minY,
    minZ,
    maxY,
    stamp: new Int32Array(faceCount).fill(-1),
    stampId: 0,
    candidates: [],
  };
}

/** Cosine-weighted hemisphere directions (z up), stratified on a spiral. */
const RAY_DIRS: number[] = (() => {
  const out: number[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < AO_RAYS; i++) {
    const r = Math.sqrt((i + 0.5) / AO_RAYS);
    const phi = i * golden;
    out.push(r * Math.cos(phi), r * Math.sin(phi), Math.sqrt(Math.max(0, 1 - r * r)));
  }
  return out;
})();

/**
 * Fraction of the hemisphere around the shading normal not blocked within AO_RAY.
 * Square falloff: a hit at the end of the ray barely darkens, a close hit does.
 */
function traceOpenness(
  grid: TriangleGrid,
  selfFace: number,
  px: number,
  py: number,
  pz: number,
  nx: number,
  ny: number,
  nz: number,
  seed: number
): number {
  const inv = 1 / AO_RAY;
  const cx = Math.floor((px - grid.minX) * inv);
  const cy = Math.floor((py - grid.minY) * inv);
  const cz = Math.floor((pz - grid.minZ) * inv);
  const cand = grid.candidates;
  cand.length = 0;
  const stampId = ++grid.stampId;
  for (let ix = -1; ix <= 1; ix++) {
    for (let iy = -1; iy <= 1; iy++) {
      for (let iz = -1; iz <= 1; iz++) {
        const list = grid.cells.get(cellKey(cx + ix, cy + iy, cz + iz));
        if (!list) continue;
        for (const f of list) {
          if (f === selfFace || grid.stamp[f] === stampId) continue;
          grid.stamp[f] = stampId;
          const o = f * 9;
          const d = grid.data;
          // Skip triangles entirely behind the tangent plane.
          const s0 = (d[o]! - px) * nx + (d[o + 1]! - py) * ny + (d[o + 2]! - pz) * nz;
          const s1 = s0 + d[o + 3]! * nx + d[o + 4]! * ny + d[o + 5]! * nz;
          const s2 = s0 + d[o + 6]! * nx + d[o + 7]! * ny + d[o + 8]! * nz;
          if (s0 <= 1e-6 && s1 <= 1e-6 && s2 <= 1e-6) continue;
          cand.push(f);
        }
      }
    }
  }
  if (cand.length === 0) return 1;

  // Tangent frame, rotated per texel so ray patterns don't band (the blur removes the noise).
  const ax = Math.abs(nx) < 0.9 ? 1 : 0;
  const ay = ax ? 0 : 1;
  let tx = ay * nz;
  let ty = -ax * nz;
  let tz = ax * ny - ay * nx;
  const tl = Math.hypot(tx, ty, tz) || 1;
  tx /= tl;
  ty /= tl;
  tz /= tl;
  const bx = ny * tz - nz * ty;
  const by = nz * tx - nx * tz;
  const bz = nx * ty - ny * tx;
  const rot = ((Math.imul(seed, 2654435761) >>> 0) / 4294967296) * Math.PI * 2;
  const cr = Math.cos(rot);
  const sr = Math.sin(rot);

  const ox = px + nx * RAY_BIAS;
  const oy = py + ny * RAY_BIAS;
  const oz = pz + nz * RAY_BIAS;
  const d = grid.data;
  let occ = 0;
  for (let r = 0; r < AO_RAYS; r++) {
    const lx = RAY_DIRS[r * 3]!;
    const ly = RAY_DIRS[r * 3 + 1]!;
    const lz = RAY_DIRS[r * 3 + 2]!;
    const u = lx * cr - ly * sr;
    const v = lx * sr + ly * cr;
    const dx = tx * u + bx * v + nx * lz;
    const dy = ty * u + by * v + ny * lz;
    const dz = tz * u + bz * v + nz * lz;
    let best = AO_RAY;
    for (const f of cand) {
      const o = f * 9;
      const e1x = d[o + 3]!;
      const e1y = d[o + 4]!;
      const e1z = d[o + 5]!;
      const e2x = d[o + 6]!;
      const e2y = d[o + 7]!;
      const e2z = d[o + 8]!;
      const qx = dy * e2z - dz * e2y;
      const qy = dz * e2x - dx * e2z;
      const qz = dx * e2y - dy * e2x;
      const det = e1x * qx + e1y * qy + e1z * qz;
      if (det > -1e-12 && det < 1e-12) continue;
      const invDet = 1 / det;
      const sx = ox - d[o]!;
      const sy = oy - d[o + 1]!;
      const sz = oz - d[o + 2]!;
      const bu = (sx * qx + sy * qy + sz * qz) * invDet;
      if (bu < 0 || bu > 1) continue;
      const rx = sy * e1z - sz * e1y;
      const ry = sz * e1x - sx * e1z;
      const rz = sx * e1y - sy * e1x;
      const bv = (dx * rx + dy * ry + dz * rz) * invDet;
      if (bv < 0 || bu + bv > 1) continue;
      const t = (e2x * rx + e2y * ry + e2z * rz) * invDet;
      if (t > 0 && t < best) best = t;
    }
    if (best < AO_RAY) {
      const u = 1 - best / AO_RAY;
      occ += u * u;
    }
  }
  return clamp01(1 - occ / AO_RAYS);
}

function blurWithinCharts(
  values: Float32Array,
  faceOf: Int32Array,
  posX: Float32Array,
  posY: Float32Array,
  posZ: Float32Array,
  size: number,
  passes: number
): void {
  const tmp = new Float32Array(values.length);
  const max2 = BLUR_WORLD_RADIUS * BLUR_WORLD_RADIUS;
  for (let p = 0; p < passes; p++) {
    tmp.set(values);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const id = y * size + x;
        if (faceOf[id]! < 0) continue;
        let sum = tmp[id]!;
        let n = 1;
        for (let k = 0; k < 8; k++) {
          const nx = x + NEIGHBOR_DX[k]!;
          const ny = y + NEIGHBOR_DY[k]!;
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
          const nid = ny * size + nx;
          if (faceOf[nid]! < 0) continue;
          const dx = posX[nid]! - posX[id]!;
          const dy = posY[nid]! - posY[id]!;
          const dz = posZ[nid]! - posZ[id]!;
          if (dx * dx + dy * dy + dz * dz > max2) continue;
          sum += tmp[nid]!;
          n++;
        }
        values[id] = sum / n;
      }
    }
  }
}
