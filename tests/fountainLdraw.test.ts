/**
 * @file fountainLdraw.test.ts
 * @description Wide park fountain at native LDraw scale.
 */

import { describe, expect, it } from 'vitest';
import { P } from '../src/racer/hub/brick/brickUnits';
import {
  FOUNTAIN_LDRAW_PARTS,
  fountainLdrawGamePose,
  fountainLdrawIds,
} from '../src/racer/hub/brick/landmark/fountainLdraw';

const byRole = (role: string) => FOUNTAIN_LDRAW_PARTS.filter((p) => p.role === role);

describe('fountain LDraw assembly', () => {
  it('builds the wide basin: lip, tan and gray rim, flowers, bottle jets, dolphin', () => {
    expect(fountainLdrawIds()).toEqual(
      ['13392', '3004', '3023', '32607', '33291', '37352', '3941', '3960', '60474', '6141', '6177', '95228', '98138'].sort()
    );
    expect(byRole('base').some((p) => p.ldrawId === '6177')).toBe(true);
    expect(byRole('wall').filter((p) => p.colorId === 'sand').length).toBe(6);
    expect(byRole('wall').filter((p) => p.ldrawId === '37352').length).toBe(6);
    expect(byRole('flower').map((p) => p.colorId).sort()).toEqual(
      ['green', 'green', 'green', 'green', 'red', 'red', 'yellow', 'yellow'].sort()
    );
    expect(byRole('jet')).toHaveLength(6);
    expect(byRole('jet').every((p) => p.ldrawId === '95228' && p.lean)).toBe(true);
    expect(byRole('ornament').some((p) => p.ldrawId === '13392')).toBe(true);
    expect(byRole('basin')[0]?.euler?.x).toBe(180);
    expect(byRole('water').length).toBeGreaterThan(20);
  });

  it('sits the floor on y=0 and stays inside the plaza collider', () => {
    const base = fountainLdrawGamePose(byRole('base').find((p) => p.ldrawId === '6177')!);
    expect(base.position[1]).toBeCloseTo(P, 5);
    for (const part of FOUNTAIN_LDRAW_PARTS) {
      const g = fountainLdrawGamePose(part, [20, 0, 20]);
      expect(Math.hypot(g.position[0] - 20, g.position[2] - 20)).toBeLessThan(2.6);
      expect(g.position[1]).toBeGreaterThanOrEqual(0);
      expect(g.position[1]).toBeLessThanOrEqual(2);
    }
  });

  it('leans each jet away from the column', () => {
    for (const jet of byRole('jet')) {
      const g = fountainLdrawGamePose(jet);
      const [lx, , lz] = jet.ldu;
      const outwardX = lx;
      const outwardZ = -lz;
      const up = g.rotation;
      // Neck direction is the quaternion applied to +Y.
      const [x, y, z, w] = up;
      const neckX = 2 * (x * y - w * z);
      const neckZ = 2 * (y * z + w * x);
      const dot = neckX * outwardX + neckZ * outwardZ;
      expect(dot).toBeGreaterThan(0);
    }
  });
});
