import { describe, expect, it } from 'vitest';
import {
  buildCatalogFbx,
  buildCatalogGlb,
  buildCatalogObj,
} from '../src/racer/hub/brick/catalog/catalogGlb';

describe('catalog GLB', () => {
  it('writes UV0, UV1 and an AO image for Substance', () => {
    const vertices = new Float32Array(20 * 3);
    vertices.set([0, 0, 0], 0);
    vertices.set([0.2, 0.4], 3);
    vertices.set([0.1, 0.2], 5);
    vertices.set([0, 1, 0], 7);
    vertices.set([1, 0, 0], 20);
    vertices.set([0.5, 0.5], 23);
    vertices.set([0.3, 0.4], 25);
    vertices.set([0, 1, 0], 27);
    vertices.set([0, 0, 1], 40);
    vertices.set([0.5, 0.6], 43);
    vertices.set([0.5, 0.6], 45);
    vertices.set([0, 1, 0], 47);
    const indices = new Uint32Array([0, 1, 2, 0, 2, 1]);
    const aging = new Uint8Array(4 * 4 * 4);
    aging[2] = 10;
    const glb = buildCatalogGlb({
      name: '3001',
      vertices,
      indices,
      triangleCount: 1,
      aging,
    });
    expect(String.fromCharCode(glb[0]!, glb[1]!, glb[2]!, glb[3]!)).toBe('glTF');
    const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
    const jsonLen = view.getUint32(12, true);
    const json = new TextDecoder().decode(glb.subarray(20, 20 + jsonLen));
    expect(json).toContain('TEXCOORD_0');
    expect(json).toContain('TEXCOORD_1');
    expect(json).toContain('uv1-ao');
    expect(json).toContain('"texCoord":1');
    const pngAt = glb.findIndex(
      (_b, i) => glb[i] === 137 && glb[i + 1] === 80 && glb[i + 2] === 78 && glb[i + 3] === 71
    );
    expect(pngAt).toBeGreaterThan(20 + jsonLen);
  });

  it('writes an OBJ whose only UV set is UV1, V flipped for Substance', () => {
    const vertices = new Float32Array(20 * 3);
    vertices.set([0, 0, 0], 0);
    vertices.set([0.1, 0.25], 5);
    vertices.set([1, 0, 0], 20);
    vertices.set([0.2, 0.5], 25);
    vertices.set([0, 0, 1], 40);
    vertices.set([0.3, 0.75], 45);
    const obj = new TextDecoder().decode(
      buildCatalogObj({
        name: '3001',
        vertices,
        indices: new Uint32Array([0, 1, 2, 0, 2, 1]),
        triangleCount: 1,
        aging: new Uint8Array(16),
      })
    );
    expect(obj).toContain('vt 0.100000 0.750000');
    expect(obj).toContain('vt 0.200000 0.500000');
    expect(obj).toContain('f 1/1/1 2/2/2 3/3/3');
    expect(obj).not.toContain('vt 0.100000 0.250000');
  });

  it('writes an FBX with UV0 and UV1, V flipped, last corner negated', () => {
    const vertices = new Float32Array(20 * 3);
    vertices.set([0, 0, 0], 0);
    vertices.set([0.2, 0.4], 3);
    vertices.set([0.1, 0.2], 5);
    vertices.set([1, 0, 0], 20);
    vertices.set([0, 0, 1], 40);
    const bytes = buildCatalogFbx({
      name: '98366',
      vertices,
      indices: new Uint32Array([0, 1, 2, 0, 2, 1]),
      triangleCount: 1,
      aging: new Uint8Array(16),
    });
    expect(new TextDecoder().decode(bytes.subarray(0, 18))).toBe('Kaydara FBX Binary');
    expect(new DataView(bytes.buffer, bytes.byteOffset).getUint32(23, true)).toBe(7400);
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text).toContain('UV0');
    expect(text).toContain('UV1');
    expect(text).toContain('NormalsW');
    expect(readFbxIntArray(bytes, 'PolygonVertexIndex')).toEqual([0, 1, -3]);
    const uv = readFbxDoubles(bytes, 'UV');
    expect(uv.some((v) => Math.abs(v - 0.1) < 1e-5)).toBe(true);
    expect(uv.some((v) => Math.abs(v - 0.8) < 1e-5)).toBe(true);
  });

  it('turns an inward neighbour so both OBJ faces point the same way', () => {
    const vertices = new Float32Array(20 * 4);
    vertices.set([0, 0, 0], 0);
    vertices.set([1, 0, 0], 20);
    vertices.set([0, 0, 1], 40);
    vertices.set([1, 0, 1], 60);
    const indices = new Uint32Array([
      0, 1, 2, 0, 2, 1,
      1, 2, 3, 1, 3, 2,
    ]);
    const obj = new TextDecoder().decode(
      buildCatalogObj({
        name: 'quad',
        vertices,
        indices,
        triangleCount: 2,
        aging: new Uint8Array(16),
      })
    );
    const faces = [...obj.matchAll(/^f (\d+)\/\d+\/\d+ (\d+)\/\d+\/\d+ (\d+)\/\d+\/\d+$/gm)].map((m) =>
      [Number(m[1]), Number(m[2]), Number(m[3])]
    );
    const pos = (i: number): [number, number, number] => {
      const o = (i - 1) * 20;
      return [vertices[o]!, vertices[o + 1]!, vertices[o + 2]!];
    };
    const ny = (face: number[]): number => {
      const [a, b, c] = face.map(pos);
      const e1x = b![0] - a![0];
      const e1z = b![2] - a![2];
      const e2x = c![0] - a![0];
      const e2z = c![2] - a![2];
      return e1z * e2x - e1x * e2z;
    };
    expect(faces).toHaveLength(2);
    expect(ny(faces[0]!) * ny(faces[1]!)).toBeGreaterThan(0);
  });
});

function readFbxIntArray(buf: Uint8Array, nodeName: string): number[] {
  return readFbxArray(buf, nodeName, 4, (view, at) => view.getInt32(at, true));
}

function readFbxDoubles(buf: Uint8Array, nodeName: string): number[] {
  return readFbxArray(buf, nodeName, 8, (view, at) => view.getFloat64(at, true));
}

function readFbxArray(
  buf: Uint8Array,
  nodeName: string,
  stride: number,
  read: (view: DataView, at: number) => number
): number[] {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const found: number[] = [];
  const walk = (offset: number, limit: number): void => {
    while (offset + 13 <= limit) {
      const end = view.getUint32(offset, true);
      if (end === 0) return;
      const numProps = view.getUint32(offset + 4, true);
      const propLen = view.getUint32(offset + 8, true);
      const nameLen = view.getUint8(offset + 12);
      const name = new TextDecoder().decode(buf.subarray(offset + 13, offset + 13 + nameLen));
      const propsAt = offset + 13 + nameLen;
      if (name === nodeName && numProps > 0) {
        const type = String.fromCharCode(view.getUint8(propsAt));
        const count = view.getUint32(propsAt + 1, true);
        const encoding = view.getUint32(propsAt + 5, true);
        if ((type === 'i' || type === 'd') && encoding === 0) {
          for (let i = 0; i < count; i++) found.push(read(view, propsAt + 13 + i * stride));
        }
      }
      const childAt = propsAt + propLen;
      if (childAt < end) walk(childAt, end);
      offset = end;
    }
  };
  walk(27, buf.byteLength);
  return found;
}