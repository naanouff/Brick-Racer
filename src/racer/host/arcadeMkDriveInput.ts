/**
 * @file arcadeMkDriveInput.ts
 * @description Mario Kart / DKR–style drive + plane stick / knife-edge axes.
 *
 * Kart: A accel, B brake/reverse, L1/R1 drift. Stick X = steer; stick Y unused.
 * Plane: A/B thrust, stick X bank, stick Y pitch, L1/R1 (C/V) knife-edge ±90°.
 */

/** W3C standard mapping indices. */
export const GP = {
  A: 0,
  B: 1,
  L1: 4,
  R1: 5,
  Select: 8,
  /** Left stick Y. */
  AxisLY: 1,
} as const;

const STICK_DEAD_ZONE = 0.15;

type KeysLike = { has(key: string): boolean } | undefined;

type PadButton = { pressed?: boolean; value?: number } | undefined;

type PadLike = {
  connected?: boolean;
  buttons?: readonly PadButton[];
  axes?: readonly number[];
} | null;

export type HardwareLike = {
  keysDown?: KeysLike;
  gamepads?: readonly (PadLike | null | undefined)[] | undefined;
};

function buttonDown(pad: PadLike, index: number): boolean {
  if (!pad?.buttons) return false;
  const b = pad.buttons[index];
  if (!b) return false;
  if (b.pressed === true) return true;
  return typeof b.value === 'number' && b.value >= 0.5;
}

function mergeAbs(current: number, next: number): number {
  return Math.abs(next) >= Math.abs(current) ? next : current;
}

function clampAxis(v: number): number {
  if (v > 1) return 1;
  if (v < -1) return -1;
  return v;
}

/**
 * Throttle in [-1, 1]: WASD/ZQSD + pad A/B (not stick Y).
 */
export function resolveMkMoveForward(hardware: HardwareLike): number {
  let v = 0;
  const keys = hardware.keysDown;
  if (keys) {
    if (keys.has('w') || keys.has('z')) v += 1;
    if (keys.has('s')) v -= 1;
  }
  const pad = hardware.gamepads?.[0] ?? null;
  if (pad && pad.connected !== false) {
    if (buttonDown(pad, GP.A)) v = mergeAbs(v, 1);
    if (buttonDown(pad, GP.B)) v = mergeAbs(v, -1);
  }
  return clampAxis(v);
}

/**
 * Steer in [-1, 1]: A/Q / D + left stick X.
 * npm InputManager has no gamepad bindings — bridge must set this axis.
 */
export function resolveMkMoveRight(hardware: HardwareLike): number {
  let v = 0;
  const keys = hardware.keysDown;
  if (keys) {
    if (keys.has('d')) v += 1;
    if (keys.has('a') || keys.has('q')) v -= 1;
  }
  const pad = hardware.gamepads?.[0] ?? null;
  if (pad && pad.connected !== false && pad.axes) {
    let lx = pad.axes[0] ?? 0;
    if (typeof lx !== 'number' || Number.isNaN(lx)) lx = 0;
    if (Math.abs(lx) >= STICK_DEAD_ZONE) {
      v = mergeAbs(v, clampAxis(lx));
    }
  }
  return clampAxis(v);
}

/** Drift / jump: Space or L1 / R1. */
export function resolveMkJumpHeld(hardware: HardwareLike): boolean {
  const keys = hardware.keysDown;
  if (keys?.has(' ')) return true;
  const pad = hardware.gamepads?.[0] ?? null;
  if (!pad || pad.connected === false) return false;
  return buttonDown(pad, GP.L1) || buttonDown(pad, GP.R1);
}

/** Reset: X or Select. */
export function resolveMkResetHeld(hardware: HardwareLike): boolean {
  const keys = hardware.keysDown;
  if (keys?.has('x')) return true;
  const pad = hardware.gamepads?.[0] ?? null;
  if (!pad || pad.connected === false) return false;
  return buttonDown(pad, GP.Select);
}

/**
 * Pitch / climb in [-1, 1]: Space/Shift + left stick Y (up = nose up).
 * Does not use L1/R1 so knife-edge stays on `rollSnap`.
 */
export function resolvePlaneClimb(hardware: HardwareLike): number {
  let v = 0;
  const keys = hardware.keysDown;
  if (keys) {
    if (keys.has(' ')) v += 1;
    if (keys.has('shift')) v -= 1;
  }
  const pad = hardware.gamepads?.[0] ?? null;
  if (pad && pad.connected !== false && pad.axes) {
    let ly = pad.axes[GP.AxisLY] ?? 0;
    if (typeof ly !== 'number' || Number.isNaN(ly)) ly = 0;
    // Standard: stick up = negative Y → invert for positive climb.
    if (Math.abs(ly) >= STICK_DEAD_ZONE) {
      v = mergeAbs(v, clampAxis(-ly));
    }
  }
  return clampAxis(v);
}

/**
 * Knife-edge roll snap: −1 = L1 / C (aile gauche basse), +1 = R1 / V.
 */
export function resolvePlaneRollSnap(hardware: HardwareLike): number {
  const keys = hardware.keysDown;
  if (keys?.has('c')) return -1;
  if (keys?.has('v')) return 1;
  const pad = hardware.gamepads?.[0] ?? null;
  if (pad && pad.connected !== false) {
    const l = buttonDown(pad, GP.L1);
    const r = buttonDown(pad, GP.R1);
    if (l && !r) return -1;
    if (r && !l) return 1;
  }
  return 0;
}



/**
 * Overrides on default `gameplay` map (existing action ids only — merge cannot add).
 * Drift = Space / L1 / R1 (`jump`). Sprint loses LB so it does not fight drift.
 */
export const ARCADE_MK_OVERRIDES_JSON = JSON.stringify({
  version: 1,
  maps: {
    gameplay: {
      actions: {
        jump: {
          type: 'button',
          bindings: [
            { kind: 'key', key: ' ' },
            { kind: 'gamepadButton', button: GP.L1 },
            { kind: 'gamepadButton', button: GP.R1 },
          ],
        },
        sprint: {
          type: 'button',
          bindings: [{ kind: 'key', key: 'shift' }],
        },
        resetKart: {
          type: 'button',
          bindings: [
            { kind: 'key', key: 'x' },
            { kind: 'gamepadButton', button: GP.Select },
          ],
        },
      },
    },
  },
});
