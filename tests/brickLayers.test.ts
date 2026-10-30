/**
 * @file brickLayers.test.ts
 * @description Layers schema + brickify (DC1b / DC1c).
 */

import { describe, expect, it } from 'vitest';
import {
  assembleManual,
  brickifyLayers,
  BrickifyError,
  validateLayers,
} from '../src/racer/hub/brick';

const padLayers = {
  id: 'landmark.pad',
  title: 'Pad test 8×6',
  footprint: [8, 6] as [number, number],
  legend: { Y: 'yellow', K: 'black' },
  layers: [
    {
      kind: 'plate' as const,
      rows: [
        'KKKKKKKK',
        'KYYYYYYK',
        'KYKKKKYK',
        'KYKKKKYK',
        'KYYYYYYK',
        'KKKKKKKK',
      ],
    },
  ],
  ops: [] as unknown[],
};

describe('validateLayers', () => {
  it('accepts a valid pad', () => {
    const r = validateLayers(padLayers);
    expect(r.ok).toBe(true);
  });

  it('rejects row length mismatch', () => {
    const r = validateLayers({
      ...padLayers,
      layers: [{ kind: 'plate', rows: ['KKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK'] }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.some((i) => i.path.includes('rows[0]'))).toBe(true);
    }
  });

  it('rejects unknown legend color', () => {
    const r = validateLayers({
      ...padLayers,
      legend: { Y: 'not_a_color' },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.some((i) => i.message.includes('unknown color'))).toBe(true);
    }
  });

  it('rejects unknown kind', () => {
    const r = validateLayers({
      ...padLayers,
      layers: [{ kind: 'slope', rows: padLayers.layers[0]!.rows }],
    });
    expect(r.ok).toBe(false);
  });

  it('rejects unknown letter in rows', () => {
    const rows = [...padLayers.layers[0]!.rows];
    rows[0] = 'X' + rows[0]!.slice(1);
    const r = validateLayers({
      ...padLayers,
      layers: [{ kind: 'plate', rows }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.some((i) => i.message.includes("unknown legend letter 'X'"))).toBe(true);
    }
  });
});

describe('brickifyLayers', () => {
  it('is deterministic and uses parts larger than 1×1', () => {
    const a = brickifyLayers(padLayers);
    const b = brickifyLayers(padLayers);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const parts = new Set(a.steps.flatMap((s) => s.ops.map((o) => ('part' in o ? o.part : ''))));
    expect([...parts].some((p) => p !== '3024' && p !== '3070')).toBe(true);
  });

  it('assembles without overlap', () => {
    const manual = brickifyLayers(padLayers);
    const assembled = assembleManual(manual);
    expect(assembled.bricks.length).toBeGreaterThan(4);
    expect(assembled.poses.length).toBe(assembled.bricks.length);
  });

  it('appends free ops after layers', () => {
    const manual = brickifyLayers({
      ...padLayers,
      ops: [{ op: 'brick', part: '3005', color: 'white', at: [0, 1, 0] }],
    });
    const last = manual.steps[manual.steps.length - 1]!;
    expect(last.title).toContain('specials');
    expect(last.ops).toHaveLength(1);
    expect(assembleManual(manual).bricks.length).toBeGreaterThan(5);
  });

  it('throws on invalid input', () => {
    expect(() => brickifyLayers({ id: 'x' })).toThrow(BrickifyError);
  });

  it('keeps stable partsList counts', () => {
    const manual = brickifyLayers(padLayers);
    const totalQty = (manual.partsList ?? []).reduce((n, e) => n + e.qty, 0);
    expect(totalQty).toBe(assembleManual(manual).bricks.length);
  });
});
