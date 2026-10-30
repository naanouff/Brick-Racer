import { afterEach, describe, expect, it, vi } from 'vitest';
import { readLivePadSlots } from '../src/racer/host/hidGamepadBridge';

function fakePad(id: string, indexHint = 0): Gamepad {
  return {
    id,
    index: indexHint,
    connected: true,
    mapping: 'standard',
    axes: [0.4, 0, 0, 0],
    buttons: [{ pressed: true, value: 1 }],
    timestamp: 0,
    hapticActuators: [],
    vibrationActuator: null,
  } as unknown as Gamepad;
}

describe('readLivePadSlots', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('compacts a pad exposed at index 2 into slot 0', () => {
    const pad = fakePad('pad-2', 2);
    vi.stubGlobal('navigator', {
      getGamepads: () => [null, null, pad] as (Gamepad | null)[],
    });
    const slots = readLivePadSlots(4);
    expect(slots[0]?.id).toBe('pad-2');
    expect(slots[0]?.axes[0]).toBe(0.4);
    expect(slots[2]?.id).toBe('pad-2');
  });

  it('keeps an empty list when nothing is connected', () => {
    vi.stubGlobal('navigator', {
      getGamepads: () => [null, null, null, null] as (Gamepad | null)[],
    });
    expect(readLivePadSlots(4)).toEqual([null, null, null, null]);
  });
});
