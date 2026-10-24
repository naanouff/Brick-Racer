/**
 * @file kartKit.ts
 * @description Sandbox gproc kart reuse + native 2 m blockout kart (BO1g).
 */

import {
  BLOCKOUT_WHEEL_RADIUS,
  makeBlockoutWheels,
  SUSPENSION_ONLY_VEHICLE,
} from '../../vehicles/kart/arcade/arcadeKartProfile';
import { sandboxKartSpec } from '../sandboxKart/sandboxKartSpec';
import type {
  GraphRef,
  LevelComponent,
  LevelEntity,
  MaterialSpec,
  PrimitiveSpec,
  Quat,
  Vec3,
} from './levelTypes';
import { quatYawY } from './staticBox';

const KART_ID_PREFIXES = ['Kart'] as const;

/** @deprecated Prefer createBlockoutKartEntities for race/city. Kept for sandbox scale tests. */
export const KART_SCALE = 2.5;

/** @deprecated Chase framing for scaled gproc kart. */
export const CHASE_FRAME_BOOST = 1.55;

/** Chassis resting height for blockout kart (wheel rest + radius ≈ ground contact). */
export const BLOCKOUT_KART_SPAWN_Y = 0.55;

function isKartEntity(id: string): boolean {
  return KART_ID_PREFIXES.some((p) => id.startsWith(p));
}

/** Graphs required by the sandbox (gproc) player kart. */
export function kartGraphRefs(): {
  shaderGraphs: GraphRef[];
  geometryGraphs: GraphRef[];
  scriptGraphs: GraphRef[];
} {
  return {
    shaderGraphs: sandboxKartSpec.shaderGraphs.map((g) => ({ ...g })),
    geometryGraphs: sandboxKartSpec.geometryGraphs.map((g) => ({ ...g })),
    scriptGraphs: sandboxKartSpec.scriptGraphs.map((g) => ({ ...g })),
  };
}

/** Script + no gproc for blockout arcade kart. */
export function blockoutKartGraphRefs(): {
  shaderGraphs: GraphRef[];
  geometryGraphs: GraphRef[];
  scriptGraphs: GraphRef[];
} {
  return {
    shaderGraphs: [],
    geometryGraphs: [],
    scriptGraphs: [{ id: 'kart_drive_arcade', url: '/script-graphs/kart-drive-arcade.json' }],
  };
}

export function kartMaterials(): Record<string, MaterialSpec> {
  const out: Record<string, MaterialSpec> = {};
  for (const id of [
    'LK_Abs',
    'LK_WheelRim',
    'LK_WheelTire',
    'LK_Bracket',
    'LK_Black',
    'LK_Yellow',
    'LK_Glass',
    'LK_Blue',
    'LK_Skin',
    'LK_Hair',
    'LK_Grey',
  ]) {
    if (sandboxKartSpec.materials[id]) out[id] = structuredClone(sandboxKartSpec.materials[id]);
  }
  return out;
}

export function kartPrimitives(): Record<string, PrimitiveSpec> {
  const out: Record<string, PrimitiveSpec> = {};
  for (const [id, spec] of Object.entries(sandboxKartSpec.primitives)) {
    if (id.startsWith('lk_')) out[id] = structuredClone(spec);
  }
  return out;
}

export type KartSpawnOpts = {
  position: Vec3;
  yawY?: number;
  scale?: number;
};

