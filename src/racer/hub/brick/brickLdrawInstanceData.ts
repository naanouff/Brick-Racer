/**
 * @file brickLdrawInstanceData.ts
 * @description Pack BrickPose lists for grounded LDraw meshes (scale 1, bottom at grid).
 */

import { mat4, quat, vec3 } from 'gl-matrix';
import { BRICK_INSTANCE_STRIDE_F } from './brickInstanceData';
import { partSizeMeters, resolvePartId, type BrickPose } from './brickCatalog';

/**
 * Dishes used as fountain bowls: LDraw opens downward; flip 180° about X so the
 * concave side faces up (same as the hand-authored fountain LDraw path).
 */
const INVERTED_DISH_IDS = new Set(['3960', '4740']);

const _mat = mat4.create();
const _inv = mat4.create();
const _q = quat.create();
const _t = vec3.create();
const _s = vec3.fromValues(1, 1, 1);

export function isInvertedDishPart(partId: string): boolean {
  const id = resolvePartId(partId) ?? partId;
  return INVERTED_DISH_IDS.has(id);
}

/**
 * Pack instance buffer for grounded (`ground-center`) LDraw meshes.
 * BrickPose.position is the catalog AABB centre; mesh origin is bottom-centre.
 */
export function packLdrawInstanceData(poses: readonly BrickPose[]): Float32Array {
  const data = new Float32Array(poses.length * BRICK_INSTANCE_STRIDE_F);
  for (let i = 0; i < poses.length; i++) {
    const pose = poses[i]!;
    const [, sy] = partSizeMeters(pose.partId);
    const yaw = pose.yaw ?? 0;
    const invert = isInvertedDishPart(pose.partId);

    quat.identity(_q);
    if (invert) {
      // 180° X then yaw Y — bowl opens upward; entity sits on the AABB top.
      quat.rotateX(_q, _q, Math.PI);
      quat.rotateY(_q, _q, yaw);
      vec3.set(_t, pose.position[0], pose.position[1] + sy * 0.5, pose.position[2]);
    } else {
      quat.rotateY(_q, _q, yaw);
      vec3.set(_t, pose.position[0], pose.position[1] - sy * 0.5, pose.position[2]);
    }

    mat4.fromRotationTranslationScale(_mat, _q, _t, _s);
    mat4.invert(_inv, _mat);
    mat4.transpose(_inv, _inv);

    const off = i * BRICK_INSTANCE_STRIDE_F;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        data[off + r * 4 + c] = _mat[r * 4 + c]!;
        data[off + 16 + r * 4 + c] = _inv[r * 4 + c]!;
      }
    }
    data[off + 32] = 1;
    data[off + 33] = 1;
    data[off + 34] = 1;
    data[off + 35] = 1;
  }
  return data;
}
