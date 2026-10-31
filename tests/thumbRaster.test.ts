import { describe, expect, it } from 'vitest';
import {
  footprintBoxMesh,
  projectThumbPoints,
  rasterizePartThumb,
} from '../src/racer/hub/brick/catalog/thumbRaster';

function opaqueCount(data: Uint8ClampedArray): number {
  let n = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] === 255) n++;
  return n;
}

describe('rasterizePartThumb', () => {
  it('renders a 2x4 brick box into a framed, shaded thumbnail', () => {
    const { vertices, indices } = footprintBoxMesh([2, 3, 4]);
    const img = rasterizePartThumb(vertices, indices, { size: 64 });
    expect(img).not.toBeNull();
    expect(img!.width).toBe(64);
    const covered = opaqueCount(img!.data);
    expect(covered).toBeGreaterThan(64 * 64 * 0.2);
    expect(covered).toBeLessThan(64 * 64 * 0.95);
    expect(img!.data[3]).toBe(0);
    const shades = new Set<number>();
    for (let i = 0; i < img!.data.length; i += 4) {
      if (img!.data[i + 3] === 255) shades.add(img!.data[i]!);
    }
    expect(shades.size).toBeGreaterThanOrEqual(3);
  });

  it('keeps world +Y toward the top of the image (not upside-down)', () => {
    const [ground, top] = projectThumbPoints(
      [
        [0, 0, 0],
        [0, 1, 0],
      ],
      64
    );
    expect(top!.y).toBeLessThan(ground!.y);
  });

  it('returns null for an empty mesh', () => {
    expect(rasterizePartThumb(new Float32Array(0), new Uint32Array(0))).toBeNull();
  });
});
