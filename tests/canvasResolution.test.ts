import { describe, expect, it } from 'vitest';
import {
  MAX_BUFFER_LONG_EDGE,
  computeCanvasBufferSize,
} from '../src/racer/host/canvasResolution';

describe('computeCanvasBufferSize', () => {
  it('keeps small windows 1:1 at dpr 1', () => {
    expect(computeCanvasBufferSize(800, 600, { dpr: 1 })).toEqual({ width: 800, height: 600 });
  });

  it('ignores dpr above cap', () => {
    expect(computeCanvasBufferSize(800, 600, { dpr: 2, dprCap: 1 })).toEqual({
      width: 800,
      height: 600,
    });
  });

  it('scales down large windows to max long edge', () => {
    const { width, height } = computeCanvasBufferSize(2560, 1440, { dpr: 1 });
    expect(Math.max(width, height)).toBe(MAX_BUFFER_LONG_EDGE);
    expect(width / height).toBeCloseTo(2560 / 1440, 2);
  });

  it('caps portrait the same way', () => {
    const { width, height } = computeCanvasBufferSize(1080, 1920, { dpr: 1 });
    expect(Math.max(width, height)).toBe(MAX_BUFFER_LONG_EDGE);
  });
});
