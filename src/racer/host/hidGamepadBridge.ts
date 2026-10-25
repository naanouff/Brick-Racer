/**
 * @file hidGamepadBridge.ts
 * @description Arcade drive axes (MK/DKR + plane climb) + optional HID poll into InputManager.
 */

import type { Engine } from '@naanouff/w3dts-core';
import * as W3dtsInput from '@naanouff/w3dts-input';
import {
  ARCADE_MK_OVERRIDES_JSON,
  resolveMkMoveForward,
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
  resolveFromHardware: () => void;
  enableMap: (mapId: string) => void;
  applyInputOverridesJson: (raw: string) => void;
  __brickRacerHidGamepad?: boolean;
};

function readLivePadSlots(slotCount: number): (GamepadSlotSnapshot | null)[] {
  const slots: (GamepadSlotSnapshot | null)[] = [];
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
    for (let i = 0; i < slotCount; i++) slots.push(null);
    return slots;
  }
  const live = navigator.getGamepads();
  for (let i = 0; i < slotCount; i++) {
    const pad = live[i];
    if (!pad || !pad.connected) {
      slots.push(null);
      continue;
    }
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
    slots.push({
      connected: true,
      id: pad.id,
      mapping: pad.mapping,
      buttons,
      axes,
    });
  }
  return slots;
}

function pollGamepadsIntoHardware(
  hardware: HardwareSnapshot,
  pkg: Required<Pick<InputPkg, 'GAMEPAD_SLOT_COUNT' | 'writeGamepadHardware' | 'clearGamepadHardware'>>
): void {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
    pkg.clearGamepadHardware(hardware);
    return;
  }
  pkg.writeGamepadHardware(hardware, readLivePadSlots(pkg.GAMEPAD_SLOT_COUNT));
}

function hardwareForAxes(im: InputManagerHw, hidPolled: boolean): HardwareLike {
  if (hidPolled) return im.hardware as HardwareLike;
  // npm input: no gamepads on snapshot — sample navigator for A/B + stick Y.
  return {
    keysDown: im.hardware.keysDown,
    gamepads: readLivePadSlots(4),
  };
}

/**
 * Install MK/DKR axes + plane climb. Polls HID into InputManager when mono input is linked.
 * Idempotent.
 */
export function installHidGamepadBridge(engine: Engine): boolean {
  const im = engine.inputManager as unknown as InputManagerHw;
  if (!im?.hardware || typeof im.resolveFromHardware !== 'function') return false;
  if (im.__brickRacerHidGamepad) return true;
  im.__brickRacerHidGamepad = true;

  const pkg = W3dtsInput as InputPkg;
  const canPollHid =
    typeof pkg.GAMEPAD_SLOT_COUNT === 'number' &&
    typeof pkg.writeGamepadHardware === 'function' &&
    typeof pkg.clearGamepadHardware === 'function';

  const apis = canPollHid
    ? {
        GAMEPAD_SLOT_COUNT: pkg.GAMEPAD_SLOT_COUNT!,
        writeGamepadHardware: pkg.writeGamepadHardware!,
        clearGamepadHardware: pkg.clearGamepadHardware!,
      }
    : null;

  const original = im.resolveFromHardware.bind(engine.inputManager);
  im.resolveFromHardware = () => {
    if (apis) pollGamepadsIntoHardware(im.hardware, apis);
    original();
    if (im.axes && typeof im.axes.set === 'function') {
      const hw = hardwareForAxes(im, apis != null);
      im.axes.set('moveForward', resolveMkMoveForward(hw));
      im.axes.set('climb', resolvePlaneClimb(hw));
      im.axes.set('rollSnap', resolvePlaneRollSnap(hw));
    }
  };

  im.enableMap('gameplay');
  try {
    im.applyInputOverridesJson(ARCADE_MK_OVERRIDES_JSON);
  } catch {
    // npm asset may lack some actions — axes patch still applies
  }

  if (typeof window !== 'undefined') {
    const kick = (): void => {
      im.resolveFromHardware();
    };
    window.addEventListener('gamepadconnected', kick);
    window.addEventListener('gamepaddisconnected', kick);
  }

  return true;
}
