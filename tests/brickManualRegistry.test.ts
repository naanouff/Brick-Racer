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

  it('maps Prompt 0 city-test overlay urls', () => {
    expect(brickManualOverlayUrl('fountain')).toBe('/brick-refs/fountain-ortho.png');
    expect(brickManualOverlayUrl('pad')).toBe('/brick-refs/pad-ortho.png');
    expect(brickManualOverlayUrl('gate')).toBe('/brick-refs/gate-ortho.png');
    expect(brickManualOverlayUrl('tower')).toBe('/brick-refs/tower-ortho.png');
    expect(brickManualOverlayUrl('billboard')).toBe('/brick-refs/billboard-ortho.png');
    expect(brickManualOverlayUrl('garage')).toBe('/brick-refs/garage-ortho.png');
    expect(brickManualOverlayUrl('vinyle')).toBe('/brick-refs/vinyle-ortho.png');
    expect(brickManualOverlayUrl('mairie')).toBe('/brick-refs/mairie-ortho.png');
    expect(brickManualOverlayUrl('missing')).toBeNull();
  });

  it('discovers pad manual after brickify', () => {
    expect(BRICK_MANUAL_IDS).toContain('pad');
    expect(getBrickManual('pad').id).toBe('landmark.pad');
  });

  it('discovers garage / vinyle / mairie façades (FC)', () => {
    for (const stem of ['garage', 'vinyle', 'mairie'] as const) {
      expect(BRICK_MANUAL_IDS).toContain(stem);
      expect(getBrickManual(stem).id).toBe(`landmark.${stem}`);
    }
    expect(getBrickManual('garage').envelope?.size?.[1]).toBeGreaterThan(4);
    expect(getBrickManual('vinyle').envelope?.size?.[0]).toBeGreaterThan(5);
    expect(getBrickManual('mairie').envelope?.size?.[2]).toBeGreaterThan(3);
  });
});


