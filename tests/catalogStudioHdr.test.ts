import { describe, expect, it } from 'vitest';
import { HDRLoader } from '@naanouff/w3dts-loader-hdr';
import { buildCatalogStudioHdr } from '../src/racer/levels/catalogLab/catalogStudioHdr';

describe('catalog studio HDR', () => {
  it('puts a hard sun in the sky and keeps the ground dim', () => {
    const hdr = HDRLoader.parse(buildCatalogStudioHdr());
    expect(hdr.width).toBe(256);
    expect(hdr.height).toBe(128);
    const at = (u: number, v: number) => {
      const x = Math.min(hdr.width - 1, Math.floor(u * hdr.width));
      const y = Math.min(hdr.height - 1, Math.floor(v * hdr.height));
      const o = (y * hdr.width + x) * 4;
      return hdr.data[o]! + hdr.data[o + 1]! + hdr.data[o + 2]!;
    };
    const sun = at(0.136, 0.178);
    const sky = at(0.5, 0.08);
    const ground = at(0.5, 0.85);
    expect(sun).toBeGreaterThan(sky * 8);
    expect(sky).toBeGreaterThan(ground * 3);
  });
});