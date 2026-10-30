/**
 * @file brickManualRegistry.test.ts
 * @description Manual registry glob (DC1a).
 */

import { describe, expect, it } from 'vitest';
import {
  BRICK_MANUAL_IDS,
  brickManualLabel,
  brickManualOverlayUrl,
  getBrickManual,
  isBrickManualId,
} from '../src/racer/hub/brick/manuals/registry';

describe('brick manual registry', () => {
  it('discovers fountain via import.meta.glob', () => {
    expect(BRICK_MANUAL_IDS).toContain('fountain');
    expect(isBrickManualId('fountain')).toBe(true);
    expect(isBrickManualId('nope')).toBe(false);
  });

  it('loads fountain manual and label', () => {
    const m = getBrickManual('fountain');
    expect(m.id).toBe('landmark.fountain');
    expect(brickManualLabel('fountain').length).toBeGreaterThan(0);
  });

  it('maps fountain overlay url', () => {
    expect(brickManualOverlayUrl('fountain')).toBe('/brick-refs/fountain-ortho.png');
    expect(brickManualOverlayUrl('missing')).toBeNull();
  });
});
