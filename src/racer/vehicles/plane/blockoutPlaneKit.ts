/**
 * @file blockoutPlaneKit.ts
 * @description Blockout light plane (arcade flight when playable).
 */

import type { LevelEntity, Quat, Vec3 } from '../../levels/shared/levelTypes';
import { quatYawY } from '../../levels/shared/staticBox';

export const BLOCKOUT_PLANE_SPAWN_Y = 1.2;

function childRenderable(
  id: string,
  parentId: string,
  meshId: string,
  materialId: string,
  position: Vec3,
  scale: Vec3,
  rotation: Quat = [0, 0, 0, 1]
): LevelEntity {
  return {
    id,
    name: id,
    parentId,
    transform: { position, rotation, scale },
    components: [{ type: 'renderable', meshId, materialId, castShadow: false }],
  };
}

const VISUALS = (parent: string): LevelEntity[] => [
  childRenderable('PlaneFuselage', parent, 'bo_cube', 'BP_Body', [0, 0.15, 0], [0.45, 0.35, 2.4]),
  childRenderable('PlaneNose', parent, 'bo_cube', 'BP_Accent', [0, 0.12, 1.15], [0.35, 0.28, 0.45]),
  childRenderable('PlaneWing', parent, 'bo_cube', 'BP_Wing', [0, 0.18, 0.1], [4.0, 0.08, 0.7]),
  childRenderable('PlaneTail', parent, 'bo_cube', 'BP_Wing', [0, 0.45, -1.05], [0.08, 0.55, 0.4]),
  childRenderable('PlaneStab', parent, 'bo_cube', 'BP_Wing', [0, 0.35, -1.1], [1.2, 0.06, 0.35]),
  childRenderable('PlaneCockpit', parent, 'bo_capsule', 'BK_Driver', [0, 0.4, 0.35], [0.65, 0.55, 0.65]),
];

/**
 * Playable plane (rigid body + arcade flight) or parked display prop.
 */
export function createBlockoutPlaneEntities(opts: {
  position: Vec3;
  yawY?: number;
  playable?: boolean;
}): LevelEntity[] {
  const yaw = quatYawY(opts.yawY ?? 0);
  const playable = opts.playable ?? false;
  const id = playable ? 'PlaneChassis' : 'PlaneDisplay';

  const chassis: LevelEntity = {
    id,
    name: id,
    parentId: null,
    transform: {
      position: [...opts.position],
      rotation: [...yaw],
      scale: [1, 1, 1],
    },
    components: playable
      ? [
          {
            type: 'rigidBody',
            mass: 6,
            useGravity: true,
            isKinematic: false,
            drag: 0.04,
            angularDrag: 0.5,
            restitution: 0,
            friction: 0.2,
          },
          {
            type: 'collider',
            shape: 'box',
            size: [0.9, 0.25, 1.2],
            offset: [0, 0.15, 0],
            collisionGroup: 1,
            collisionMask: 12,
          },
        ]
      : [],
  };

  const entities: LevelEntity[] = [chassis, ...VISUALS(id)];

  if (playable) {
    entities.push({
      id: 'PlaneChaseCamera',
      name: 'PlaneChaseCamera',
      parentId: null,
      transform: {
        position: [opts.position[0], opts.position[1] + 3.5, opts.position[2] - 9],
        rotation: [0, 0, 0, 1],
        scale: [1, 1, 1],
      },
      components: [
        {
          type: 'camera',
          fov: 1.1,
          near: 0.3,
          far: 500,
          isPrimary: true,
          isMain: true,
          firstPersonEyeOffsetY: 0,
        },
        {
          type: 'cameraController',
          mode: 'chase',
          applyOn: 'play',
          chaseTargetEntityId: 'PlaneChassis',
          chaseDistance: 11,
          chaseHeight: 3.2,
          chaseLookAhead: 4,
          chaseLookHeight: 0.4,
          chaseFocusSmoothXZ: 0,
          chaseFocusSmoothY: 0,
          chaseYawSmooth: 0.22,
        },
      ],
    });
  }

  return entities;
}
