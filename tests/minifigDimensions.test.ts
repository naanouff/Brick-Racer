/**
 * @file minifigDimensions.test.ts
 * @description Gabarit cotes + pivots (BRICK-MF2a).
 */

import { describe, expect, it } from 'vitest';
import {
  MINIFIG_TOTAL_HEIGHT,
  computePivots,
  layoutY,
  TORSO,
  HEAD,
} from '../src/racer/minifig/dimensions';
import { ARM_LATERAL, MINIFIG_PIVOTS, MINIFIG_SOCKETS } from '../src/racer/minifig/sockets';

describe('minifig dimensions', () => {
  it('keeps total height near the 2.1 target', () => {
    const y = layoutY();
    expect(y.totalHeight).toBeGreaterThan(1.9);
    expect(y.totalHeight).toBeLessThan(2.4);
    expect(MINIFIG_TOTAL_HEIGHT).toBe(2.1);
  });

  it('places head above torso and torso above hips', () => {
    const y = layoutY();
    expect(y.headCenter).toBeGreaterThan(y.torsoCenter);
    expect(y.torsoCenter).toBeGreaterThan(y.hipsCenter);
    expect(y.hipsCenter).toBeGreaterThan(0);
  });

  it('has a narrower torso top than bottom', () => {
    expect(TORSO.widthTop).toBeLessThan(TORSO.widthBottom);
  });

  it('derives sockets from pivots', () => {
    const p = computePivots();
    expect(MINIFIG_SOCKETS.head[1]).toBeCloseTo(p.head[1], 5);
    expect(MINIFIG_PIVOTS.shoulderR[0]).toBeGreaterThan(0);
    expect(MINIFIG_PIVOTS.shoulderL[0]).toBeLessThan(0);
    expect(ARM_LATERAL).toBe(p.armLateral);
    expect(HEAD.radius).toBeGreaterThan(0);
  });
});
