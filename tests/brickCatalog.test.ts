import { describe, expect, it } from 'vitest';
import {
  B,
  BRICK_INSTANCE_STRIDE_F,
  BRICK_PART_IDS,
  S,
  buildFountainBrickPoses,
  countBrickBatches,
  countBrickInstances,
  groupBrickPoses,
  packBrickInstanceData,
  partSizeMeters,
  snapStud,
} from '../src/racer/hub/brick';

describe('brickUnits', () => {
  it('uses canon 0.33 stud module', () => {
    expect(S).toBeCloseTo(0.33);
    expect(B).toBeCloseTo(S);
    expect(snapStud(0.5)).toBeCloseTo(0.66);
  });
});

describe('brickCatalog', () => {
  it('exposes at least 5 part types with positive sizes', () => {
    expect(BRICK_PART_IDS.length).toBeGreaterThanOrEqual(5);
    for (const id of BRICK_PART_IDS) {
      const [sx, sy, sz] = partSizeMeters(id);
      expect(sx).toBeGreaterThan(0);
      expect(sy).toBeGreaterThan(0);
      expect(sz).toBeGreaterThan(0);
    }
  });

  it('groups poses into part×color batches', () => {
    const poses = buildFountainBrickPoses();
    expect(countBrickInstances(poses)).toBe(poses.length);
    expect(countBrickBatches(poses)).toBe(groupBrickPoses(poses).size);
    expect(countBrickBatches(poses)).toBeGreaterThan(1);
  });
});

describe('brickInstanceData', () => {
  it('packs 36 floats per instance', () => {
    const poses = buildFountainBrickPoses().slice(0, 3);
    const data = packBrickInstanceData(poses);
    expect(data.length).toBe(poses.length * BRICK_INSTANCE_STRIDE_F);
  });
});

describe('fountainKit', () => {
  it('stays inside the 3×2×3 BOM fountain envelope around (20,1,20)', () => {
    const poses = buildFountainBrickPoses();
    expect(poses.length).toBeGreaterThan(8);
    for (const p of poses) {
      const [sx, sy, sz] = partSizeMeters(p.partId);
      expect(p.position[0] - sx / 2).toBeGreaterThanOrEqual(20 - 1.65);
      expect(p.position[0] + sx / 2).toBeLessThanOrEqual(20 + 1.65);
      expect(p.position[2] - sz / 2).toBeGreaterThanOrEqual(20 - 1.65);
      expect(p.position[2] + sz / 2).toBeLessThanOrEqual(20 + 1.65);
      expect(p.position[1] - sy / 2).toBeGreaterThanOrEqual(-0.05);
      expect(p.position[1] + sy / 2).toBeLessThanOrEqual(2.15);
    }
  });

  it('reads as BOM gray stone + cyan water', () => {
    const poses = buildFountainBrickPoses();
    const gray = poses.filter((p) => p.colorId === 'gray').length;
    const cyan = poses.filter((p) => p.colorId === 'cyan').length;
    expect(cyan).toBeGreaterThan(2);
    expect(gray).toBeGreaterThan(5);
  });
});