function scaleVec3(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

function scaleComponent(comp: LevelComponent, s: number): LevelComponent {
  if (comp.type === 'collider' && comp.size) {
    return {
      ...comp,
      size: scaleVec3(comp.size, s),
      offset: comp.offset ? scaleVec3(comp.offset, s) : comp.offset,
      radius: typeof comp.radius === 'number' ? comp.radius * s : comp.radius,
    };
  }
  if (comp.type === 'vehicle') {
    const sqrtS = Math.sqrt(s);
    return {
      ...comp,
      maxSpeed: typeof comp.maxSpeed === 'number' ? comp.maxSpeed * s : comp.maxSpeed,
      driveTorque: typeof comp.driveTorque === 'number' ? comp.driveTorque * s * s : comp.driveTorque,
      brakeTorque: typeof comp.brakeTorque === 'number' ? comp.brakeTorque * s * s : comp.brakeTorque,
      wheels: Array.isArray(comp.wheels)
        ? comp.wheels.map((w) => {
            const wheel = { ...w } as Record<string, unknown>;
            if (Array.isArray(wheel.hardpoint) && wheel.hardpoint.length >= 3) {
              wheel.hardpoint = scaleVec3(wheel.hardpoint as Vec3, s);
            }
            for (const key of ['radius', 'restLength', 'travel'] as const) {
              if (typeof wheel[key] === 'number') wheel[key] = (wheel[key] as number) * s;
            }
            if (typeof wheel.stiffness === 'number') wheel.stiffness = wheel.stiffness / s;
            if (typeof wheel.damping === 'number') wheel.damping = wheel.damping / sqrtS;
            return wheel;
          })
        : comp.wheels,
    };
  }
  if (comp.type === 'cameraController') {
    const frame = s * CHASE_FRAME_BOOST;
    return {
      ...comp,
      chaseDistance:
        typeof comp.chaseDistance === 'number' ? comp.chaseDistance * frame : comp.chaseDistance,
      chaseHeight:
        typeof comp.chaseHeight === 'number' ? comp.chaseHeight * frame : comp.chaseHeight,
      chaseLookAhead:
        typeof comp.chaseLookAhead === 'number' ? comp.chaseLookAhead * frame : comp.chaseLookAhead,
      chaseLookHeight:
        typeof comp.chaseLookHeight === 'number'
          ? comp.chaseLookHeight * frame
          : comp.chaseLookHeight,
    };
  }
  if (comp.type === 'camera' && typeof comp.fov === 'number' && s > 1) {
    return { ...comp, fov: Math.min(comp.fov * 1.12, 1.15) };
  }
  return comp;
}

export function scaleKartEntities(entities: LevelEntity[], s: number): LevelEntity[] {
  if (s === 1) return entities;
  return entities.map((e) => {
    const isCamera = e.id === 'KartChaseCamera';
    return {
      ...e,
      transform: {
        ...e.transform,
        position:
          e.id === 'KartChassis' || isCamera
            ? [...e.transform.position]
            : scaleVec3(e.transform.position, s),
        scale: isCamera ? [...e.transform.scale] : scaleVec3(e.transform.scale, s),
      },
      components: e.components.map((c) => scaleComponent(c, s)),
    };
  });
}

/**
 * Clones Kart* entities from sandboxKartSpec (gproc micro-kart).
 */
export function createPlayerKartEntities(opts: KartSpawnOpts): LevelEntity[] {
  const yaw: Quat = quatYawY(opts.yawY ?? 0);
  const s = opts.scale ?? 1;
  let entities = sandboxKartSpec.entities
    .filter((e) => isKartEntity(e.id))
    .map((e) => structuredClone(e) as LevelEntity);

  entities = scaleKartEntities(entities, s);

  for (const e of entities) {
    if (e.id === 'KartChassis') {
      e.transform.position = [...opts.position];
      e.transform.rotation = [...yaw];
    }
    if (e.id === 'KartChaseCamera') {
      const frame = s * (s > 1 ? CHASE_FRAME_BOOST : 1);
      e.transform.position = [
        opts.position[0],
        opts.position[1] + 0.8 * frame,
        opts.position[2] - 1.4 * frame,
      ];
    }
  }
  return entities;
}

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
    components: [
      {
        type: 'renderable',
        meshId,
        materialId,
        castShadow: false,
      },
    ],
  };
}

