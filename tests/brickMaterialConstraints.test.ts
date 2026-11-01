/**
 * @file brickMaterialConstraints.test.ts
 * @description MT3 — allowedMaterials warnings + tire/window parts.
 */

import { describe, expect, it } from 'vitest';
import { getPart, materialOf, validateManual } from '../src/racer/hub/brick';

describe('allowedMaterials (MT3)', () => {
  it('marks tires as rubber-only and glass as transparent', () => {
    expect(getPart('3641')?.allowedMaterials).toEqual(['rubber']);
    expect(getPart('56890')?.allowedMaterials).toEqual(['rubber']);
    expect(getPart('3823')?.allowedMaterials).toEqual(['transparent']);
    expect(getPart('60601')?.allowedMaterials).toEqual(['transparent']);
    expect(getPart('4624')?.allowedMaterials).toContain('chrome');
  });

  it('warns when colour finish mismatches part constraint (still ok)', () => {
    const result = validateManual({
      id: 'test.mt3.tire',
      version: 1,
      origin: [0, 0, 0],
      envelope: { size: [3, 2, 3] },
      steps: [
        {
          title: 'bad tire',
          ops: [{ op: 'brick', part: '3641', color: 'red', at: [0, 0, 0] }],
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings?.length).toBeGreaterThan(0);
    expect(result.warnings![0]!.message).toMatch(/rubber/);
    expect(materialOf('red')).toBe('plastic');
  });

  it('accepts rubber black on tire without warning', () => {
    const result = validateManual({
      id: 'test.mt3.tire.ok',
      version: 1,
      origin: [0, 0, 0],
      envelope: { size: [3, 2, 3] },
      steps: [
        {
          title: 'tire',
          ops: [{ op: 'brick', part: '3641', color: 'rubber_black', at: [0, 0, 0] }],
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings ?? []).toHaveLength(0);
  });
});
