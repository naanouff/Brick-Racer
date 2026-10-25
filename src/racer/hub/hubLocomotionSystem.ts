/**
 * @file hubLocomotionSystem.ts
 * @description On-foot walk (camera-relative, not vehicle axes), seat snap, and throttle gate.
 */

import { quat, vec3 } from 'gl-matrix';
import {
  beginHubOrbit,
  cameraRelativePlanar,
  endHubOrbit,
  getHubOrbitYaw,
  readOnFootMove,
  yawFromQuat,
} from './hubOnFootControls';
import {
  NameComponent,
  TransformComponent,
  type ComponentClass,
  type Entity,
  type IComponent,
  type System,
  type World,
} from '@naanouff/w3dts-core';
import { ColliderComponent, RigidBodyComponent, VehicleComponent } from '@naanouff/w3dts-physics';
import { MASK_AVATAR } from '../levels/shared/collisionGroups';
import { quatYawY } from '../levels/shared/staticBox';
import {
  getArcadeKartRuntime,
  setArcadeKartLevelContext,
} from '../vehicles/kart/arcade/arcadeKartRuntime';
import { VEHICLE_CHASSIS_NAME, type VehicleKind } from '../vehicles/selectVehicle';
import {
  chassisReceivesDrive,
  exitAvatarPosition,
  getHubPossession,
  getHubVehicleSpawn,
  HUB_AVATAR_NAME,
  HUB_WALK_SPEED,
  isHubActive,
  mountDismountDown,
  nearestEnterTarget,
  seatAvatarPosition,
  setHubPossession,
  type HubPossession,
} from './hubPossession';

export type HubHardware = {
  keysDown?: { has(key: string): boolean };
  gamepads?: ReadonlyArray<
    | {
        connected?: boolean;
        buttons?: ReadonlyArray<{ pressed?: boolean; value?: number } | undefined>;
      }
    | null
    | undefined
  >;
};

export type HubInput = {
  isActionJustPressed(action: string): boolean;
  getAxis?(name: string): number;
  hardware?: HubHardware;
};

function getTf(world: World, entity: Entity): TransformComponent | undefined {
  return world.getComponent(entity, TransformComponent as unknown as ComponentClass<IComponent>) as
    | TransformComponent
    | undefined;
}

function findByName(world: World, name: string): Entity | null {
  for (const [entity, [nm]] of world.query<[NameComponent]>([NameComponent]).iter()) {
    if (nm.name === name) return entity;
  }
  return null;
}

function setColliderMask(world: World, entity: Entity, mask: number): void {
  const col = world.getComponent(
    entity,
    ColliderComponent as unknown as ComponentClass<IComponent>
  ) as ColliderComponent | undefined;
  if (!col) return;
  col.collisionMask = mask;
  for (const shape of col.shapes) shape.collisionMask = mask;
}

function poseOf(tf: TransformComponent): {
  position: [number, number, number];
  rotation: [number, number, number, number];
} {
  return {
    position: [tf.position[0], tf.position[1], tf.position[2]],
    rotation: [tf.rotation[0], tf.rotation[1], tf.rotation[2], tf.rotation[3]],
  };
}

function placeAvatar(
  tf: TransformComponent,
  body: RigidBodyComponent,
  position: readonly [number, number, number],
  rotation?: readonly [number, number, number, number]
): void {
  vec3.set(tf.position, position[0], position[1], position[2]);
  if (rotation) quat.set(tf.rotation, rotation[0], rotation[1], rotation[2], rotation[3]);
  tf.updateLocalTransform();
  vec3.set(body.velocity, 0, 0, 0);
  vec3.set(body.angularVelocity, 0, 0, 0);
  body.clearAccumulators?.();
  body.wakeUp?.();
}

function syncVehicleSpawn(kind: VehicleKind): void {
  const spawn = getHubVehicleSpawn(kind);
  const rt = getArcadeKartRuntime();
  if (!spawn || !rt) return;
  const position: [number, number, number] = [
    spawn.position[0],
    spawn.position[1],
    spawn.position[2],
  ];
  const rotation: [number, number, number, number] = [
    spawn.rotation[0],
    spawn.rotation[1],
    spawn.rotation[2],
    spawn.rotation[3],
  ];
  setArcadeKartLevelContext({ position, rotation }, rt.state.triggers);
  rt.state.drifting = false;
  rt.state.driftTime = 0;
  rt.state.hopAirTimer = 0;
}

