import { describe, expect, it } from 'vitest';
import {
  BRICK_CATALOG,
  FOUNTAIN_BOM_PART_IDS,
  getColor,
  getPart,
  isBrickColorId,
  isBrickPartId,
  partMeshStatus,
  partSizeMeters,
  resolveColorId,
  resolvePartId,
  S,
  validateManual,
} from '../src/racer/hub/brick';
import { partFootprintPlates } from '../src/racer/hub/brick/manual/partFootprint';

describe('brick part catalog (BC1)', () => {
  it('loads a non-empty parts + colors seed', () => {
    expect(BRICK_CATALOG.parts.length).toBeGreaterThanOrEqual(40);
    expect(BRICK_CATALOG.colors.length).toBeGreaterThanOrEqual(8);
  });

  it('resolves legacy aliases to design ids', () => {
    expect(resolvePartId('1x1')).toBe('3005');
    expect(resolvePartId('2x4')).toBe('3001');
    expect(resolvePartId('plate')).toBe('3020');
    expect(resolvePartId('tile')).toBe('3068');
    expect(resolvePartId('plate_1x1')).toBe('6141');
    expect(resolveColorId('gray')).toBe('gray');
    expect(resolveColorId('lbg')).toBe('gray');
    expect(resolveColorId('trans_light_blue')).toBe('cyan');
  });

  it('exposes fountain BOM design ids (authoring before mesh)', () => {
    for (const id of FOUNTAIN_BOM_PART_IDS) {
      expect(isBrickPartId(id), `missing BOM part ${id}`).toBe(true);
      expect(getPart(id)?.id).toBeTruthy();
    }
    expect(partMeshStatus('85080')).toBe('missing');
    expect(partMeshStatus('3960')).toBe('missing');
    expect(partMeshStatus('3005')).toBe('box');
    expect(partMeshStatus('6141')).toBe('box');
  });

  it('footprints drive partSizeMeters', () => {
    expect(partFootprintPlates('3005')).toEqual([1, 3, 1]);
    expect(partFootprintPlates('1x1')).toEqual([1, 3, 1]);
    const [sx, sy, sz] = partSizeMeters('85080');
    expect(sx).toBeCloseTo(2 * S);
    expect(sz).toBeCloseTo(2 * S);
    expect(sy).toBeCloseTo(S);
    const big = partSizeMeters('48092');
    expect(big[0]).toBeCloseTo(4 * S);
    expect(big[2]).toBeCloseTo(4 * S);
  });

  it('validateManual accepts design ids and rejects unknown', () => {
    const ok = validateManual({
      id: 'test.bom',
      version: 1,
      origin: [0, 0, 0],
      envelope: { size: [3, 2, 3] },
      steps: [
        {
          title: 'macaroni',
          ops: [{ op: 'brick', part: '85080', color: 'gray', at: [-2, 0, -2] }],
        },
      ],
    });
    expect(ok.ok).toBe(true);

    const bad = validateManual({
      id: 'test.bad',
      version: 1,
      origin: [0, 0, 0],
      envelope: { size: [3, 2, 3] },
      steps: [
        {
          title: 'x',
          ops: [{ op: 'brick', part: '999999', color: 'gray', at: [0, 0, 0] }],
        },
      ],
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues.some((i) => i.message.includes('unknown part'))).toBe(true);
    }
  });

  it('colors include Light Bluish Gray + trans water', () => {
    expect(isBrickColorId('gray')).toBe(true);
    expect(getColor('cyan')?.translucent).toBe(true);
    expect(getColor('clear')?.blId).toBe(40);
  });
});
