/**
 * @file hubPossession.ts
 * @description City-test on-foot / vehicle possession (BRICK-H1). Pure math + session state.
 */

import { quat, vec3 } from 'gl-matrix';
import { AVATAR_CENTER_Y } from '../levels/shared/collisionGroups';
import { VEHICLE_CHASSIS_NAME, type VehicleKind } from '../vehicles/selectVehicle';
import { resetHubOrbit } from './hubOnFootControls';

export type HubPossession = 'foot' | VehicleKind;

export type HubSpawnPose = {
  position: readonly [number, number, number];
  rotation: readonly [number, number, number, number];
};

export const HUB_AVATAR_NAME = 'HubAvatar';
export const FOOT_CHASE_CAMERA_NAME = 'FootChaseCamera';
export const HUB_ENTER_RADIUS = 2.2;
export const HUB_EXIT_LATERAL = 1.6;
export const HUB_WALK_SPEED = 3.5;

/** Avatar origin in chassis local space (feet on the seat, minifig standing). */
export const HUB_SEAT_LOCAL: Record<VehicleKind, readonly [number, number, number]> = {
  kart: [0, 1.2, -0.05],
  moto: [0, 1.3, -0.15],
  plane: [0, 1.15, 0.25],
};

const _q = quat.create();
const _v = vec3.create();
const _right = vec3.fromValues(1, 0, 0);

export type HubVehiclePoint = {
  kind: VehicleKind;
  position: readonly [number, number, number];
};

export function chassisReceivesDrive(mode: HubPossession, chassisName: string): boolean {
  if (mode === 'foot') return false;
  return VEHICLE_CHASSIS_NAME[mode] === chassisName;
}

/** Closest chassis within `radius` on the XZ plane. */
export function nearestEnterTarget(
  avatar: readonly [number, number, number],
  vehicles: readonly HubVehiclePoint[],
  radius = HUB_ENTER_RADIUS
): VehicleKind | null {
  let best: { kind: VehicleKind; d: number } | null = null;
  for (const v of vehicles) {
    const dx = v.position[0] - avatar[0];
    const dz = v.position[2] - avatar[2];
    const d = Math.hypot(dx, dz);
    if (d > radius) continue;
    if (!best || d < best.d) best = { kind: v.kind, d };
  }
  return best?.kind ?? null;
}

/** World position of the avatar origin, 1.6 m to the chassis right, feet on the ground. */
export function exitAvatarPosition(
  chassisPos: readonly [number, number, number],
  rotation: readonly [number, number, number, number]
): [number, number, number] {
  quat.set(_q, rotation[0], rotation[1], rotation[2], rotation[3]);
  vec3.transformQuat(_v, _right, _q);
  _v[1] = 0;
  const len = Math.hypot(_v[0], _v[2]);
  const rx = len > 1e-4 ? _v[0] / len : 1;
  const rz = len > 1e-4 ? _v[2] / len : 0;
  return [
    chassisPos[0] + rx * HUB_EXIT_LATERAL,
    AVATAR_CENTER_Y,
    chassisPos[2] + rz * HUB_EXIT_LATERAL,
  ];
}

/** World position of the avatar origin in the seat. */
export function seatAvatarPosition(
  chassisPos: readonly [number, number, number],
  rotation: readonly [number, number, number, number],
  kind: VehicleKind
): [number, number, number] {
  const local = HUB_SEAT_LOCAL[kind];
  quat.set(_q, rotation[0], rotation[1], rotation[2], rotation[3]);
  vec3.set(_v, local[0], local[1], local[2]);
  vec3.transformQuat(_v, _v, _q);
  return [chassisPos[0] + _v[0], chassisPos[1] + _v[1], chassisPos[2] + _v[2]];
}

type KeySet = { has(key: string): boolean };
type PadButton = { pressed?: boolean; value?: number } | undefined;
type PadLike = { connected?: boolean; buttons?: readonly PadButton[] } | null | undefined;

/** F, or gamepad Y (standard mapping index 3). */
export function mountDismountDown(hardware: {
  keysDown?: KeySet;
  gamepads?: readonly PadLike[];
}): boolean {
  const keys = hardware.keysDown;
  if (keys?.has('f') || keys?.has('F')) return true;
  const pad = hardware.gamepads?.[0];
  if (!pad || pad.connected === false) return false;
  const b = pad.buttons?.[3];
  if (!b) return false;
  return b.pressed === true || (b.value ?? 0) > 0.5;
}

let hubActive = false;
let possession: HubPossession = 'kart';
let spawns: Partial<Record<VehicleKind, HubSpawnPose>> = {};
let listener: ((mode: HubPossession | null) => void) | null = null;

export function isHubActive(): boolean {
  return hubActive;
}

export function getHubPossession(): HubPossession {
  return possession;
}

export function getHubVehicleSpawn(kind: VehicleKind): HubSpawnPose | null {
  return spawns[kind] ?? null;
}

export function setHubPossessionListener(fn: ((mode: HubPossession | null) => void) | null): void {
  listener = fn;
}

export function activateHubSession(next: Record<VehicleKind, HubSpawnPose>): void {
  hubActive = true;
  spawns = {
    kart: next.kart,
    moto: next.moto,
    plane: next.plane,
  };
  possession = 'kart';
  listener?.('kart');
}

export function deactivateHubSession(): void {
  hubActive = false;
  listener?.(null);
}

export function setHubPossession(next: HubPossession): void {
  possession = next;
  if (hubActive) listener?.(next);
}

/** Ground arcade chassis, or null when on foot / in the plane (or race plane URL). */
export function arcadeGroundChassisName(urlKind: VehicleKind): string | null {
  if (!hubActive) {
    if (urlKind === 'plane') return 'PlaneChassis';
    return VEHICLE_CHASSIS_NAME[urlKind];
  }
  if (possession === 'foot' || possession === 'plane') return null;
  return VEHICLE_CHASSIS_NAME[possession];
}

export function planeSimulationActive(urlKind: VehicleKind): boolean {
  if (!hubActive) return urlKind === 'plane';
  return possession === 'plane';
}

/** Test helper. */
export function resetHubSession(): void {
  hubActive = false;
  possession = 'kart';
  spawns = {};
  listener = null;
  resetHubOrbit();
}
