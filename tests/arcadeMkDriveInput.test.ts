import { describe, expect, it } from 'vitest';
import {
  GP,
  resolveMkMoveForward,
  resolvePlaneClimb,
} from '../src/racer/host/arcadeMkDriveInput';

function keys(...list: string[]) {
  return new Set(list);
}

function pad(opts: {
  buttons?: { pressed?: boolean; value?: number }[];
  axes?: number[];
}) {
  return {
    connected: true as const,
    buttons: opts.buttons,
    axes: opts.axes,
  };
}

describe('resolveMkMoveForward', () => {
  it('uses WASD / ZQSD', () => {
    expect(resolveMkMoveForward({ keysDown: keys('w') })).toBe(1);
    expect(resolveMkMoveForward({ keysDown: keys('z') })).toBe(1);
    expect(resolveMkMoveForward({ keysDown: keys('s') })).toBe(-1);
    expect(resolveMkMoveForward({ keysDown: keys('w', 's') })).toBe(0);
  });

  it('uses A to accelerate and B to brake/reverse', () => {
    const buttons = Array.from({ length: 10 }, () => ({ pressed: false, value: 0 }));
    buttons[GP.A] = { pressed: true, value: 1 };
    expect(resolveMkMoveForward({ gamepads: [pad({ buttons })] })).toBe(1);

    buttons[GP.A] = { pressed: false, value: 0 };
    buttons[GP.B] = { pressed: true, value: 1 };
    expect(resolveMkMoveForward({ gamepads: [pad({ buttons })] })).toBe(-1);
  });

  it('ignores missing pad / empty hardware', () => {
    expect(resolveMkMoveForward({})).toBe(0);
    expect(resolveMkMoveForward({ gamepads: [null] })).toBe(0);
  });
});

describe('resolvePlaneClimb', () => {
  it('uses Space / Shift', () => {
    expect(resolvePlaneClimb({ keysDown: keys(' ') })).toBe(1);
    expect(resolvePlaneClimb({ keysDown: keys('shift') })).toBe(-1);
  });

  it('uses left stick Y (up = climb)', () => {
    expect(resolvePlaneClimb({ gamepads: [pad({ axes: [0, -0.8] })] })).toBe(0.8);
    expect(resolvePlaneClimb({ gamepads: [pad({ axes: [0, 0.6] })] })).toBe(-0.6);
    expect(resolvePlaneClimb({ gamepads: [pad({ axes: [0, 0.05] })] })).toBe(0);
  });
});
