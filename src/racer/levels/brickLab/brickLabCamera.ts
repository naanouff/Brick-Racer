/**
 * @file brickLabCamera.ts
 * @description Face / Côté / Dessus presets for brick-lab (DC1a).
 *
 * Uses the live OrbitalCameraController. Writing the transform by hand is overwritten
 * the next frame and frames the 24 m ground instead of the landmark.
 */

import { vec3 } from 'gl-matrix';
import {
  OrbitalCameraController,
  type AxisViewId,
  type Engine,
} from '@naanouff/w3dts-core';

export type BrickLabView = 'orbit' | 'face' | 'side' | 'top';

export const BRICK_LAB_VIEWS: readonly BrickLabView[] = ['orbit', 'face', 'side', 'top'];

export const BRICK_LAB_CAMERA_NAME = 'BL_OrbitCamera';

/** Landmark at lab origin — excludes the 24 m ground slab. */
const FRAME_MIN = vec3.fromValues(-1.6, 0, -1.6);
const FRAME_MAX = vec3.fromValues(1.6, 2.2, 1.6);

const AXIS: Record<Exclude<BrickLabView, 'orbit'>, AxisViewId> = {
  face: 'posZ',
  side: 'posX',
  top: 'posY',
};

const TOP_FOCUS = vec3.fromValues(0, 1.1, 0);

export function brickLabViewLabel(view: BrickLabView): string {
  switch (view) {
    case 'orbit':
      return 'Cadrer';
    case 'face':
      return 'Face';
    case 'side':
      return 'Côté';
    case 'top':
      return 'Dessus';
  }
}

function orbital(engine: Engine): OrbitalCameraController | null {
  engine.setGameViewCameraPreference('orbital');
  const active = engine.cameraControllerManager.getActiveController();
  return active instanceof OrbitalCameraController ? active : null;
}

/**
 * LT2 — left-mouse camera mode for brick-lab tools.
 * `null` locks the view so brush / select own the left button.
 */
export function setBrickLabLeftMouseMode(
  engine: Engine,
  mode: 'rotate' | 'pan' | null
): boolean {
  const ctrl = orbital(engine);
  if (!ctrl) return false;
  ctrl.leftMouseMode = mode;
  return true;
}

/**
 * Face / Côté / Dessus are orthographic axis snaps.
 * Orbit is a perspective three-quarter frame. Both pivot on the landmark, not the ground.
 */
export function applyBrickLabView(engine: Engine, view: BrickLabView): boolean {
  const ctrl = orbital(engine);
  if (!ctrl) return false;

  const aabb = { min: FRAME_MIN, max: FRAME_MAX };

  if (view === 'orbit') {
    ctrl.setViewRollDegrees(0);
    ctrl.setProjectionMode('perspective');
    ctrl.frameBoundingBox(aabb, { immediate: true, resetViewAngles: true });
    return true;
  }

  ctrl.setProjectionMode('orthographic', { halfHeight: 2.2 });
  if (view === 'top') {
    // polar ≈ 0 makes lookAt's up axis parallel to the view and the frame blows up.
    ctrl.setTarget(TOP_FOCUS);
    ctrl.setOrbitAngles(0, 0.12, true);
    ctrl.setProjectionMode('orthographic', { halfHeight: 2.2 });
    return true;
  }
  ctrl.snapToAxisView(AXIS[view]);
  ctrl.frameBoundingBox(aabb, { immediate: true, resetViewAngles: false });
  ctrl.setProjectionMode('orthographic', { halfHeight: 2.2 });
  return true;
}
