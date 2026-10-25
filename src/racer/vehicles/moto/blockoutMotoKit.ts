/**
 * @file blockoutMotoKit.ts
 * @description ~2 m blockout moto (2-wheel suspension + arcade when playable).
 */

import { MASK_CHASSIS } from '../../levels/shared/collisionGroups';
import { SUSPENSION_ONLY_VEHICLE } from '../kart/arcade/arcadeKartProfile';
import type { LevelEntity, Quat, Vec3 } from '../../levels/shared/levelTypes';
import { quatYawY } from '../../levels/shared/staticBox';

export const BLOCKOUT_MOTO_SPAWN_Y = 0.5;
export const MOTO_WHEEL_RADIUS = 0.32;

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

function makeMotoWheels(): Array<Record<string, unknown>> {
  const base = {
    radius: MOTO_WHEEL_RADIUS,
    restLength: 0.3,
    travel: 0.2,
    stiffness: 380,
    damping: 40,
    mu: 2.1,
    longitudinalStiffness: 0.02,
    corneringStiffness: 2,
  };
  const hz = 0.7;
  return [
    { id: 'front', hardpoint: [0, 0, hz], steered: true, driven: false, ...base },
    { id: 'rear', hardpoint: [0, 0, -hz], steered: false, driven: true, ...base },
  ];
}

const VISUALS = (parent: string): LevelEntity[] => {
  const wr = MOTO_WHEEL_RADIUS / 0.5;
  return [
    childRenderable('MotoBody', parent, 'bo_cube', 'BM_Body', [0, 0.28, -0.05], [0.28, 0.22, 1.35]),
    childRenderable('MotoTank', parent, 'bo_cube', 'BM_Accent', [0, 0.42, 0.15], [0.32, 0.16, 0.55]),
    childRenderable('MotoSeat', parent, 'bo_cube', 'BM_Seat', [0, 0.4, -0.45], [0.26, 0.1, 0.5]),
    childRenderable('MotoFork', parent, 'bo_cube', 'BM_Accent', [0, 0.35, 0.65], [0.12, 0.45, 0.12]),
    childRenderable('MotoBars', parent, 'bo_cube', 'BM_Accent', [0, 0.62, 0.55], [0.55, 0.06, 0.08]),
    childRenderable('MotoDriver', parent, 'bo_capsule', 'BK_Driver', [0, 0.72, -0.2], [0.7, 0.7, 0.7]),
    childRenderable('MotoWheel-front', parent, 'bo_cyl', 'BK_Wheel', [0, 0, 0.7], [wr, 0.16, wr]),
    childRenderable('MotoWheel-rear', parent, 'bo_cyl', 'BK_Wheel', [0, 0, -0.7], [wr, 0.18, wr]),
  ];
};

/**
 * Playable moto (VehicleComponent + arcade script) or parked display prop.
 */
export function createBlockoutMotoEntities(opts: {
  position: Vec3;
  yawY?: number;
  playable?: boolean;
  /** When false, the capsule driver is hidden. Default true. */
  showDriver?: boolean;
}): LevelEntity[] {
  const yaw = quatYawY(opts.yawY ?? 0);
  const playable = opts.playable ?? false;
  const id = playable ? 'MotoChassis' : 'MotoDisplay';

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
            mass: 8,
            useGravity: true,
            isKinematic: false,
            drag: 0.03,
            angularDrag: 0.3,
            restitution: 0,
            friction: 0.14,
          },
          {
            type: 'collider',
            shape: 'box',
            size: [0.22, 0.2, 0.75],
            offset: [0, 0.2, 0],
            collisionGroup: 1,
            collisionMask: MASK_CHASSIS,
          },
          {
            type: 'vehicle',
            ...SUSPENSION_ONLY_VEHICLE,
            antiRollStiffness: 0,
            antiWheelie: 0.8,
            wheels: makeMotoWheels(),
          },
          { type: 'scriptBinding', scriptId: 'kart_drive_arcade' },
        ]
      : [],
  };

  const entities: LevelEntity[] = [chassis, ...VISUALS(id)];
  if (opts.showDriver === false) {
    const driver = entities.find((e) => e.id === 'MotoDriver');
    const rend = driver?.components.find((c) => c.type === 'renderable');
    if (rend && rend.type === 'renderable') rend.visible = false;
  }

  if (playable) {
    entities.push({
      id: 'MotoChaseCamera',
      name: 'MotoChaseCamera',
      parentId: null,
      transform: {
        position: [opts.position[0], opts.position[1] + 2.0, opts.position[2] - 5.0],
        rotation: [0, 0, 0, 1],
        scale: [1, 1, 1],
      },
      components: [
        {
          type: 'camera',
          fov: 1.05,
          near: 0.25,
          far: 400,
          isPrimary: true,
          isMain: true,
          firstPersonEyeOffsetY: 0,
        },
        {
          type: 'cameraController',
          mode: 'chase',
          applyOn: 'play',
          chaseTargetEntityId: 'MotoChassis',
          chaseDistance: 6.5,
          chaseHeight: 2.1,
          chaseLookAhead: 2.0,
          chaseLookHeight: 0.5,
          chaseFocusSmoothXZ: 0,
          chaseFocusSmoothY: 0,
          chaseYawSmooth: 0.18,
        },
      ],
    });
  }

  return entities;
}
