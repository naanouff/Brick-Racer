/**
 * @file brickInstanceData.ts
 * @description Pack BrickPose lists into W3DTS InstancedMesh stride (36 floats).
 */

import { mat4, quat, vec3 } from 'gl-matrix';
import { partSizeMeters, type BrickPose } from './brickCatalog';

/** model(16) + inverseTranspose(16) + color(4) — matches BuiltInPipelineFactory. */
export const BRICK_INSTANCE_STRIDE_F = 36;

const _mat = mat4.create();
const _inv = mat4.create();
const _q = quat.create();
const _t = vec3.create();
const _s = vec3.create();

/**
 * Pack instance buffer for one batch (same part size for all poses).
 * Color channel defaults to white (material tint carries hue).
 */
export function packBrickInstanceData(poses: readonly BrickPose[]): Float32Array {
  const data = new Float32Array(poses.length * BRICK_INSTANCE_STRIDE_F);
  for (let i = 0; i < poses.length; i++) {
    const pose = poses[i]!;
    const [sx, sy, sz] = partSizeMeters(pose.partId);
    const yaw = pose.yaw ?? 0;
    quat.identity(_q);
    quat.rotateY(_q, _q, yaw);
    vec3.set(_t, pose.position[0], pose.position[1], pose.position[2]);
    vec3.set(_s, sx, sy, sz);
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
