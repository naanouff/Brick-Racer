/**
 * @file mcpMacros.ts
 * @description Pure macros → McpBrickSpec[] for brick-lab MCP (BA2).
 *
 * Ring/disc use 1×1 (or preferred part) stud rasterization. Full 4×4 macaroni
 * AABB still fills the quadrant — use thin rim + interior fill, not hollow macaroni.
 */

import { BRICK_CATALOG, partFootprintFromCatalog } from '../../../hub/brick/catalog';
import { isBrickPartId } from '../../../hub/brick/brickCatalog';
import { rotatedFootprint, type RotDeg } from '../../../hub/brick/manual/partFootprint';

export type Vec3 = [number, number, number];

export type MacroBrickSpec = {
  part: string;
  color: string;
  at: Vec3;
  rot?: RotDeg;
};

function isRot(r: number): r is RotDeg {
  return r === 0 || r === 90 || r === 180 || r === 270;
}

/** Greedy plate fill of inclusive stud rectangle on one plate layer. */
export function macroFillRect(opts: {
  min: Vec3;
  max: Vec3;
  color: string;
  /** Prefer this part; otherwise greedy plates by area. */
  part?: string;
}): MacroBrickSpec[] {
  const [x0, y0, z0] = opts.min;
  const [x1, y1, z1] = opts.max;
  if (x1 < x0 || y1 < y0 || z1 < z0) return [];

  const out: MacroBrickSpec[] = [];
  for (let py = y0; py <= y1; py++) {
    const need = new Set<string>();
    for (let sx = x0; sx <= x1; sx++) {
      for (let sz = z0; sz <= z1; sz++) need.add(`${sx},${sz}`);
    }
    while (need.size > 0) {
      const first = need.values().next().value as string;
      const [sx, sz] = first.split(',').map(Number) as [number, number];
      const placed = placeLargest(need, sx, py, sz, opts.color, opts.part);
      if (!placed) {
        need.delete(first);
        continue;
      }
      out.push(placed.spec);
      for (const c of placed.cells) need.delete(c);
    }
  }
  return out;
}

function placeLargest(
  need: Set<string>,
  sx: number,
  py: number,
  sz: number,
  color: string,
  preferred?: string
): { spec: MacroBrickSpec; cells: string[] } | null {
  const candidates =
    preferred && isBrickPartId(preferred) ? [preferred] : plateIdsByAreaDesc();

  for (const part of candidates) {
    for (const rot of [0, 90, 180, 270] as RotDeg[]) {
      const [fx, fy, fz] = rotatedFootprint(part, rot);
      if (preferred !== part && fy !== 1) continue; // greedy fill uses 1-plate parts

      const cells: string[] = [];
      let ok = true;
      for (let x = 0; x < fx && ok; x++) {
        for (let z = 0; z < fz && ok; z++) {
          const key = `${sx + x},${sz + z}`;
          if (!need.has(key)) ok = false;
          else cells.push(key);
        }
      }
      if (!ok) continue;
      const spec: MacroBrickSpec = { part, color, at: [sx, py, sz] };
      if (rot !== 0) spec.rot = rot;
      return { spec, cells };
    }
  }
  return null;
}

function plateIdsByAreaDesc(): string[] {
  return BRICK_CATALOG.parts
    .filter((p) => p.category === 'plate' || p.category === 'tile' || p.category === 'round')
    .filter((p) => p.footprint[1] === 1)
    .map((p) => ({ id: p.id, area: p.footprint[0] * p.footprint[2] }))
    .sort((a, b) => b.area - a.area || a.id.localeCompare(b.id))
    .map((p) => p.id);
}

