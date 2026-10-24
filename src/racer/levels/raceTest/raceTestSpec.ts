/**
 * @file raceTestSpec.ts
 * @description race-test blockout — oval ~420 wu median, IDs stable (BRICK-BO1b / BO1f).
 *
 * Stable IDs:
 * - cp.start_finish | cp.after_turn1 | cp.after_whoops | cp.seaside | cp.after_chicane
 * - grid.slot.0..3 (markers); slot0 kart · slot1 moto · slot2 plane · slot3 empty
 * - prop.whoop.* | prop.boost.* | prop.ring.* | prop.item.* | prop.arch.proving* | prop.dune
 * - Player vehicle via `?vehicle=kart|moto|plane` (others parked as display props)
 */

// Import leaf modules only — barrel `../shared` pulls spawnLevel → w3dts-scripts (mono / CI).
import {
  BLOCKOUT_PRIMITIVES,
  BLOCKOUT_SHADER_GRAPHS,
  blockoutMaterials,
  makeSunEntity,
} from '../shared/blockoutKit';
import {
  BLOCKOUT_KART_SPAWN_Y,
  blockoutKartGraphRefs,
  createBlockoutKartEntities,
} from '../shared/kartKit';
import type { LevelEntity, LevelSpec, Vec3 } from '../shared/levelTypes';
import type { LevelSpawnPose, LevelTrigger } from '../shared/levelTriggers';
import { flushRampCenterY, quatYawPitch, quatYawY, spawnStaticBox } from '../shared/staticBox';
import { createBlockoutMotoEntities, BLOCKOUT_MOTO_SPAWN_Y } from '../../vehicles/moto/blockoutMotoKit';
import {
  createBlockoutPlaneEntities,
  BLOCKOUT_PLANE_SPAWN_Y,
} from '../../vehicles/plane/blockoutPlaneKit';
import { resolveVehicleKind, type VehicleKind } from '../../vehicles/selectVehicle';

/** Track center ellipse: start at south (0,0,0), CCW, facing +X. */
const CX = 0;
const CZ = 45;
const RX = 80;
const RZ = 45;
const TRACK_HALF = 6; // width 12
const WALL_H = 0.66;
const WALL_VISUAL_T = 0.4;
const WALL_COLLIDER_T = 1.0;
/** Wall / ribbon segments around the oval (full geometry). */
const SEGMENTS = 72;
/** Decorative centerline ribbons (visual only). */
const RIBBON_SEGMENTS = 36;
const WHOOP_PITCH = (12 * Math.PI) / 180;
const DUNE_PITCH = (18 * Math.PI) / 180;

function ovalXZ(t: number, rx = RX, rz = RZ): [number, number] {
  const angle = -Math.PI / 2 + t * Math.PI * 2;
  return [CX + rx * Math.cos(angle), CZ + rz * Math.sin(angle)];
}

function ovalTangent(t: number): [number, number] {
  const a = -Math.PI / 2 + t * Math.PI * 2;
  const da = Math.PI * 2;
  const tx = -RX * Math.sin(a) * da;
  const tz = RZ * Math.cos(a) * da;
  const len = Math.hypot(tx, tz) || 1;
  return [tx / len, tz / len];
}

function ovalNormal(t: number): [number, number] {
  const [tx, tz] = ovalTangent(t);
  // outward normal for CCW (right of tangent in XZ: (tz, -tx))
  return [tz, -tx];
}

export type TrackPose = {
  position: Vec3;
  yaw: number;
  tangent: [number, number];
};

/** Place a point on the median (+ lateral offset along outward normal). */
export function placeOnTrack(t: number, lateral = 0, y = 0): TrackPose {
  const [x, z] = ovalXZ(t);
  const [tx, tz] = ovalTangent(t);
  const [nx, nz] = ovalNormal(t);
  return {
    position: [x + nx * lateral, y, z + nz * lateral],
    yaw: Math.atan2(tx, tz),
    tangent: [tx, tz],
  };
}

