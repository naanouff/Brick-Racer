/**
 * @file hubOnFootControls.ts
 * @description Marche caméra-relative et orbite libre du minifig (BRICK-H1).
 * Indépendant des axes véhicule (moveForward / stick gauche = direction, pas accélérateur).
 */

export const HUB_ORBIT_DISTANCE = 4.8;
export const HUB_ORBIT_PITCH = 0.38;
/** Regard un peu au-dessus de l'origine (centre du corps). */
export const HUB_ORBIT_LOOK_LIFT = 0.25;
/** rad/s à fond de stick droit. */
export const HUB_LOOK_STICK_YAW = 3;
export const HUB_LOOK_STICK_PITCH = 2;
export const HUB_MOUSE_YAW = 0.0028;
export const HUB_MOUSE_PITCH = 0.0022;
const STICK_DEAD = 0.15;
const PITCH_MIN = -0.5;
const PITCH_MAX = 1.05;

export function clampPitch(pitch: number): number {
  if (pitch < PITCH_MIN) return PITCH_MIN;
  if (pitch > PITCH_MAX) return PITCH_MAX;
  return pitch;
}

function clamp1(v: number): number {
  if (v > 1) return 1;
  if (v < -1) return -1;
  return v;
}

/** Yaw Y (radians) d'un quaternion, 0 = +Z. */
export function yawFromQuat(rotation: readonly [number, number, number, number]): number {
  const x = rotation[0];
  const y = rotation[1];
  const z = rotation[2];
  const w = rotation[3];
  return Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + z * z));
}

/**
 * Direction sol dans le repère de l'orbite.
 * yaw 0 regarde +Z. strafe > 0 (D / stick droit) va vers -X,
 * comme le steer véhicule : à l'écran, c'est la droite.
 */
export function cameraRelativePlanar(
  yaw: number,
  forward: number,
  strafe: number
): { dx: number; dz: number } {
  const lookX = Math.sin(yaw);
  const lookZ = Math.cos(yaw);
  const rightX = -Math.cos(yaw);
  const rightZ = Math.sin(yaw);
  let dx = lookX * forward + rightX * strafe;
  let dz = lookZ * forward + rightZ * strafe;
  const mag = Math.hypot(dx, dz);
  if (mag > 1) {
    dx /= mag;
    dz /= mag;
  }
  return { dx, dz };
}

/** Œil derrière la cible. pitch > 0 = caméra au-dessus, regard vers le bas. */
export function orbitEye(
  target: readonly [number, number, number],
  yaw: number,
  pitch: number,
  distance = HUB_ORBIT_DISTANCE
): [number, number, number] {
  const horiz = distance * Math.cos(pitch);
  return [
    target[0] - Math.sin(yaw) * horiz,
    target[1] + distance * Math.sin(pitch),
    target[2] - Math.cos(yaw) * horiz,
  ];
}

type KeySet = { has(key: string): boolean };

type PadLike = {
  connected?: boolean;
  axes?: readonly number[];
  buttons?: ReadonlyArray<{ pressed?: boolean; value?: number } | undefined>;
} | null | undefined;

export type OnFootHardware = {
  keysDown?: KeySet;
  gamepads?: readonly PadLike[];
};

function stickAbs(current: number, next: number): number {
  return Math.abs(next) >= Math.abs(current) ? next : current;
}

/**
 * WASD / ZQSD et stick gauche uniquement.
 * A/B du pad restent l'accélérateur véhicule et ne font pas marcher.
 */
export function readOnFootMove(hardware: OnFootHardware): { forward: number; strafe: number } {
  let forward = 0;
  let strafe = 0;
  const keys = hardware.keysDown;
  if (keys) {
    if (keys.has('w') || keys.has('z') || keys.has('W') || keys.has('Z')) forward += 1;
    if (keys.has('s') || keys.has('S')) forward -= 1;
    if (keys.has('d') || keys.has('D')) strafe += 1;
    if (keys.has('a') || keys.has('q') || keys.has('A') || keys.has('Q')) strafe -= 1;
  }
  const pad = hardware.gamepads?.[0];
  if (pad && pad.connected !== false && pad.axes) {
    let lx = pad.axes[0] ?? 0;
    let ly = pad.axes[1] ?? 0;
    if (!Number.isFinite(lx) || Math.abs(lx) < STICK_DEAD) lx = 0;
    if (!Number.isFinite(ly) || Math.abs(ly) < STICK_DEAD) ly = 0;
    if (lx !== 0) strafe = stickAbs(strafe, lx);
    const stickForward = -ly;
    if (stickForward !== 0) forward = stickAbs(forward, stickForward);
  }
  return { forward: clamp1(forward), strafe: clamp1(strafe) };
}

/** Stick droit, axes standard 2 (lacet) et 3 (tangage). Hors deadzone, dans [-1, 1]. */
export function readOnFootLookStick(hardware: OnFootHardware): { yaw: number; pitch: number } {
  const pad = hardware.gamepads?.[0];
  if (!pad || pad.connected === false || !pad.axes) return { yaw: 0, pitch: 0 };
  let rx = pad.axes[2] ?? 0;
  let ry = pad.axes[3] ?? 0;
  if (!Number.isFinite(rx) || Math.abs(rx) < STICK_DEAD) rx = 0;
  if (!Number.isFinite(ry) || Math.abs(ry) < STICK_DEAD) ry = 0;
  return { yaw: clamp1(rx), pitch: clamp1(ry) };
}

let orbitYaw = 0;
let orbitPitch = HUB_ORBIT_PITCH;
let orbitActive = false;

export function isHubOrbitActive(): boolean {
  return orbitActive;
}

export function getHubOrbitYaw(): number {
  return orbitYaw;
}

export function getHubOrbitPitch(): number {
  return orbitPitch;
}

/** Caméra derrière le minifig, au cap du véhicule quitté. */
export function beginHubOrbit(yaw: number): void {
  orbitYaw = yaw;
  orbitPitch = HUB_ORBIT_PITCH;
  orbitActive = true;
}

export function endHubOrbit(): void {
  orbitActive = false;
}

export function addHubOrbit(deltaYaw: number, deltaPitch: number): void {
  orbitYaw += deltaYaw;
  orbitPitch = clampPitch(orbitPitch + deltaPitch);
}

export function resetHubOrbit(): void {
  orbitYaw = 0;
  orbitPitch = HUB_ORBIT_PITCH;
  orbitActive = false;
}