/** Axis-aligned wall, thickness 1 stud, height in plates, running bond. */
export function macroWall(opts: {
  from: Vec3;
  /** Inclusive end on the long axis; Y = top plate inclusive. */
  to: Vec3;
  color: string;
  /** Brick part for courses (default 3005 1×1). */
  part?: string;
}): MacroBrickSpec[] {
  const part = opts.part ?? '3005';
  if (!isBrickPartId(part)) return [];
  const [fx0, fy] = partFootprintFromCatalog(part);
  const [x0, y0, z0] = opts.from;
  const [x1, y1, z1] = opts.to;
  const alongX = z0 === z1;
  const alongZ = x0 === x1;
  if (!alongX && !alongZ) return [];

  const out: MacroBrickSpec[] = [];
  const yTop = Math.max(y0, y1);
  const yBot = Math.min(y0, y1);

  if (alongX) {
    // Length along X → yaw 90 for 1×N bricks (footprint becomes N×1).
    const rot: RotDeg = 90;
    const [pfx] = rotatedFootprint(part, rot);
    const z = z0;
    const xa = Math.min(x0, x1);
    const xb = Math.max(x0, x1);
    let course = 0;
    for (let py = yBot; py <= yTop; py += fy) {
      if (py + fy - 1 > yTop) break;
      const offset = course % 2 === 1 ? 1 : 0;
      for (let sx = xa + offset; sx <= xb; sx += Math.max(1, pfx)) {
        if (sx > xb) break;
        if (sx + pfx - 1 > xb) {
          if (isBrickPartId('3005') && sx <= xb) {
            out.push({ part: '3005', color: opts.color, at: [sx, py, z] });
          }
          break;
        }
        const spec: MacroBrickSpec = { part, color: opts.color, at: [sx, py, z], rot };
        out.push(spec);
      }
      course++;
    }
  } else {
    // Length along Z → yaw 0 for 1×N bricks.
    const rot: RotDeg = 0;
    const [, , pfz] = rotatedFootprint(part, rot);
    const x = x0;
    const za = Math.min(z0, z1);
    const zb = Math.max(z0, z1);
    let course = 0;
    for (let py = yBot; py <= yTop; py += fy) {
      if (py + fy - 1 > yTop) break;
      const offset = course % 2 === 1 ? 1 : 0;
      for (let sz = za + offset; sz <= zb; sz += Math.max(1, pfz || fx0)) {
        if (sz > zb) break;
        if (sz + pfz - 1 > zb) {
          if (isBrickPartId('3005') && sz <= zb) {
            out.push({ part: '3005', color: opts.color, at: [x, py, sz] });
          }
          break;
        }
        out.push({ part, color: opts.color, at: [x, py, sz] });
      }
      course++;
    }
  }
  return out;
}

/**
 * Rasterized ring (hollow) or disc (filled) at integer studs.
 * Default part 6141 (1×1 round plate). Height = number of plate layers.
 */
export function macroRingOrDisc(opts: {
  kind: 'ring' | 'disc';
  center: [number, number];
  radius: number;
  y: number;
  height?: number;
  color: string;
  part?: string;
}): MacroBrickSpec[] {
  const part = opts.part ?? '6141';
  if (!isBrickPartId(part)) return [];
  const [, fy] = partFootprintFromCatalog(part);
  const h = Math.max(1, opts.height ?? 1);
  const [cx, cz] = opts.center;
  const r = opts.radius;
  const rOuter = r;
  const rInner = opts.kind === 'ring' ? Math.max(0, r - 1) : -1;

  const cells: [number, number][] = [];
  const min = Math.floor(cx - rOuter);
  const max = Math.ceil(cx + rOuter);
  for (let sx = min; sx <= max; sx++) {
    for (let sz = min; sz <= max; sz++) {
      const dx = sx + 0.5 - cx;
      const dz = sz + 0.5 - cz;
      const d = Math.hypot(dx, dz);
      if (opts.kind === 'disc') {
        if (d <= rOuter + 1e-6) cells.push([sx, sz]);
      } else if (d <= rOuter + 1e-6 && d >= rInner - 1e-6) {
        cells.push([sx, sz]);
      }
    }
  }

  const out: MacroBrickSpec[] = [];
  for (let layer = 0; layer < h; layer++) {
    const py = opts.y + layer * fy;
    for (const [sx, sz] of cells) {
      out.push({ part, color: opts.color, at: [sx, py, sz] });
    }
  }
  return out;
}

/** Stack `count` copies of part upward from `at` (each step = footprint Y). */
export function macroColumn(opts: {
  part: string;
  color: string;
  at: Vec3;
  count: number;
  rot?: RotDeg;
}): MacroBrickSpec[] {
  if (!isBrickPartId(opts.part) || opts.count < 1) return [];
  const rot = opts.rot ?? 0;
  if (!isRot(rot)) return [];
  const [, fy] = rotatedFootprint(opts.part, rot);
  const out: MacroBrickSpec[] = [];
  for (let i = 0; i < opts.count; i++) {
    const spec: MacroBrickSpec = {
      part: opts.part,
      color: opts.color,
      at: [opts.at[0], opts.at[1] + i * fy, opts.at[2]],
    };
    if (rot !== 0) spec.rot = rot;
    out.push(spec);
  }
  return out;
}