/** `side` -1 = inner ring, +1 = outer ring. Visual thin; collider thicker, pushed out. */
function pushWallRing(entities: LevelEntity[], side: -1 | 1, idPrefix: string): void {
  const pushOut = ((WALL_COLLIDER_T - WALL_VISUAL_T) * 0.5) * side;
  for (let i = 0; i < SEGMENTS; i++) {
    const t0 = i / SEGMENTS;
    const t1 = (i + 1) / SEGMENTS;
    const chicane = t0 > 0.52 && t0 < 0.68;
    const half = chicane ? 4 : TRACK_HALF;
    const rx = RX + side * half + pushOut;
    const rz = RZ + side * half + pushOut;
    const [x0, z0] = ovalXZ(t0, rx, rz);
    const [x1, z1] = ovalXZ(t1, rx, rz);
    const mx = (x0 + x1) * 0.5;
    const mz = (z0 + z1) * 0.5;
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dz) || 0.5;
    const yaw = Math.atan2(dx, dz);
    entities.push(
      spawnStaticBox({
        id: `${idPrefix}.${i}`,
        center: [mx, WALL_H * 0.5, mz],
        size: [WALL_VISUAL_T, WALL_H, len * 1.05],
        colliderSize: [WALL_COLLIDER_T, WALL_H, len * 1.05],
        materialId: 'BO_Wall',
        rotation: quatYawY(yaw),
        kind: 'wall',
        friction: 0.9,
      })
    );
  }
}

function pushWhoop(entities: LevelEntity[], index: number, t: number): void {
  const pose = placeOnTrack(t, 0, 0);
  const halfLen = 1.1;
  const halfThick = 0.08;
  const y = flushRampCenterY(halfLen, halfThick, WHOOP_PITCH);
  const [tx, tz] = pose.tangent;
  // Ascent then descent along track
  const offsetAlong = halfLen;
  entities.push(
    spawnStaticBox({
      id: `prop.whoop.${index}.up`,
      center: [
        pose.position[0] - tx * offsetAlong * 0.5,
        y,
        pose.position[2] - tz * offsetAlong * 0.5,
      ],
      size: [3, halfThick * 2, halfLen * 2],
      materialId: 'BO_Boost',
      rotation: quatYawPitch(pose.yaw, -WHOOP_PITCH),
      kind: 'ramp',
      friction: 0.95,
    }),
    spawnStaticBox({
      id: `prop.whoop.${index}.down`,
      center: [
        pose.position[0] + tx * offsetAlong * 0.5,
        y,
        pose.position[2] + tz * offsetAlong * 0.5,
      ],
      size: [3, halfThick * 2, halfLen * 2],
      materialId: 'BO_Boost',
      rotation: quatYawPitch(pose.yaw, WHOOP_PITCH),
      kind: 'ramp',
      friction: 0.95,
    })
  );
}

/**
 * Stable ID catalogue (head of module for reviewers).
 */
export const RACE_TEST_STABLE_IDS = [
  'cp.start_finish',
  'cp.after_turn1',
  'cp.after_whoops',
  'cp.seaside',
  'cp.after_chicane',
  'grid.slot.0',
  'grid.slot.1',
  'grid.slot.2',
  'grid.slot.3',
  'prop.arch.proving.left',
  'prop.arch.proving.right',
  'prop.arch.proving.lintel',
  'prop.dune',
] as const;

/** Grid slot centers (XZ); Y set per vehicle. */
export const RACE_GRID_SLOTS: Vec3[] = [
  [0, 0.05, -4.5],
  [0, 0.05, -1.5],
  [-4, 0.05, -4.5],
  [-4, 0.05, -1.5],
];

export const RACE_TEST_SPAWN: LevelSpawnPose = {
  position: [0, BLOCKOUT_KART_SPAWN_Y, -4.5],
  rotation: quatYawY(0),
};

export function raceSpawnForVehicle(kind: VehicleKind = resolveVehicleKind()): LevelSpawnPose {
  if (kind === 'moto') {
    return {
      position: [RACE_GRID_SLOTS[1][0], BLOCKOUT_MOTO_SPAWN_Y, RACE_GRID_SLOTS[1][2]],
      rotation: quatYawY(0),
    };
  }
  if (kind === 'plane') {
    return {
      position: [RACE_GRID_SLOTS[2][0], BLOCKOUT_PLANE_SPAWN_Y, RACE_GRID_SLOTS[2][2]],
      rotation: quatYawY(0),
    };
  }
  return {
    position: [RACE_GRID_SLOTS[0][0], BLOCKOUT_KART_SPAWN_Y, RACE_GRID_SLOTS[0][2]],
    rotation: quatYawY(0),
  };
}

