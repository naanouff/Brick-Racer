/**
 * @file cityTestSpec.ts
 * @description city-test blockout — 40×40 hub AABB (BRICK-BO1c / BO1f).
 *
 * Stable IDs:
 * - poi.garage | pad.race_test
 * - landmark.tower | landmark.garage | landmark.vinyle | landmark.billboard | landmark.mairie
 * - landmark.fountain | landmark.gate | landmark.pad
 * - npc.hex | npc.bolt
 */

// Leaf imports only — avoid shared barrel → spawnLevel → w3dts-scripts (CI without mono).
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
import type { LevelEntity, LevelSpec } from '../shared/levelTypes';
import type { LevelSpawnPose, LevelTrigger } from '../shared/levelTriggers';
import { flushRampCenterY, quatPitchX, quatYawY, spawnStaticBox } from '../shared/staticBox';

export const CITY_TEST_STABLE_IDS = [
  'poi.garage',
  'pad.race_test',
  'landmark.tower',
  'landmark.garage',
  'landmark.vinyle',
  'landmark.billboard',
  'landmark.mairie',
  'landmark.fountain',
  'landmark.gate',
  'landmark.pad',
  'npc.hex',
  'npc.bolt',
] as const;

const PAD_CHAMFER_PITCH = (18 * Math.PI) / 180;

function boxFromAabb(
  id: string,
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number,
  height: number,
  materialId: string,
  opts?: { y?: number; collider?: boolean; kind?: 'wall' | 'ground' | 'ramp' | 'none' }
): LevelEntity {
  const w = maxX - minX;
  const d = maxZ - minZ;
  const y0 = opts?.y ?? 0;
  return spawnStaticBox({
    id,
    center: [(minX + maxX) * 0.5, y0 + height * 0.5, (minZ + maxZ) * 0.5],
    size: [w, height, d],
    materialId,
    collider: opts?.collider ?? true,
    kind: opts?.kind ?? 'wall',
  });
}

/** South of fountain (20,20) — plaza center is occupied by landmark.fountain. */
export const CITY_TEST_SPAWN: LevelSpawnPose = {
  position: [20, BLOCKOUT_KART_SPAWN_Y, 14],
  rotation: quatYawY(0),
};

export function buildCityTestTriggers(): LevelTrigger[] {
  return [
    {
      id: 'pad.race_test',
      kind: 'boost',
      center: [20, 0.8, 8],
      halfExtents: [4, 1.2, 3],
      yaw: 0,
    },
  ];
}

export function buildCityTestSpec(): LevelSpec {
  const kart = blockoutKartGraphRefs();
  const entities: LevelEntity[] = [makeSunEntity('CT_Sun')];

  entities.push(
    spawnStaticBox({
      id: 'CT_Ground',
      center: [20, -0.5, 20],
      size: [40, 1, 40],
      materialId: 'BO_Asphalt',
      friction: 1.15,
      kind: 'ground',
    })
  );

  entities.push(
    spawnStaticBox({
      id: 'landmark.plaza',
      center: [20, 0.01, 20],
      size: [16, 0.02, 16],
      materialId: 'BO_Accent',
      kind: 'none',
      collider: false,
      castShadow: false,
    })
  );

  entities.push(
    spawnStaticBox({
      id: 'landmark.fountain',
      center: [20, 1, 20],
      size: [3, 2, 3],
      materialId: 'BO_Npc',
      kind: 'wall',
    })
  );

  entities.push(
    boxFromAabb('landmark.tower', 8, 22, 12, 28, 8, 'BO_Building'),
    boxFromAabb('landmark.billboard', 14, 26, 22, 28, 5.5, 'BO_Accent'),
    boxFromAabb('landmark.garage', 28, 14, 36, 22, 4.5, 'BO_Building'),
    boxFromAabb('landmark.vinyle', 4, 14, 10, 20, 4, 'BO_Building'),
    boxFromAabb('landmark.mairie', 16, 34, 24, 38, 2.5, 'BO_Building')
  );

  // Pad 8×6×0.22 + north/south chamfers so scaled kart can climb
  entities.push(
    spawnStaticBox({
      id: 'landmark.pad',
      center: [20, 0.11, 7],
      size: [8, 0.22, 6],
      materialId: 'BO_Pad',
      kind: 'ramp',
      friction: 1.05,
    })
  );
  const chamferHalfL = 0.9;
  const chamferHalfT = 0.11;
  const chamferY = flushRampCenterY(chamferHalfL, chamferHalfT, PAD_CHAMFER_PITCH);
  entities.push(
    spawnStaticBox({
      id: 'landmark.pad.chamfer.s',
      center: [20, chamferY, 7 - 3 - chamferHalfL],
      size: [8, chamferHalfT * 2, chamferHalfL * 2],
      materialId: 'BO_Pad',
      rotation: quatPitchX(-PAD_CHAMFER_PITCH),
      kind: 'ramp',
      friction: 1.05,
    }),
    spawnStaticBox({
      id: 'landmark.pad.chamfer.n',
      center: [20, chamferY, 7 + 3 + chamferHalfL],
      size: [8, chamferHalfT * 2, chamferHalfL * 2],
      materialId: 'BO_Pad',
      rotation: quatPitchX(PAD_CHAMFER_PITCH),
      kind: 'ramp',
      friction: 1.05,
    })
  );

  entities.push(
    spawnStaticBox({
      id: 'landmark.gate',
      center: [36, 2.5, 22],
      size: [4, 5, 8],
      materialId: 'BO_Gate',
      kind: 'wall',
      friction: 1,
    })
  );

  entities.push(
    spawnStaticBox({
      id: 'poi.garage',
      center: [30, 1.25, 18],
      size: [3, 2.5, 3],
      materialId: 'BO_Trigger',
      kind: 'none',
      collider: false,
      castShadow: false,
    }),
    spawnStaticBox({
      id: 'pad.race_test',
      center: [20, 0.5, 7],
      size: [8, 1, 6],
      materialId: 'BO_Trigger',
      kind: 'none',
      collider: false,
      castShadow: false,
    })
  );

  entities.push(
    {
      id: 'npc.hex',
      name: 'npc.hex',
      parentId: null,
      transform: {
        position: [22, 0.825, 8],
        rotation: [0, 0, 0, 1],
        scale: [1, 1, 1],
      },
      components: [
        {
          type: 'renderable',
          meshId: 'bo_capsule',
          materialId: 'BO_Npc',
          castShadow: false,
        },
      ],
    },
    {
      id: 'npc.bolt',
      name: 'npc.bolt',
      parentId: null,
      transform: {
        position: [27.5, 0.825, 18],
        rotation: [0, 0, 0, 1],
        scale: [1, 1, 1],
      },
      components: [
        {
          type: 'renderable',
          meshId: 'bo_capsule',
          materialId: 'BO_Accent',
          castShadow: false,
        },
      ],
    }
  );

  entities.push(
    ...createBlockoutKartEntities({
      position: [...CITY_TEST_SPAWN.position],
      yawY: 0,
    })
  );

  const shaderById = new Map(
    [...BLOCKOUT_SHADER_GRAPHS, ...kart.shaderGraphs].map((g) => [g.id, g])
  );

  return {
    id: 'city-test',
    shaderGraphs: [...shaderById.values()],
    geometryGraphs: kart.geometryGraphs,
    scriptGraphs: kart.scriptGraphs,
    materials: { ...blockoutMaterials() },
    primitives: { ...BLOCKOUT_PRIMITIVES },
    entities,
  };
}

export const cityTestSpec: LevelSpec = buildCityTestSpec();
