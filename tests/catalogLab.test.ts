/**
 * @file catalogLab.test.ts
 * @description CL1 helpers: footprint, staging merge, registry.
 */

import { describe, expect, it } from 'vitest';
import {
  footprintFromMasterDims,
  guessPartCategory,
  mergePartsJson,
  type StagingPart,
} from '../src/racer/hub/brick/catalog';
import type { BrickPartDef } from '../src/racer/hub/brick/catalog/types';
import {
  LEVEL_IDS,
  getLevelSpec,
  isLevelId,
  levelLabel,
  resolveLevelIdFromSearch,
} from '../src/racer/levels/registry';

describe('footprintFromMasterDims', () => {
  it('maps Brick 2x4 AABB (stud included) to the BC1 footprint convention', () => {
    expect(
      footprintFromMasterDims({
        width_studs: 4,
        height_plates: 3.5,
        depth_studs: 2,
      })
    ).toEqual([2, 3, 4]);
  });

  it('rounds half up like the Python pipeline', () => {
    expect(
      footprintFromMasterDims({ width_studs: 1, height_plates: 3, depth_studs: 1 })
    ).toEqual([1, 3, 1]);
  });

  it('clamps to at least 1×1×1', () => {
    expect(
      footprintFromMasterDims({
        width_studs: 0.2,
        height_plates: 0.4,
        depth_studs: 0.2,
      })
    ).toEqual([1, 1, 1]);
  });
});

describe('mergePartsJson', () => {
  const seed: BrickPartDef[] = [
    {
      id: '3005',
      name: 'Brick 1 x 1',
      category: 'brick',
      footprint: [1, 3, 1],
      mesh: { status: 'box' },
    },
  ];

  it('adds staging without duplicating ids', () => {
    const staging: StagingPart[] = [
      {
        id: '3001',
        name: 'Brick 2 x 4',
        category: 'brick',
        footprint: [4, 3, 2],
        mesh: { status: 'box' },
        notes: 'ldraw:3001',
      },
      {
        id: '3005',
        name: 'Brick 1 x 1 updated',
        category: 'brick',
        footprint: [1, 3, 1],
        mesh: { status: 'box' },
      },
    ];
    const merged = mergePartsJson(seed, staging);
    expect(merged).toHaveLength(2);
    expect(merged.find((p) => p.id === '3005')?.name).toBe('Brick 1 x 1 updated');
    expect(merged.find((p) => p.id === '3001')?.notes).toBe('ldraw:3001');
  });
});

describe('guessPartCategory', () => {
  it('detects common name tokens', () => {
    expect(guessPartCategory('Brick 2 x 4')).toBe('brick');
    expect(guessPartCategory('Plate Round 1 x 1')).toBe('plate');
    expect(guessPartCategory('Dish 4 x 4 Inverted')).toBe('dish');
    expect(guessPartCategory('Cone 1 x 1')).toBe('cone');
  });
});

describe('catalog-lab registry', () => {
  it('registers catalog-lab level', () => {
    expect(isLevelId('catalog-lab')).toBe(true);
    expect(LEVEL_IDS).toContain('catalog-lab');
    expect(getLevelSpec('catalog-lab').id).toBe('catalog-lab');
    expect(levelLabel('catalog-lab')).toBe('Catalogue');
    expect(resolveLevelIdFromSearch('?level=catalog-lab')).toBe('catalog-lab');
  });
});