export function buildRaceTestTriggers(): LevelTrigger[] {
  const triggers: LevelTrigger[] = [];
  for (const [i, t] of [
    [0, 0.04],
    [1, 0.1],
  ] as const) {
    const pose = placeOnTrack(t);
    triggers.push({
      id: `prop.boost.ground.${i}`,
      kind: 'boost',
      center: [pose.position[0], 0.6, pose.position[2]],
      halfExtents: [2.2, 1.2, 1.2],
      yaw: pose.yaw,
    });
  }
  for (const [i, t] of [
    [0, 0.4],
    [1, 0.48],
  ] as const) {
    const pose = placeOnTrack(t, 0, 4);
    triggers.push({
      id: `prop.ring.air.${i}`,
      kind: 'ring',
      center: pose.position,
      halfExtents: [2.0, 2.0, 1.2],
      yaw: pose.yaw,
    });
  }
  return triggers;
}

export function buildRaceTestSpec(): LevelSpec {
  const kart = blockoutKartGraphRefs();
  const entities: LevelEntity[] = [makeSunEntity('RT_Sun')];

  entities.push(
    spawnStaticBox({
      id: 'RT_Ground',
      center: [0, -0.5, CZ],
      size: [RX * 2 + 40, 1, RZ * 2 + 40],
      materialId: 'BO_Asphalt',
      meshId: 'bo_cube',
      friction: 1.15,
      kind: 'ground',
    })
  );

  for (let i = 0; i < RIBBON_SEGMENTS; i++) {
    const t0 = i / RIBBON_SEGMENTS;
    const t1 = (i + 1) / RIBBON_SEGMENTS;
    const chicane = t0 > 0.52 && t0 < 0.68;
    const width = chicane ? 8 : 12;
    const [x0, z0] = ovalXZ(t0);
    const [x1, z1] = ovalXZ(t1);
    const mx = (x0 + x1) * 0.5;
    const mz = (z0 + z1) * 0.5;
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dz) || 0.5;
    const yaw = Math.atan2(dx, dz);
    entities.push(
      spawnStaticBox({
        id: `RT_Ribbon.${i}`,
        center: [mx, 0.005, mz],
        size: [width, 0.01, len * 1.08],
        materialId: 'BO_Accent',
        rotation: quatYawY(yaw),
        kind: 'none',
        collider: false,
        castShadow: false,
      })
    );
  }

  pushWallRing(entities, -1, 'RT_WallInner');
  pushWallRing(entities, 1, 'RT_WallOuter');

  for (let i = 0; i < 3; i++) {
    pushWhoop(entities, i, 0.28 + i * (4 / 420));
  }

  for (const [i, t] of [
    [0, 0.04],
    [1, 0.1],
  ] as const) {
    const pose = placeOnTrack(t);
    entities.push(
      spawnStaticBox({
        id: `prop.boost.ground.${i}`,
        center: [pose.position[0], 0.005, pose.position[2]],
        size: [4, 0.01, 2],
        materialId: 'BO_Boost',
        rotation: quatYawY(pose.yaw),
        kind: 'none',
        collider: false,
      })
    );
  }

  for (const [i, t] of [
    [0, 0.4],
    [1, 0.48],
  ] as const) {
    const pose = placeOnTrack(t, 0, 4);
    entities.push({
      id: `prop.ring.air.${i}`,
      name: `prop.ring.air.${i}`,
      parentId: null,
      transform: {
        position: pose.position,
        rotation: quatYawY(pose.yaw + Math.PI / 2),
        scale: [3.5, 0.35, 3.5],
      },
      components: [
        {
          type: 'renderable',
          meshId: 'bo_cyl',
          materialId: 'BO_Accent',
          castShadow: false,
        },
      ],
    });
  }

  for (let i = 0; i < 4; i++) {
    const pose = placeOnTrack(0.06 + i * 0.015, 0, 0.6);
    entities.push(
      spawnStaticBox({
        id: `prop.item.ground.${i}`,
        center: pose.position,
        size: [0.8, 0.8, 0.8],
        materialId: 'BO_Item',
        kind: 'none',
        collider: false,
      })
    );
  }

  const cps: Array<{ id: string; t: number; w: number }> = [
    { id: 'cp.start_finish', t: 0, w: 14 },
    { id: 'cp.after_turn1', t: 0.22, w: 12 },
    { id: 'cp.after_whoops', t: 0.35, w: 12 },
    { id: 'cp.seaside', t: 0.45, w: 12 },
    { id: 'cp.after_chicane', t: 0.65, w: 10 },
  ];
  for (const cp of cps) {
    const pose = placeOnTrack(cp.t, 0, 4);
    entities.push(
      spawnStaticBox({
        id: cp.id,
        center: pose.position,
        size: [cp.w, 8, 2],
        materialId: 'BO_Cp',
        rotation: quatYawY(pose.yaw),
        kind: 'none',
        collider: false,
        castShadow: false,
      })
    );
  }

  const vehicle = resolveVehicleKind();
  RACE_GRID_SLOTS.forEach((pos, i) => {
    entities.push(
      spawnStaticBox({
        id: `grid.slot.${i}`,
        center: pos,
        size: [2.2, 0.08, 2.2],
        materialId: i === (vehicle === 'kart' ? 0 : vehicle === 'moto' ? 1 : 2) ? 'BO_Pad' : 'BO_Building',
        kind: 'none',
        collider: false,
      })
    );
  });

  // PROVING arch — opening 14 (two pillars + lintel, no solid bar)
  const pillarHalfZ = 7;
  entities.push(
    spawnStaticBox({
      id: 'prop.arch.proving.left',
      center: [2, 3, -pillarHalfZ],
      size: [1.2, 6, 1.2],
      materialId: 'BO_Gate',
      kind: 'wall',
    }),
    spawnStaticBox({
      id: 'prop.arch.proving.right',
      center: [2, 3, pillarHalfZ],
      size: [1.2, 6, 1.2],
      materialId: 'BO_Gate',
      kind: 'wall',
    }),
    spawnStaticBox({
      id: 'prop.arch.proving.lintel',
      center: [2, 6.2, 0],
      size: [1.2, 0.6, 14],
      materialId: 'BO_Gate',
      kind: 'none',
      collider: false,
    })
  );

  // Dune on segment 6 (~t=0.85), flush leading edge
  const dunePose = placeOnTrack(0.85, 0, 0);
  const duneHalfL = 5;
  const duneHalfT = 0.2;
  const duneY = flushRampCenterY(duneHalfL, duneHalfT, DUNE_PITCH);
  entities.push(
    spawnStaticBox({
      id: 'prop.dune',
      center: [dunePose.position[0], duneY, dunePose.position[2]],
      size: [4, duneHalfT * 2, duneHalfL * 2],
      materialId: 'BO_Boost',
      rotation: quatYawPitch(dunePose.yaw, -DUNE_PITCH),
      kind: 'ramp',
      friction: 0.95,
    })
  );

  const kartSpawn = raceSpawnForVehicle('kart');
  const motoSpawn = raceSpawnForVehicle('moto');
  const planeSpawn = raceSpawnForVehicle('plane');
  entities.push(
    ...createBlockoutKartEntities({
      position: [...kartSpawn.position],
      yawY: 0,
      playable: vehicle === 'kart',
    }),
    ...createBlockoutMotoEntities({
      position: [...motoSpawn.position],
      yawY: 0,
      playable: vehicle === 'moto',
    }),
    ...createBlockoutPlaneEntities({
      position: [...planeSpawn.position],
      yawY: 0,
      playable: vehicle === 'plane',
    })
  );

  const shaderById = new Map(
    [...BLOCKOUT_SHADER_GRAPHS, ...kart.shaderGraphs].map((g) => [g.id, g])
  );

  return {
    id: 'race-test',
    shaderGraphs: [...shaderById.values()],
    geometryGraphs: kart.geometryGraphs,
    scriptGraphs: kart.scriptGraphs,
    materials: { ...blockoutMaterials() },
    primitives: { ...BLOCKOUT_PRIMITIVES },
    entities,
  };
}

export const raceTestSpec: LevelSpec = buildRaceTestSpec();
