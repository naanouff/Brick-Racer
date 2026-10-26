/**
 * @file staticBox.ts
 * @description Blockout helper: kinematic box with optional collider.
 */

import { groupForKind, MASK_ALL, type ColliderKind } from './collisionGroups';
import type { LevelEntity, Quat, Vec3 } from './levelTypes';

const IDENTITY: Quat = [0, 0, 0, 1];

export type StaticBoxOpts = {
  id: string;
  name?: string;
  /** World-space center. */
  center: Vec3;
  /** Full extents (world size / visual scale), not half-extents. */
  size: Vec3;
  materialId: string;
  meshId?: string;
  rotation?: Quat;
  /**
   * Collision role. Default `wall`. Use `none` or `collider: false` for visuals only.
   * Prefer `kind` over raw `collisionGroup`.
   */
  kind?: ColliderKind;
  /** @deprecated Prefer `kind`. */
  collisionGroup?: number;
  collider?: boolean;
  /**
   * Full collider extents when different from visual `size` (e.g. thicker walls).
   * Half-extents passed to W3DTS = colliderSize/2.
   */
  colliderSize?: Vec3;
  castShadow?: boolean;
  /** When false, keep collider/body but hide the box mesh (brick visuals elsewhere). */
  visible?: boolean;
  friction?: number;
};

/**
 * Creates a LevelEntity for a scaled unit cube (mesh `bo_cube` by default).
 * Collider half-extents = (colliderSize ?? size) / 2.
 */
export function spawnStaticBox(opts: StaticBoxOpts): LevelEntity {
  const {
    id,
    name = id,
    center,
    size,
    materialId,
    meshId = 'bo_cube',
    rotation = IDENTITY,
    kind = 'wall',
    collisionGroup: legacyGroup,
    collider = kind !== 'none',
    colliderSize,
    castShadow = false,
    visible = true,
    friction = 1,
  } = opts;

  const components: LevelEntity['components'] = [
    {
      type: 'renderable',
      meshId,
      materialId,
      castShadow,
      visible,
    },
    {
      type: 'rigidBody',
      mass: 0,
      useGravity: false,
      isKinematic: true,
      drag: 0,
      angularDrag: 0,
      restitution: 0,
      friction,
    },
  ];

  if (collider) {
    const full = colliderSize ?? size;
    const group = legacyGroup ?? groupForKind(kind) ?? groupForKind('wall')!;
    components.push({
      type: 'collider',
      shape: 'box',
      size: [full[0] * 0.5, full[1] * 0.5, full[2] * 0.5],
      collisionGroup: group,
      collisionMask: MASK_ALL,
    });
  }

  return {
    id,
    name,
    parentId: null,
    transform: {
      position: center,
      rotation,
      scale: size,
    },
    components,
  };
}

/** Yaw around Y (radians) → quaternion. */
export function quatYawY(yawRad: number): Quat {
  const h = yawRad * 0.5;
  return [0, Math.sin(h), 0, Math.cos(h)];
}

/** Pitch around X (radians) → quaternion. */
export function quatPitchX(pitchRad: number): Quat {
  const h = pitchRad * 0.5;
  return [Math.sin(h), 0, 0, Math.cos(h)];
}

/** Yaw then pitch (local X after yaw) for track-aligned ramps. */
export function quatYawPitch(yawRad: number, pitchRad: number): Quat {
  const y = quatYawY(yawRad);
  const p = quatPitchX(pitchRad);
  // q = yaw * pitch (apply pitch in yawed local frame)
  const x = y[0] * p[3] + y[3] * p[0] + y[1] * p[2] - y[2] * p[1];
  const yy = y[1] * p[3] + y[3] * p[1] + y[2] * p[0] - y[0] * p[2];
  const z = y[2] * p[3] + y[3] * p[2] + y[0] * p[1] - y[1] * p[0];
  const w = y[3] * p[3] - y[0] * p[0] - y[1] * p[1] - y[2] * p[2];
  return [x, yy, z, w];
}

/**
 * Center Y so the leading edge of a pitched slab is flush with y=0
 * (same formula as w3dts kartCircuit kickers).
 */
export function flushRampCenterY(halfLength: number, halfThickness: number, pitchRad: number): number {
  return halfLength * Math.sin(pitchRad) - halfThickness * Math.cos(pitchRad);
}