/**
 * Native ~2 m blockout kart (no gproc, no scale hack). Wheel mesh radius = physics radius.
 * Cylinder mesh: radius 0.5 → scale xz = radius/0.5; height 1 → scale y = width.
 */
export function createBlockoutKartEntities(opts: {
  position: Vec3;
  yawY?: number;
  /** When false, parked display prop (no physics / camera). Default true. */
  playable?: boolean;
}): LevelEntity[] {
  const yaw = quatYawY(opts.yawY ?? 0);
  const playable = opts.playable ?? true;
  const wheelR = BLOCKOUT_WHEEL_RADIUS;
  const wheelScaleXZ = wheelR / 0.5; // 0.5
  const wheelWidth = 0.22;
  const hardpoints: Array<{ id: string; x: number; z: number }> = [
    { id: 'fl', x: -0.62, z: 0.72 },
    { id: 'fr', x: 0.62, z: 0.72 },
    { id: 'rl', x: -0.62, z: -0.68 },
    { id: 'rr', x: 0.62, z: -0.68 },
  ];
  const rootId = playable ? 'KartChassis' : 'KartDisplay';

  const chassis: LevelEntity = {
    id: rootId,
    name: rootId,
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
            mass: 10,
            useGravity: true,
            isKinematic: false,
            drag: 0.02,
            angularDrag: 0.25,
            restitution: 0,
            friction: 0.12,
          },
          {
            type: 'collider',
            shape: 'box',
            size: [0.65, 0.18, 0.95],
            offset: [0, 0.12, 0],
            collisionGroup: 1,
            collisionMask: 12,
          },
          {
            type: 'vehicle',
            ...SUSPENSION_ONLY_VEHICLE,
            wheels: makeBlockoutWheels(),
          },
          {
            type: 'scriptBinding',
            scriptId: 'kart_drive_arcade',
          },
        ]
      : [],
  };

  const body = childRenderable(
    playable ? 'KartBody' : 'KartDisplayBody',
    rootId,
    'bo_cube',
    'BK_Body',
    [0, 0.22, 0.05],
    [1.2, 0.28, 1.7]
  );
  const nose = childRenderable(
    playable ? 'KartNose' : 'KartDisplayNose',
    rootId,
    'bo_cube',
    'BK_Body',
    [0, 0.18, 0.85],
    [0.9, 0.18, 0.45]
  );
  const wing = childRenderable(
    playable ? 'KartWing' : 'KartDisplayWing',
    rootId,
    'bo_cube',
    'BK_Wing',
    [0, 0.48, -0.85],
    [1.35, 0.08, 0.35]
  );
  const driver = childRenderable(
    playable ? 'KartDriver' : 'KartDisplayDriver',
    rootId,
    'bo_capsule',
    'BK_Driver',
    [0, 0.55, -0.1],
    [0.85, 0.85, 0.85]
  );

  const wheels = hardpoints.map((hp) =>
    childRenderable(
      playable ? `KartWheel-${hp.id}` : `KartDisplayWheel-${hp.id}`,
      rootId,
      'bo_cyl',
      'BK_Wheel',
      [hp.x, 0, hp.z],
      [wheelScaleXZ, wheelWidth, wheelScaleXZ]
    )
  );

  const entities: LevelEntity[] = [chassis, body, nose, wing, driver, ...wheels];

  if (playable) {
    entities.push({
      id: 'KartChaseCamera',
      name: 'KartChaseCamera',
      parentId: null,
      transform: {
        position: [opts.position[0], opts.position[1] + 2.2, opts.position[2] - 5.5],
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
          chaseTargetEntityId: 'KartChassis',
          chaseDistance: 7.2,
          chaseHeight: 2.4,
          chaseLookAhead: 2.2,
          chaseLookHeight: 0.55,
          chaseFocusSmoothXZ: 0,
          chaseFocusSmoothY: 0,
          chaseYawSmooth: 0.18,
        },
      ],
    });
  }

  return entities;
}
