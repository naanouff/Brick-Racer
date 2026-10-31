/**
 * @file catalogGhostYaw.test.ts
 * @description LT1 — brush ghost instance matrices honour yaw (box packing).
 */

import { describe, expect, it } from 'vitest';
import { packPreviewBoxInstance } from '../src/racer/hub/brick/catalog/spawnCatalogPreview';
import { packBrickInstanceData } from '../src/racer/hub/brick/brickInstanceData';
import { S } from '../src/racer/hub/brick/brickUnits';

describe('catalog ghost yaw (LT1)', () => {
  it('packPreviewBoxInstance at 90° rotates local X into ±Z', () => {
    const size: [number, number, number] = [2 * S, 0.33, 1 * S];
    const pos: [number, number, number] = [0, 0.165, 0];
    const at0 = packPreviewBoxInstance(pos, size, 0);
    const at90 = packPreviewBoxInstance(pos, size, Math.PI / 2);
    // T*R*S: col0 = R*(sx,0,0). At 0 → +X; at 90° yaw → ±Z.
    expect(Math.abs(at0[0]!)).toBeCloseTo(size[0], 5);
    expect(Math.abs(at0[2]!)).toBeCloseTo(0, 5);
    expect(Math.abs(at90[0]!)).toBeCloseTo(0, 5);
    expect(Math.abs(at90[2]!)).toBeCloseTo(size[0], 5);
  });

  it('packBrickInstanceData at 180° flips local X (m00 negative)', () => {
    const data = packBrickInstanceData([
      {
        partId: '3004',
        colorId: 'gray',
        position: [0, 0.165, 0],
        yaw: Math.PI,
      },
    ]);
    expect(data[0]!).toBeLessThan(0);
    expect(Math.abs(data[2]!)).toBeCloseTo(0, 4);
  });
});
