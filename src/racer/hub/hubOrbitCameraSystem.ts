/**
 * @file hubOrbitCameraSystem.ts
 * @description Orbite libre autour du minifig : souris (pointer lock) et stick droit.
 * La caméra ne suit pas le cap du personnage (ce n'est pas une chase véhicule).
 */

import { mat4, quat, vec3 } from 'gl-matrix';
import {
  CameraComponent,
  NameComponent,
  TransformComponent,
  type ComponentClass,
  type Entity,
  type IComponent,
  type System,
  type World,
} from '@naanouff/w3dts-core';
import {
  addHubOrbit,
  getHubOrbitPitch,
  getHubOrbitYaw,
  HUB_LOOK_STICK_PITCH,
  HUB_LOOK_STICK_YAW,
  HUB_MOUSE_PITCH,
  HUB_MOUSE_YAW,
  HUB_ORBIT_LOOK_LIFT,
  isHubOrbitActive,
  orbitEye,
  readOnFootLookStick,
  type OnFootHardware,
} from './hubOnFootControls';
import {
  FOOT_CHASE_CAMERA_NAME,
  getHubPossession,
  HUB_AVATAR_NAME,
  isHubActive,
} from './hubPossession';

export type OrbitInput = {
  hardware?: OnFootHardware;
};

const _eye = vec3.create();
const _look = vec3.create();
const _up = vec3.fromValues(0, 1, 0);
const _view = mat4.create();
const _inv = mat4.create();
const _rot = quat.create();

let mouseYaw = 0;
let mousePitch = 0;
let lookBound = false;

function findByName(world: World, name: string): Entity | null {
  for (const [entity, [nm]] of world.query<[NameComponent]>([NameComponent]).iter()) {
    if (nm.name === name) return entity;
  }
  return null;
}

function bindFreeLook(canvas: HTMLCanvasElement): void {
  if (lookBound || typeof window === 'undefined') return;
  lookBound = true;

  canvas.addEventListener('mousemove', (ev) => {
    if (!isHubActive() || getHubPossession() !== 'foot') return;
    const locked = document.pointerLockElement === canvas;
    const dragging = (ev.buttons & 1) !== 0 || (ev.buttons & 2) !== 0;
    if (!locked && !dragging) return;
    mouseYaw += ev.movementX * HUB_MOUSE_YAW;
    mousePitch += ev.movementY * HUB_MOUSE_PITCH;
  });

  canvas.addEventListener('pointerdown', () => {
    if (!isHubActive() || getHubPossession() !== 'foot') return;
    if (document.pointerLockElement === canvas) return;
    const lock = canvas.requestPointerLock?.();
    void lock?.catch(() => undefined);
  });

  // F est un geste utilisateur : le lock demandé depuis une frame est souvent refusé.
  window.addEventListener('keydown', (ev) => {
    if (ev.code !== 'KeyF') return;
    if (!isHubActive() || getHubPossession() === 'foot') return;
    if (document.pointerLockElement === canvas) return;
    const lock = canvas.requestPointerLock?.();
    void lock?.catch(() => undefined);
  });
}

function releasePointerLock(canvas: HTMLCanvasElement): void {
  if (typeof document === 'undefined') return;
  if (document.pointerLockElement !== canvas) return;
  document.exitPointerLock();
}

function placeOrbitCamera(
  camTf: TransformComponent,
  cam: CameraComponent,
  eye: readonly [number, number, number],
  look: readonly [number, number, number],
  canvas: HTMLCanvasElement
): void {
  vec3.set(_eye, eye[0], eye[1], eye[2]);
  vec3.set(_look, look[0], look[1], look[2]);
  mat4.lookAt(_view, _eye, _look, _up);
  mat4.invert(_inv, _view);
  mat4.getRotation(_rot, _inv);
  vec3.copy(camTf.position, _eye);
  quat.copy(camTf.rotation, _rot);
  camTf.updateLocalTransform();
  mat4.copy(camTf.worldTransform, camTf.localTransform);

  const w = canvas.width;
  const h = canvas.height;
  if (w > 0 && h > 0) cam.aspect = w / h;
  mat4.copy(cam.viewMatrix, _view);
  mat4.perspective(cam.projectionMatrix, cam.fov, Math.max(cam.aspect, 1e-4), cam.near, cam.far);
  mat4.multiply(cam.viewProjectionMatrix, cam.projectionMatrix, cam.viewMatrix);
}

export function createHubOrbitCameraSystem(
  canvas: HTMLCanvasElement,
  getInput: () => OrbitInput
): System {
  bindFreeLook(canvas);

  let wasActive = false;

  return function hubOrbitCameraSystem(world: World, dt: number): void {
    if (!isHubOrbitActive()) {
      if (wasActive) releasePointerLock(canvas);
      wasActive = false;
      mouseYaw = 0;
      mousePitch = 0;
      return;
    }
    wasActive = true;

    const avatar = findByName(world, HUB_AVATAR_NAME);
    const cameraId = findByName(world, FOOT_CHASE_CAMERA_NAME);
    if (avatar == null || cameraId == null) return;
    const avatarTf = world.getComponent(
      avatar,
      TransformComponent as unknown as ComponentClass<IComponent>
    ) as TransformComponent | undefined;
    const camTf = world.getComponent(
      cameraId,
      TransformComponent as unknown as ComponentClass<IComponent>
    ) as TransformComponent | undefined;
    const cam = world.getComponent(
      cameraId,
      CameraComponent as unknown as ComponentClass<IComponent>
    ) as CameraComponent | undefined;
    if (!avatarTf || !camTf || !cam) return;

    const stick = readOnFootLookStick(getInput().hardware ?? {});
    const step = Math.max(0, Math.min(0.05, dt));
    addHubOrbit(
      mouseYaw + stick.yaw * HUB_LOOK_STICK_YAW * step,
      mousePitch + stick.pitch * HUB_LOOK_STICK_PITCH * step
    );
    mouseYaw = 0;
    mousePitch = 0;

    const look: [number, number, number] = [
      avatarTf.position[0],
      avatarTf.position[1] + HUB_ORBIT_LOOK_LIFT,
      avatarTf.position[2],
    ];
    placeOrbitCamera(camTf, cam, orbitEye(look, getHubOrbitYaw(), getHubOrbitPitch()), look, canvas);
  };
}
