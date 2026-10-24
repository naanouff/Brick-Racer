/**
 * @file index.ts
 * @description Shared level spawn helpers (BRICK-BO1a / BO1f).
 */

export type {
  GraphRef,
  LevelComponent,
  LevelEntity,
  LevelSpec,
  MaterialSpec,
  PrimitiveSpec,
  Quat,
  SandboxKartLevel,
  TransformSpec,
  Vec3,
} from './levelTypes';
export {
  spawnStaticBox,
  quatYawY,
  quatPitchX,
  quatYawPitch,
  flushRampCenterY,
} from './staticBox';
export type { StaticBoxOpts } from './staticBox';
export {
  GROUP_CHASSIS,
  GROUP_WHEEL,
  GROUP_WORLD,
  GROUP_WALL,
  GROUP_RAMP,
  MASK_ALL,
  MASK_CHASSIS,
  MASK_RAY_TRACK,
  groupForKind,
} from './collisionGroups';
export type { ColliderKind } from './collisionGroups';
export {
  fetchJson,
  applyTransform,
  createPrimitiveMesh,
  spawnLevel,
} from './spawnLevel';
export type { SpawnLevelResult } from './spawnLevel';
export {
  BLOCKOUT_PRIMITIVES,
  BLOCKOUT_SHADER_GRAPHS,
  blockoutMaterials,
  makeSunEntity,
} from './blockoutKit';
export {
  createPlayerKartEntities,
  createBlockoutKartEntities,
  scaleKartEntities,
  kartGraphRefs,
  blockoutKartGraphRefs,
  kartMaterials,
  kartPrimitives,
  KART_SCALE,
  CHASE_FRAME_BOOST,
  BLOCKOUT_KART_SPAWN_Y,
} from './kartKit';
export type { KartSpawnOpts } from './kartKit';
export { pointInTrigger } from './levelTriggers';
export type { LevelTrigger, LevelTriggerKind, LevelSpawnPose } from './levelTriggers';
