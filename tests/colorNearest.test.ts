/**
 * @file colorNearest.test.ts
 * @description CF3a — set / LDraw color names → editor slugs.
 */

import { describe, expect, it } from 'vitest';
import {
  SET_10359_COLOR_HINTS,
  nearestEditorColor,
} from '../src/racer/hub/brick/catalog';

describe('nearestEditorColor (CF3a)', () => {
  it('maps 10359-ish names', () => {
    expect(nearestEditorColor('Tan')).toBe('sand');
    expect(nearestEditorColor('Dark Orange')).toBe('terracotta');
    expect(nearestEditorColor('Light Bluish Gray')).toBe('gray');
    expect(nearestEditorColor('Dark Bluish Gray')).toBe('dark_gray');
    expect(nearestEditorColor('Trans-Light Blue')).toBe('cyan');
    expect(nearestEditorColor('Trans-Clear')).toBe('clear');
    expect(nearestEditorColor('Bright Light Yellow')).toBe('yellow');
  });

  it('falls back to gray for unknowns', () => {
    expect(nearestEditorColor('Magenta Sparkle')).toBe('gray');
  });

  it('SET_10359_COLOR_HINTS uses editor slugs', () => {
    expect(SET_10359_COLOR_HINTS.length).toBeGreaterThan(5);
    for (const h of SET_10359_COLOR_HINTS) {
      expect(nearestEditorColor(h.from)).toBe(h.to);
    }
  });
});
