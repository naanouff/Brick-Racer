/**
 * @file brickAssembly.test.ts
 * @description Multi-module assembly → manual (DC4).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assembleManual,
  brickifyAssembly,
  BrickifyError,
  validateAssembly,
} from '../src/racer/hub/brick';

const layersDir = resolve(__dirname, '../src/racer/hub/brick/layers');

function loadLayers(file: string): unknown {
  return JSON.parse(readFileSync(resolve(layersDir, file), 'utf8'));
}

describe('validateAssembly', () => {
  it('accepts tower assembly', () => {
    const raw = JSON.parse(readFileSync(resolve(layersDir, 'tower.assembly.json'), 'utf8'));
    expect(validateAssembly(raw).ok).toBe(true);
  });

  it('rejects empty modules', () => {
    const r = validateAssembly({ id: 'landmark.x', modules: [] });
    expect(r.ok).toBe(false);
  });
});

describe('brickifyAssembly', () => {
  it('merges tower base + shaft with Y offset', () => {
    const raw = JSON.parse(readFileSync(resolve(layersDir, 'tower.assembly.json'), 'utf8'));
    const manual = brickifyAssembly(raw, loadLayers);
    expect(manual.id).toBe('landmark.tower');
    expect(manual.steps.length).toBeGreaterThan(2);
    expect(manual.steps.some((s) => s.title.startsWith('base'))).toBe(true);
    expect(manual.steps.some((s) => s.title.startsWith('shaft'))).toBe(true);
    const assembled = assembleManual(manual);
    expect(assembled.bricks.length).toBeGreaterThan(15);
  });

  it('throws when module file missing', () => {
    expect(() =>
      brickifyAssembly(
        {
          id: 'landmark.x',
          modules: [{ file: 'nope.layers.json' }],
        },
        loadLayers
      )
    ).toThrow(BrickifyError);
  });
});
