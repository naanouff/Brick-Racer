/**
 * @file catalogGlb.ts
 * @description GLB of a catalog preview: UV0 (plastic), UV1 (atlas), AO on UV1.
 * glTF V = 0 is the top of the image, same as the UV1 bake sample.
 */

import { buildCatalogFbx, orientedCorners } from './catalogFbx';

export { buildCatalogFbx };

const VERTEX_FLOATS = 20;
const ATTR_UV0 = 3;
const ATTR_UV1 = 5;
const ATTR_NORMAL = 7;

export type CatalogGlbInput = {
  name: string;
  vertices: Float32Array;
  indices: Uint32Array;
  triangleCount: number;
  /** RGBA bake. The blue channel is AO (255 = open). */
  aging: Uint8Array;
};

export function buildCatalogGlb(input: CatalogGlbInput): Uint8Array {
  const vertCount = input.vertices.length / VERTEX_FLOATS;
  const indexCount = input.triangleCount * 3;
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const uv0 = new Float32Array(vertCount * 2);
  const uv1 = new Float32Array(vertCount * 2);
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < vertCount; i++) {
    const o = i * VERTEX_FLOATS;
    const x = input.vertices[o]!;
    const y = input.vertices[o + 1]!;
    const z = input.vertices[o + 2]!;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
    normals[i * 3] = input.vertices[o + ATTR_NORMAL]!;
    normals[i * 3 + 1] = input.vertices[o + ATTR_NORMAL + 1]!;
    normals[i * 3 + 2] = input.vertices[o + ATTR_NORMAL + 2]!;
    uv0[i * 2] = input.vertices[o + ATTR_UV0]!;
    uv0[i * 2 + 1] = input.vertices[o + ATTR_UV0 + 1]!;
    uv1[i * 2] = input.vertices[o + ATTR_UV1]!;
    uv1[i * 2 + 1] = input.vertices[o + ATTR_UV1 + 1]!;
  }
  const indices = new Uint32Array(indexCount);
  for (let f = 0; f < input.triangleCount; f++) {
    indices[f * 3] = input.indices[f * 6]!;
    indices[f * 3 + 1] = input.indices[f * 6 + 1]!;
    indices[f * 3 + 2] = input.indices[f * 6 + 2]!;
  }

  const side = Math.round(Math.sqrt(input.aging.byteLength / 4));
  const png = encodeAoPng(input.aging, side);

  const parts: Uint8Array[] = [
    new Uint8Array(indices.buffer, indices.byteOffset, indices.byteLength),
    new Uint8Array(positions.buffer),
    new Uint8Array(normals.buffer),
    new Uint8Array(uv0.buffer),
    new Uint8Array(uv1.buffer),
    png,
  ];
  let binLength = 0;
  const offsets: number[] = [];
  for (const part of parts) {
    offsets.push(binLength);
    binLength += part.byteLength;
    binLength += (4 - (binLength % 4)) % 4;
  }
  const bin = new Uint8Array(binLength);
  parts.forEach((part, i) => bin.set(part, offsets[i]!));

  const view = (i: number, target?: number) => ({
    buffer: 0,
    byteOffset: offsets[i],
    byteLength: parts[i]!.byteLength,
    ...(target ? { target } : {}),
  });
  const json = {
    asset: { version: '2.0', generator: 'brick-racer catalog' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: input.name }],
    meshes: [
      {
        name: input.name,
        primitives: [
          {
            attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2, TEXCOORD_1: 3 },
            indices: 4,
            material: 0,
          },
        ],
      },
    ],
    materials: [
      {
        name: 'UV1 AO',
        doubleSided: true,
        pbrMetallicRoughness: {
          baseColorTexture: { index: 0, texCoord: 1 },
          metallicFactor: 0,
          roughnessFactor: 0.45,
        },
      },
    ],
    textures: [{ sampler: 0, source: 0 }],
    samplers: [{ wrapS: 33071, wrapT: 33071, magFilter: 9729, minFilter: 9729 }],
    images: [{ bufferView: 5, mimeType: 'image/png', name: 'uv1-ao' }],
    accessors: [
      {
        bufferView: 1,
        componentType: 5126,
        count: vertCount,
        type: 'VEC3',
        min: [minX, minY, minZ],
        max: [maxX, maxY, maxZ],
      },
      { bufferView: 2, componentType: 5126, count: vertCount, type: 'VEC3' },
      { bufferView: 3, componentType: 5126, count: vertCount, type: 'VEC2' },
      { bufferView: 4, componentType: 5126, count: vertCount, type: 'VEC2' },
      { bufferView: 0, componentType: 5125, count: indexCount, type: 'SCALAR' },
    ],
    bufferViews: [
      view(0, 34963),
      view(1, 34962),
      view(2, 34962),
      view(3, 34962),
      view(4, 34962),
      view(5),
    ],
    buffers: [{ byteLength: binLength }],
  };

  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPad = (4 - (jsonBytes.byteLength % 4)) % 4;
  const total = 12 + 8 + jsonBytes.byteLength + jsonPad + 8 + binLength;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jsonBytes.byteLength + jsonPad, true);
  dv.setUint32(16, 0x4e4f534a, true);
  out.set(jsonBytes, 20);
  out.fill(0x20, 20 + jsonBytes.byteLength, 20 + jsonBytes.byteLength + jsonPad);
  const binChunk = 20 + jsonBytes.byteLength + jsonPad;
  dv.setUint32(binChunk, binLength, true);
  dv.setUint32(binChunk + 4, 0x004e4942, true);
  out.set(bin, binChunk + 8);
  return out;
}

