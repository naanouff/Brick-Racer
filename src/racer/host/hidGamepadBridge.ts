/**
 * @file hidGamepadBridge.ts
 * @description Arcade drive axes (MK/DKR + plane) + HID poll into InputManager.
 *
 * npm `@naanouff/w3dts-core@0.0.37` / `input@0.0.21` do not resolve gamepad bindings.
 * We stamp `navigator.getGamepads()` onto the hardware snapshot every frame and
 * overwrite the axes / actions the race + hub systems actually read.
 */

import type { Engine } from '@naanouff/w3dts-core';
import * as W3dtsInput from '@naanouff/w3dts-input';
import {
  ARCADE_MK_OVERRIDES_JSON,
  resolveMkJumpHeld,
  resolveMkMoveForward,
  resolveMkMoveRight,
  resolveMkResetHeld,
  resolvePlaneClimb,
  resolvePlaneRollSnap,
  type HardwareLike,
} from './arcadeMkDriveInput';

type HardwareSnapshot = {
  gamepads?: unknown;
  keysDown?: { has(key: string): boolean };
  [key: string]: unknown;
};

type GamepadSlotSnapshot = {
  connected: true;
  id: string;
  mapping: string;
  buttons: { pressed: boolean; value: number }[];
  axes: number[];
};

type InputPkg = {
  GAMEPAD_SLOT_COUNT?: number;
  writeGamepadHardware?: (
    snapshot: HardwareSnapshot,
    slots: readonly (GamepadSlotSnapshot | null | undefined)[]
  ) => void;
  clearGamepadHardware?: (snapshot: HardwareSnapshot) => void;
};

type InputManagerHw = {
  hardware: HardwareSnapshot;
  axes: Map<string, number>;
  actions: Map<string, boolean>;
  resolveFromHardware: () => void;
  enableMap: (mapId: string) => void;
  applyInputOverridesJson: (raw: string) => void;
  getElement?: () => EventTarget | null;
  __brickRacerHidGamepad?: boolean;
};

/** Copy one live Gamepad into a plain snapshot (no live object refs). */
export function snapshotLivePad(pad: Gamepad): GamepadSlotSnapshot {
  const buttons: { pressed: boolean; value: number }[] = [];
  for (let b = 0; b < pad.buttons.length; b++) {
    const btn = pad.buttons[b];
    buttons.push({
      pressed: btn?.pressed === true,
      value: typeof btn?.value === 'number' ? btn.value : 0,
    });
  }
  const axes: number[] = [];
  for (let a = 0; a < pad.axes.length; a++) {
    const v = pad.axes[a];
    axes.push(typeof v === 'number' ? v : 0);
  }
  return {
    connected: true,
    id: pad.id,
    mapping: pad.mapping || 'standard',
    buttons,
    axes,
  };
}

/**
 * Poll `navigator.getGamepads()` into a fixed-length slot list.
 * The first connected pad is always compacted into slot 0 so MK/hub resolvers
 * (`gamepads[0]`) keep working when Chromium exposes the pad at a higher index.
 */
export function readLivePadSlots(slotCount: number): (GamepadSlotSnapshot | null)[] {
  const slots: (GamepadSlotSnapshot | null)[] = [];
  for (let i = 0; i < slotCount; i++) slots.push(null);

  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
    return slots;
  }

  const live = navigator.getGamepads();
  let first: GamepadSlotSnapshot | null = null;
  for (let i = 0; i < live.length; i++) {
    const pad = live[i];
    if (!pad || !pad.connected) continue;
    const snap = snapshotLivePad(pad);
    if (!first) first = snap;
    if (i < slotCount) slots[i] = snap;
  }
  if (first && !slots[0]) slots[0] = first;
  return slots;
}

/**
 * Always attach live pads on the snapshot (hub + MK resolvers read `hardware.gamepads`).
 * Prefers mono `writeGamepadHardware` when available.
 */
function stampGamepadsOnHardware(hardware: HardwareSnapshot, pkg: InputPkg): void {
  const slotCount = typeof pkg.GAMEPAD_SLOT_COUNT === 'number' ? pkg.GAMEPAD_SLOT_COUNT : 4;
  const slots = readLivePadSlots(slotCount);
  if (typeof pkg.writeGamepadHardware === 'function') {
    pkg.writeGamepadHardware(hardware, slots);
    return;
  }
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
    delete hardware.gamepads;
    return;
  }
  hardware.gamepads = slots;
}

function applyMkAxesAndActions(im: InputManagerHw): void {
  const hw = im.hardware as HardwareLike;
  if (im.axes && typeof im.axes.set === 'function') {
    im.axes.set('moveForward', resolveMkMoveForward(hw));
    im.axes.set('moveRight', resolveMkMoveRight(hw));
    im.axes.set('climb', resolvePlaneClimb(hw));
    im.axes.set('rollSnap', resolvePlaneRollSnap(hw));
  }
  if (im.actions && typeof im.actions.set === 'function') {
    // npm resolve drops gamepad bindings — force race actions from the live pad.
    if (resolveMkJumpHeld(hw)) im.actions.set('jump', true);
    if (resolveMkResetHeld(hw)) im.actions.set('resetKart', true);
  }
}

/**
 * Install MK/DKR axes + plane climb + pad actions. Idempotent.
 */
export function installHidGamepadBridge(engine: Engine): boolean {
  const im = engine.inputManager as unknown as InputManagerHw;
  if (!im?.hardware || typeof im.resolveFromHardware !== 'function') return false;
  if (im.__brickRacerHidGamepad) return true;
  im.__brickRacerHidGamepad = true;

  const pkg = W3dtsInput as InputPkg;

  const original = im.resolveFromHardware.bind(engine.inputManager);
  im.resolveFromHardware = () => {
    // Stamp before resolve so npm inputRuntime (if it ever learns gamepad kinds) sees pads.
    stampGamepadsOnHardware(im.hardware, pkg);
    original();
    // Re-stamp after: npm resolve must not leave us without `hardware.gamepads`.
    stampGamepadsOnHardware(im.hardware, pkg);
    applyMkAxesAndActions(im);
  };

  im.enableMap('gameplay');
  try {
    im.applyInputOverridesJson(ARCADE_MK_OVERRIDES_JSON);
  } catch {
    // npm asset may lack some actions — axes / action patch still apply
  }

  if (typeof window !== 'undefined') {
    const kick = (): void => {
      im.resolveFromHardware();
    };
    window.addEventListener('gamepadconnected', kick);
    window.addEventListener('gamepaddisconnected', kick);
    // Chromium often reports empty slots until a button is pressed; re-poll on focus.
    window.addEventListener('focus', kick);
    document.addEventListener('visibilitychange', kick);

    // First click / pointer on the input canvas is the usual user-gesture that
    // unlocks `getGamepads()` after a reload.
    const el = typeof im.getElement === 'function' ? im.getElement() : null;
    const target = el instanceof HTMLElement ? el : engine.webGPUContext?.canvas;
    if (target) {
      target.addEventListener('pointerdown', kick, { passive: true });
    }
  }

  // Ensure scripts / mono physics see Play (not editor Stop).
  (
    globalThis as unknown as { __W3DTS_SCRIPT_PLAY_STATE__?: 'playing' | 'paused' | 'stopped' }
  ).__W3DTS_SCRIPT_PLAY_STATE__ = 'playing';

  return true;
}
