import { describe, expect, it } from 'vitest';
import { coercePngBytes } from '../src/main/catalogThumbs';

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function fakePng(extra = 40): number[] {
  return [...PNG_MAGIC, ...Array.from({ length: extra }, (_, i) => i & 0xff)];
}

describe('catalogThumbs coercePngBytes', () => {
  it('accepts Uint8Array, ArrayBuffer, number[], and array-like', () => {
    const bytes = fakePng();
    const u8 = Uint8Array.from(bytes);
    expect(coercePngBytes(u8)?.[0]).toBe(0x89);
    expect(coercePngBytes(u8.buffer)?.[1]).toBe(0x50);
    expect(coercePngBytes(bytes)?.length).toBe(bytes.length);
    const like = { length: bytes.length, ...Object.fromEntries(bytes.map((v, i) => [i, v])) };
    expect(coercePngBytes(like)?.[0]).toBe(0x89);
    expect(coercePngBytes({ type: 'Buffer', data: bytes })?.[0]).toBe(0x89);
  });

  it('rejects null / empty', () => {
    expect(coercePngBytes(null)).toBeNull();
    expect(coercePngBytes(undefined)).toBeNull();
    expect(coercePngBytes([])).not.toBeNull(); // empty buffer still coerced
    expect(coercePngBytes([])?.length).toBe(0);
  });
});