function encodeAoPng(rgba: Uint8Array, side: number): Uint8Array {
  const raw = new Uint8Array(side * (1 + side * 3));
  for (let y = 0; y < side; y++) {
    const row = y * (1 + side * 3);
    raw[row] = 0;
    for (let x = 0; x < side; x++) {
      const ao = rgba[(y * side + x) * 4 + 2]!;
      const p = row + 1 + x * 3;
      raw[p] = ao;
      raw[p + 1] = ao;
      raw[p + 2] = ao;
    }
  }
  const sig = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = new Uint8Array(13);
  const ih = new DataView(ihdr.buffer);
  ih.setUint32(0, side);
  ih.setUint32(4, side);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', zlibStore(raw)), pngChunk('IEND', new Uint8Array())]);
}

function zlibStore(data: Uint8Array): Uint8Array {
  const chunks: Uint8Array[] = [Uint8Array.from([0x78, 0x01])];
  let a = 1;
  let b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]!) % 65521;
    b = (b + a) % 65521;
  }
  for (let off = 0; off < data.length; off += 65535) {
    const len = Math.min(65535, data.length - off);
    const last = off + len >= data.length;
    const block = new Uint8Array(5 + len);
    block[0] = last ? 1 : 0;
    block[1] = len & 255;
    block[2] = (len >> 8) & 255;
    block[3] = ~len & 255;
    block[4] = (~len >> 8) & 255;
    block.set(data.subarray(off, off + len), 5);
    chunks.push(block);
  }
  const adler = new Uint8Array(4);
  new DataView(adler.buffer).setUint32(0, ((b << 16) | a) >>> 0);
  chunks.push(adler);
  return concat(chunks);
}

const CRC = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC[n] = c;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.byteLength);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.byteLength);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  let c = 0xffffffff;
  for (let i = 4; i < 8 + data.byteLength; i++) c = CRC[(c ^ out[i]!) & 255]! ^ (c >>> 8);
  dv.setUint32(8 + data.byteLength, (c ^ 0xffffffff) >>> 0);
  return out;
}

/**
 * Wavefront OBJ for Substance Painter. One UV set: UV1, with V flipped
 * so v = 0 sits at the bottom of the texture, the OBJ convention.
 * Faces are oriented outward; LDraw has no reliable winding.
 */
export function buildCatalogObj(input: CatalogGlbInput): Uint8Array {
  const vertCount = input.vertices.length / VERTEX_FLOATS;
  const corners = orientedCorners(input);
  const lines: string[] = [`o ${input.name}`, `g ${input.name}`];
  for (let i = 0; i < vertCount; i++) {
    const o = i * VERTEX_FLOATS;
    lines.push(
      `v ${n(input.vertices[o]!)} ${n(input.vertices[o + 1]!)} ${n(input.vertices[o + 2]!)}`
    );
  }
  for (let i = 0; i < vertCount; i++) {
    const o = i * VERTEX_FLOATS + ATTR_UV1;
    lines.push(`vt ${n(input.vertices[o]!)} ${n(1 - input.vertices[o + 1]!)}`);
  }
  for (let i = 0; i < vertCount; i++) {
    const o = i * VERTEX_FLOATS + ATTR_NORMAL;
    lines.push(
      `vn ${n(input.vertices[o]!)} ${n(input.vertices[o + 1]!)} ${n(input.vertices[o + 2]!)}`
    );
  }
  for (let f = 0; f < input.triangleCount; f++) {
    const a = corners[f * 3]! + 1;
    const b = corners[f * 3 + 1]! + 1;
    const c = corners[f * 3 + 2]! + 1;
    lines.push(`f ${a}/${a}/${a} ${b}/${b}/${b} ${c}/${c}/${c}`);
  }
  return new TextEncoder().encode(lines.join('\n') + '\n');
}

function n(v: number): string {
  return v.toFixed(6);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const n = parts.reduce((s, p) => s + p.byteLength, 0);
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.byteLength;
  }
  return out;
}
