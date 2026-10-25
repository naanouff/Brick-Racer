import { describe, expect, it } from 'vitest';
import { isW3dtsMonoAvailable } from '../w3dtsMonoAliases';

describe('hid gamepad mono input', () => {
  it.skipIf(!isW3dtsMonoAvailable())('exports writeGamepadHardware from aliased input', async () => {
    const input = await import('@naanouff/w3dts-input');
    expect(typeof input.writeGamepadHardware).toBe('function');
    expect(typeof input.GAMEPAD_SLOT_COUNT).toBe('number');
    expect(input.GAMEPAD_SLOT_COUNT).toBeGreaterThanOrEqual(4);
  });

  it.skipIf(isW3dtsMonoAvailable())('npm input without mono has no HID helpers (CI)', async () => {
    const input = (await import('@naanouff/w3dts-input')) as {
      writeGamepadHardware?: unknown;
    };
    expect(input.writeGamepadHardware).toBeUndefined();
  });
});
