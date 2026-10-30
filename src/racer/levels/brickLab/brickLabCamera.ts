/**
 * @file brickLabCamera.ts
 * @description Ortho Face / Côté / Dessus presets for brick-lab fidelity checks (DC1a).
 */

import { mat4, quat, vec3 } from 'gl-matrix';
import {
  CameraComponent,
  GameCameraControllerComponent,
  NameComponent,
  TransformComponent,
  type Engine,
  type Entity,
} from '@naanouff/w3dts-core';

export type BrickLabView = 'orbit' | 'face' | 'side' | 'top';

export const BRICK_LAB_VIEWS: readonly BrickLabView[] = ['orbit', 'face', 'side', 'top'];

export const BRICK_LAB_CAMERA_NAME = 'BL_OrbitCamera';

const ORBIT_EYE: readonly [number, number, number] = [5.5, 3.2, 7.5];
/** Framing a ~3 m landmark at origin. */
const ORTHO_HALF_HEIGHT = 2.2;
const LOOK: readonly [number, number, number] = [0, 0.9, 0];

const _eye = vec3.create();
const _look = vec3.create();
const _up = vec3.fromValues(0, 1, 0);
const _upTop = vec3.fromValues(0, 0, -1);
const _view = mat4.create();
const _inv = mat4.create();
const _rot = quat.create();

function findByName(engine: Engine, name: string): Entity | null {
  const world = engine.ecsWorld;
  for (const [entity, [n]] of world.query<[NameComponent]>([NameComponent]).iter()) {
    if (n.name === name) return entity;
  }
  return null;
}

function placeLookAt(
  camTf: TransformComponent,
  eye: readonly [number, number, number],
  look: readonly [number, number, number],
  up: vec3
): void {
  vec3.set(_eye, eye[0], eye[1], eye[2]);
  vec3.set(_look, look[0], look[1], look[2]);
  mat4.lookAt(_view, _eye, _look, up);
  mat4.invert(_inv, _view);
  mat4.getRotation(_rot, _inv);
  vec3.copy(camTf.position, _eye);
  quat.copy(camTf.rotation, _rot);
  camTf.updateLocalTransform();
  mat4.copy(camTf.worldTransform, camTf.localTransform);
}

export function brickLabViewLabel(view: BrickLabView): string {
  switch (view) {
    case 'orbit':
      return 'Orbit';
    case 'face':
      return 'Face';
    case 'side':
      return 'Côté';
    case 'top':
      return 'Dessus';
  }
}

/**
 * Apply a brick-lab camera preset. Ortho views freeze the controller (`none`);
 * `orbit` restores perspective + orbital drag.
 */
export function applyBrickLabView(engine: Engine, view: BrickLabView): boolean {
  const camEntity = findByName(engine, BRICK_LAB_CAMERA_NAME);
  if (camEntity === null) return false;
  const world = engine.ecsWorld;
  const camera = world.getComponent(camEntity, CameraComponent);
  const transform = world.getComponent(camEntity, TransformComponent);
  const ctrl = world.getComponent(camEntity, GameCameraControllerComponent);
  if (!camera || !transform) return false;

  const canvas = engine.webGPUContext.canvas;
  if (canvas.width > 0 && canvas.height > 0) {
    camera.aspect = canvas.width / canvas.height;
  }

  if (view === 'orbit') {
    camera.projectionMode = 'perspective';
    placeLookAt(transform, ORBIT_EYE, LOOK, _up);
    if (ctrl) ctrl.mode = 'orbital';
    engine.setGameViewCameraPreference('orbital');
    return true;
  }

  camera.projectionMode = 'orthographic';
  camera.orthographicHalfHeight = ORTHO_HALF_HEIGHT;
  if (ctrl) ctrl.mode = 'none';

  switch (view) {
    case 'face':
      placeLookAt(transform, [0, LOOK[1], 9], LOOK, _up);
      break;
    case 'side':
      placeLookAt(transform, [9, LOOK[1], 0], LOOK, _up);
      break;
    case 'top':
      placeLookAt(transform, [0, 14, 0], [0, 0, 0], _upTop);
      break;
  }
  return true;
}