export function createHubOnFootSystem(getInput: () => HubInput): System {
  let mountWasDown = false;

  return function hubOnFootSystem(world: World): void {
    const input = getInput();
    const down = mountDismountDown(input.hardware ?? {});
    const justMounted = down && !mountWasDown;
    mountWasDown = down;
    if (!isHubActive()) return;

    const avatar = findByName(world, HUB_AVATAR_NAME);
    if (avatar == null) return;
    const avatarTf = getTf(world, avatar);
    const avatarBody = world.getComponent(
      avatar,
      RigidBodyComponent as unknown as ComponentClass<IComponent>
    ) as RigidBodyComponent | undefined;
    if (!avatarTf || !avatarBody) return;

    let mode: HubPossession = getHubPossession();

    if (justMounted && mode !== 'foot') {
      const chassisName = VEHICLE_CHASSIS_NAME[mode];
      const chassis = findByName(world, chassisName);
      const chassisTf = chassis ? getTf(world, chassis) : undefined;
      if (chassisTf) {
        const pose = poseOf(chassisTf);
        const exit = exitAvatarPosition(pose.position, pose.rotation);
        const yaw = yawFromQuat(pose.rotation);
        const upright = quatYawY(yaw);
        beginHubOrbit(yaw);
        avatarBody.isKinematic = false;
        avatarBody.useGravity = true;
        setColliderMask(world, avatar, MASK_AVATAR);
        placeAvatar(avatarTf, avatarBody, exit, upright);
        setHubPossession('foot');
        mode = 'foot';
      }
    } else if (justMounted && mode === 'foot') {
      const points: { kind: VehicleKind; position: [number, number, number] }[] = [];
      for (const kind of ['kart', 'moto', 'plane'] as const) {
        const chassis = findByName(world, VEHICLE_CHASSIS_NAME[kind]);
        const tf = chassis ? getTf(world, chassis) : undefined;
        if (!tf) continue;
        points.push({ kind, position: [tf.position[0], tf.position[1], tf.position[2]] });
      }
      const target = nearestEnterTarget(
        [avatarTf.position[0], avatarTf.position[1], avatarTf.position[2]],
        points
      );
      if (target) {
        endHubOrbit();
        setHubPossession(target);
        syncVehicleSpawn(target);
        mode = target;
      }
    }

    if (mode === 'foot') {
      avatarBody.isKinematic = false;
      avatarBody.useGravity = true;
      setColliderMask(world, avatar, MASK_AVATAR);
      if (input.isActionJustPressed('resetKart')) {
        const kart = findByName(world, VEHICLE_CHASSIS_NAME.kart);
        const kartTf = kart ? getTf(world, kart) : undefined;
        const spawn = getHubVehicleSpawn('kart');
        const from = kartTf ? poseOf(kartTf) : spawn;
        if (from) placeAvatar(avatarTf, avatarBody, exitAvatarPosition(from.position, from.rotation));
      }
      const move = readOnFootMove(input.hardware ?? {});
      const { dx, dz } = cameraRelativePlanar(getHubOrbitYaw(), move.forward, move.strafe);
      const mag = Math.hypot(dx, dz);
      avatarBody.velocity[0] = dx * HUB_WALK_SPEED;
      avatarBody.velocity[2] = dz * HUB_WALK_SPEED;
      avatarBody.angularVelocity[0] = 0;
      avatarBody.angularVelocity[1] = 0;
      avatarBody.angularVelocity[2] = 0;
      if (mag > 0.2) {
        const yaw = quatYawY(Math.atan2(dx, dz));
        quat.set(avatarTf.rotation, yaw[0], yaw[1], yaw[2], yaw[3]);
        avatarTf.updateLocalTransform();
      }
      return;
    }

    endHubOrbit();
    avatarBody.isKinematic = true;
    avatarBody.useGravity = false;
    setColliderMask(world, avatar, 0);
    vec3.set(avatarBody.velocity, 0, 0, 0);
    vec3.set(avatarBody.angularVelocity, 0, 0, 0);
  };
}

/** After physics, before the chase camera: pin the minifig to the seat. */
export function createHubSeatSnapSystem(): System {
  return function hubSeatSnapSystem(world: World): void {
    if (!isHubActive()) return;
    const mode = getHubPossession();
    if (mode === 'foot') return;
    const avatar = findByName(world, HUB_AVATAR_NAME);
    const chassis = findByName(world, VEHICLE_CHASSIS_NAME[mode]);
    if (avatar == null || chassis == null) return;
    const avatarTf = getTf(world, avatar);
    const chassisTf = getTf(world, chassis);
    if (!avatarTf || !chassisTf) return;
    const pose = poseOf(chassisTf);
    const seat = seatAvatarPosition(pose.position, pose.rotation, mode);
    vec3.set(avatarTf.position, seat[0], seat[1], seat[2]);
    quat.set(avatarTf.rotation, pose.rotation[0], pose.rotation[1], pose.rotation[2], pose.rotation[3]);
    avatarTf.updateLocalTransform();
  };
}

/** After script graphs, so only the possessed vehicle keeps WASD throttle. */
export function createHubThrottleGateSystem(): System {
  return function hubThrottleGateSystem(world: World): void {
    if (!isHubActive()) return;
    const mode = getHubPossession();
    for (const [entity, [vehicle, named]] of world
      .query<[VehicleComponent, NameComponent]>([VehicleComponent, NameComponent])
      .iter()) {
      void entity;
      if (chassisReceivesDrive(mode, named.name)) continue;
      vehicle.throttle = 0;
      vehicle.steerInput = 0;
    }
  };
}
