/**
 * @file editorRay.ts
 * @description Screen → stud grid from camera viewProjection (ED5).
 */

import { mat4, vec3, vec4 } from 'gl-matrix';
import type { Engine } from '@naanouff/w3dts-core';
import { P, S } from '../../../hub/brick/brickUnits';
import { rotatedFootprint, type RotDeg } from '../../../hub/brick/manual/partFootprint';

export type StudHit = {
  /** Proposed brick min-corner studs (snapped). */
  sx: number;
  sz: number;
  world: [number, number, number];
};

/**
 * Unproject canvas client coords to a ray, intersect y = layerPy * P, snap to studs.
 * Footprint is centered under the hit.
 */
export function screenToStudHit(
  engine: Engine,
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  layerPy: number,
  partId: string,
  rot: RotDeg
): StudHit | null {
  const active = engine.getActiveCamera?.();
  const vp = active?.component?.viewProjectionMatrix;
  if (!vp) return null;

  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
  const ndcY = 1 - ((clientY - rect.top) / rect.height) * 2;

  const inv = mat4.create();
  if (!mat4.invert(inv, vp as mat4)) return null;

  const near = vec4.fromValues(ndcX, ndcY, 0, 1);
  const far = vec4.fromValues(ndcX, ndcY, 1, 1);
  vec4.transformMat4(near, near, inv);
  vec4.transformMat4(far, far, inv);
  if (Math.abs(near[3]) < 1e-8 || Math.abs(far[3]) < 1e-8) return null;
  const o = vec3.fromValues(near[0] / near[3], near[1] / near[3], near[2] / near[3]);
  const t = vec3.fromValues(far[0] / far[3], far[1] / far[3], far[2] / far[3]);
  const dir = vec3.sub(vec3.create(), t, o);
  if (Math.abs(dir[1]) < 1e-8) return null;

  const planeY = layerPy * P;
  const k = (planeY - o[1]) / dir[1];
  if (k < 0) return null;
  const hitX = o[0] + dir[0] * k;
  const hitZ = o[2] + dir[2] * k;

  const [fx, , fz] = rotatedFootprint(partId, rot);
  const centerStudX = hitX / S;
  const centerStudZ = hitZ / S;
  const sx = Math.round(centerStudX - fx * 0.5);
  const sz = Math.round(centerStudZ - fz * 0.5);

  return {
    sx,
    sz,
    world: [(sx + fx * 0.5) * S, planeY + 0.05, (sz + fz * 0.5) * S],
  };
}
