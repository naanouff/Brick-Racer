/**
 * @file catalogFbx.ts
 * @description Binary FBX 7.4 of a catalog preview (UV0, UV1) for Substance Painter.
 * FileId, CreationTime and the footer use Blender's fixed timestamp, which is
 * what the FBX SDK checksum expects. Arrays stay uncompressed so the renderer
 * does not need zlib.
 */

import type { CatalogGlbInput } from './catalogGlb';

const VERTEX_FLOATS = 20;

const MAGIC = Uint8Array.from([
  0x4b, 0x61, 0x79, 0x64, 0x61, 0x72, 0x61, 0x20, 0x46, 0x42, 0x58, 0x20, 0x42, 0x69, 0x6e,
  0x61, 0x72, 0x79, 0x20, 0x20, 0x00, 0x1a, 0x00,
]);
const FILE_ID = Uint8Array.from([
  0x28, 0xb3, 0x2a, 0xeb, 0xb6, 0x24, 0xcc, 0xc2, 0xbf, 0xc8, 0xb0, 0x2a, 0xa9, 0x2b, 0xfc, 0xf1,
]);
const FOOT_ID = Uint8Array.from([
  0xfa, 0xbc, 0xab, 0x09, 0xd0, 0xc8, 0xd4, 0x66, 0xb1, 0x76, 0xfb, 0x83, 0x1c, 0xf7, 0x26, 0x7e,
]);
const FOOT_MAGIC = Uint8Array.from([
  0xf8, 0x5a, 0x8c, 0x6a, 0xde, 0xf5, 0xd9, 0x7e, 0xec, 0xe9, 0x0c, 0xe3, 0x75, 0x8f, 0x29, 0x0b,
]);

const utf8 = new TextEncoder();

type FbxProp =
  | { k: 'I'; v: number }
  | { k: 'L'; v: number }
  | { k: 'D'; v: number }
  | { k: 'C'; v: number }
  | { k: 'S'; v: string }
  | { k: 'R'; v: Uint8Array }
  | { k: 'd'; v: Float64Array }
  | { k: 'i'; v: Int32Array };

type FbxNode = { name: string; props: FbxProp[]; children: FbxNode[] };

const ii = (v: number): FbxProp => ({ k: 'I', v });
const ll = (v: number): FbxProp => ({ k: 'L', v });
const dd = (v: number): FbxProp => ({ k: 'D', v });
const ss = (v: string): FbxProp => ({ k: 'S', v });

function node(name: string, props: FbxProp[] = [], children: FbxNode[] = []): FbxNode {
  return { name, props, children };
}
function leaf(name: string, prop: FbxProp): FbxNode {
  return node(name, [prop]);
}
function propP(props: FbxProp[]): FbxNode {
  return node('P', props);
}

/**
 * Binary FBX 7.4. UV0 and UV1, V flipped so v = 0 is the bottom of the texture.
 * Faces use the same outward shell as the OBJ.
 */
export function buildCatalogFbx(input: CatalogGlbInput): Uint8Array {
  const vertCount = input.vertices.length / VERTEX_FLOATS;
  const corners = orientedCorners(input);
  const positions = new Float64Array(vertCount * 3);
  for (let i = 0; i < vertCount; i++) {
    const o = i * VERTEX_FLOATS;
    positions[i * 3] = input.vertices[o]!;
    positions[i * 3 + 1] = input.vertices[o + 1]!;
    positions[i * 3 + 2] = input.vertices[o + 2]!;
  }
  const cornerCount = input.triangleCount * 3;
  const polys = new Int32Array(cornerCount);
  const normals = new Float64Array(cornerCount * 3);
  const normalW = new Float64Array(cornerCount);
  const uv0 = new Float64Array(cornerCount * 2);
  const uv1 = new Float64Array(cornerCount * 2);
  const uvIndex = new Int32Array(cornerCount);
  for (let c = 0; c < cornerCount; c++) {
    const vi = corners[c]!;
    polys[c] = c % 3 === 2 ? ~vi : vi;
    const o = vi * VERTEX_FLOATS;
    normals[c * 3] = input.vertices[o + 7]!;
    normals[c * 3 + 1] = input.vertices[o + 8]!;
    normals[c * 3 + 2] = input.vertices[o + 9]!;
    normalW[c] = 1;
    uv0[c * 2] = input.vertices[o + 3]!;
    uv0[c * 2 + 1] = 1 - input.vertices[o + 4]!;
    uv1[c * 2] = input.vertices[o + 5]!;
    uv1[c * 2 + 1] = 1 - input.vertices[o + 6]!;
    uvIndex[c] = c;
  }
  const safe = input.name.replace(/[^\w.-]+/g, '_') || 'part';
  return encodeFbx(fbxNodes(safe, positions, polys, normals, normalW, uv0, uv1, uvIndex));
}

/** Outward winding. The back shell (indices +3) flips both the order and the normals. */
export function orientedCorners(input: CatalogGlbInput): Uint32Array {
  const faceCount = input.triangleCount;
  const out = new Uint32Array(faceCount * 3);
  if (faceCount === 0) return out;
  const at = (vi: number): [number, number, number] => {
    const o = vi * VERTEX_FLOATS;
    return [input.vertices[o]!, input.vertices[o + 1]!, input.vertices[o + 2]!];
  };
  const keyOf = (vi: number): string => {
    const [x, y, z] = at(vi);
    return `${Math.round(x * 1e5)},${Math.round(y * 1e5)},${Math.round(z * 1e5)}`;
  };
  const front: [number, number, number][] = [];
  for (let f = 0; f < faceCount; f++) {
    front.push([input.indices[f * 6]!, input.indices[f * 6 + 1]!, input.indices[f * 6 + 2]!]);
  }
  const edges = new Map<string, { face: number; dir: 1 | -1 }[]>();
  for (let f = 0; f < faceCount; f++) {
    const c = front[f]!;
    const keys = [keyOf(c[0]), keyOf(c[1]), keyOf(c[2])];
    for (let k = 0; k < 3; k++) {
      const ka = keys[k]!;
      const kb = keys[(k + 1) % 3]!;
      if (ka === kb) continue;
      const undirected = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      const rec = { face: f, dir: (ka < kb ? 1 : -1) as 1 | -1 };
      const list = edges.get(undirected);
      if (list) list.push(rec);
      else edges.set(undirected, [rec]);
    }
  }
  const neighbors: { face: number; sameDir: boolean }[][] = Array.from({ length: faceCount }, () => []);
  for (const list of edges.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        if (a.face === b.face) continue;
        const sameDir = a.dir === b.dir;
        neighbors[a.face]!.push({ face: b.face, sameDir });
        neighbors[b.face]!.push({ face: a.face, sameDir });
      }
    }
  }
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  const vertCount = input.vertices.length / VERTEX_FLOATS;
  for (let i = 0; i < vertCount; i++) {
    const [x, y, z] = at(i);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }
  const ox = (minX + maxX) * 0.5;
  const oy = (minY + maxY) * 0.5;
  const oz = (minZ + maxZ) * 0.5;
  const outward = (f: number): number => {
    const c = front[f]!;
    const [ax, ay, az] = at(c[0]);
    const [bx, by, bz] = at(c[1]);
    const [cx, cy, cz] = at(c[2]);
    const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
    const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    const nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const px = (ax + bx + cx) / 3 - ox;
    const py = (ay + by + cy) / 3 - oy;
    const pz = (az + bz + cz) / 3 - oz;
    return nx * px + ny * py + nz * pz;
  };
  const flip = new Uint8Array(faceCount);
  const seen = new Uint8Array(faceCount);
  for (let start = 0; start < faceCount; start++) {
    if (seen[start]) continue;
    const comp: number[] = [];
    const stack = [start];
    seen[start] = 1;
    while (stack.length > 0) {
      const f = stack.pop()!;
      comp.push(f);
      for (const link of neighbors[f]!) {
        if (seen[link.face]) continue;
        seen[link.face] = 1;
        stack.push(link.face);
      }
    }
    let seed = comp[0]!;
    let best = -1;
    for (const f of comp) {
      const c = front[f]!;
      const [ax, ay, az] = at(c[0]);
      const [bx, by, bz] = at(c[1]);
      const [cx, cy, cz] = at(c[2]);
      const dx = (ax + bx + cx) / 3 - ox;
      const dy = (ay + by + cy) / 3 - oy;
      const dz = (az + bz + cz) / 3 - oz;
      const d = dx * dx + dy * dy + dz * dz;
      if (d > best) {
        best = d;
        seed = f;
      }
    }
    flip[seed] = outward(seed) < 0 ? 1 : 0;
    const oriented = new Uint8Array(faceCount);
    const queue = [seed];
    oriented[seed] = 1;
    for (let q = 0; q < queue.length; q++) {
      const f = queue[q]!;
      for (const link of neighbors[f]!) {
        if (oriented[link.face]) continue;
        flip[link.face] = flip[f]! ^ (link.sameDir ? 1 : 0);
        oriented[link.face] = 1;
        queue.push(link.face);
      }
    }
  }
  for (let f = 0; f < faceCount; f++) {
    const base = f * 6 + (flip[f] ? 3 : 0);
    out[f * 3] = input.indices[base]!;
    out[f * 3 + 1] = input.indices[base + 1]!;
    out[f * 3 + 2] = input.indices[base + 2]!;
  }
  return out;
}

function fbxNodes(
  safe: string,
  positions: Float64Array,
  polys: Int32Array,
  normals: Float64Array,
  normalW: Float64Array,
  uv0: Float64Array,
  uv1: Float64Array,
  uvIndex: Int32Array
): FbxNode[] {
  const stamp = node('CreationTimeStamp', [], [
    leaf('Version', ii(1000)),
    leaf('Year', ii(1970)),
    leaf('Month', ii(1)),
    leaf('Day', ii(1)),
    leaf('Hour', ii(10)),
    leaf('Minute', ii(0)),
    leaf('Second', ii(0)),
    leaf('Millisecond', ii(0)),
  ]);
  const header = node('FBXHeaderExtension', [], [
    leaf('FBXHeaderVersion', ii(1003)),
    leaf('FBXVersion', ii(7400)),
    leaf('EncryptionType', ii(0)),
    stamp,
    leaf('Creator', ss('Brick-Racer')),
  ]);
  const settings = node('GlobalSettings', [], [
    leaf('Version', ii(1000)),
    node('Properties70', [], [
      propP([ss('UpAxis'), ss('int'), ss('Integer'), ss(''), ii(1)]),
      propP([ss('UpAxisSign'), ss('int'), ss('Integer'), ss(''), ii(1)]),
      propP([ss('FrontAxis'), ss('int'), ss('Integer'), ss(''), ii(2)]),
      propP([ss('FrontAxisSign'), ss('int'), ss('Integer'), ss(''), ii(1)]),
      propP([ss('CoordAxis'), ss('int'), ss('Integer'), ss(''), ii(0)]),
      propP([ss('CoordAxisSign'), ss('int'), ss('Integer'), ss(''), ii(1)]),
      propP([ss('OriginalUpAxis'), ss('int'), ss('Integer'), ss(''), ii(1)]),
      propP([ss('OriginalUpAxisSign'), ss('int'), ss('Integer'), ss(''), ii(1)]),
      propP([ss('UnitScaleFactor'), ss('double'), ss('Number'), ss(''), dd(1)]),
      propP([ss('OriginalUnitScaleFactor'), ss('double'), ss('Number'), ss(''), dd(1)]),
      propP([ss('AmbientColor'), ss('ColorRGB'), ss('Color'), ss(''), dd(0), dd(0), dd(0)]),
      propP([ss('DefaultCamera'), ss('KString'), ss(''), ss(''), ss('Producer Perspective')]),
      propP([ss('TimeMode'), ss('enum'), ss(''), ss(''), ii(6)]),
      propP([ss('TimeSpanStart'), ss('KTime'), ss('Time'), ss(''), ll(0)]),
      propP([ss('TimeSpanStop'), ss('KTime'), ss('Time'), ss(''), ll(46186158000)]),
    ]),
  ]);
  const documents = node('Documents', [], [
    leaf('Count', ii(1)),
    node('Document', [ll(3000), ss('Document'), ss('Scene')], [
      node('Properties70', [], [
        propP([ss('SourceObject'), ss('object'), ss(''), ss('')]),
        propP([ss('ActiveAnimStackName'), ss('KString'), ss(''), ss(''), ss('')]),
      ]),
      leaf('RootNode', ii(0)),
    ]),
  ]);
  const objectType = (name: string): FbxNode =>
    node('ObjectType', [ss(name)], [leaf('Count', ii(1))]);
  const definitions = node('Definitions', [], [
    leaf('Version', ii(100)),
    leaf('Count', ii(3)),
    objectType('GlobalSettings'),
    objectType('Model'),
    objectType('Geometry'),
  ]);
  const uvLayer = (name: string, values: Float64Array): FbxNode =>
    node('LayerElementUV', [], [
      leaf('Version', ii(101)),
      leaf('Name', ss(name)),
      leaf('MappingInformationType', ss('ByPolygonVertex')),
      leaf('ReferenceInformationType', ss('IndexToDirect')),
      node('UV', [{ k: 'd', v: values }]),
      node('UVIndex', [{ k: 'i', v: uvIndex }]),
    ]);
  const layerElem = (type: string, index: number): FbxNode =>
    node('LayerElement', [], [leaf('Type', ss(type)), leaf('TypedIndex', ii(index))]);
  const geometry = node('Geometry', [ll(1000), ss(`Geometry::${safe}`), ss('Mesh')], [
    node('Vertices', [{ k: 'd', v: positions }]),
    node('PolygonVertexIndex', [{ k: 'i', v: polys }]),
    leaf('GeometryVersion', ii(124)),
    node('LayerElementNormal', [], [
      leaf('Version', ii(101)),
      leaf('Name', ss('')),
      leaf('MappingInformationType', ss('ByPolygonVertex')),
      leaf('ReferenceInformationType', ss('Direct')),
      node('Normals', [{ k: 'd', v: normals }]),
      node('NormalsW', [{ k: 'd', v: normalW }]),
    ]),
    uvLayer('UV0', uv0),
    uvLayer('UV1', uv1),
    node('Layer', [], [leaf('Version', ii(100)), layerElem('LayerElementNormal', 0), layerElem('LayerElementUV', 0)]),
    node('Layer', [], [leaf('Version', ii(100)), layerElem('LayerElementUV', 1)]),
  ]);
  const model = node('Model', [ll(2000), ss(`Model::${safe}`), ss('Mesh')], [
    leaf('Version', ii(232)),
    node('Properties70', [], [
      propP([ss('RotationActive'), ss('bool'), ss(''), ss(''), ii(1)]),
      propP([ss('InheritType'), ss('enum'), ss(''), ss(''), ii(1)]),
      propP([ss('ScalingMax'), ss('Vector3D'), ss('Vector'), ss(''), dd(0), dd(0), dd(0)]),
      propP([ss('DefaultAttributeIndex'), ss('int'), ss('Integer'), ss(''), ii(0)]),
      propP([ss('Lcl Translation'), ss('Lcl Translation'), ss(''), ss('A'), dd(0), dd(0), dd(0)]),
      propP([ss('Lcl Rotation'), ss('Lcl Rotation'), ss(''), ss('A'), dd(0), dd(0), dd(0)]),
      propP([ss('Lcl Scaling'), ss('Lcl Scaling'), ss(''), ss('A'), dd(1), dd(1), dd(1)]),
      propP([ss('Visibility'), ss('Visibility'), ss(''), ss('A'), dd(1)]),
    ]),
    leaf('Shading', { k: 'C', v: 1 }),
    leaf('Culling', ss('CullingOff')),
  ]);
  return [
    header,
    node('FileId', [{ k: 'R', v: FILE_ID }]),
    leaf('CreationTime', ss('1970-01-01 10:00:00:000')),
    settings,
    documents,
    definitions,
    node('Objects', [], [geometry, model]),
    node('Connections', [], [
      node('C', [ss('OO'), ll(2000), ll(0)]),
      node('C', [ss('OO'), ll(1000), ll(2000)]),
    ]),
  ];
}

function encodeFbx(nodes: FbxNode[]): Uint8Array {
  const header = 27;
  let body = 0;
  for (const item of nodes) body += nodeSize(item);
  const afterSentinel = header + body + 13;
  const footer = footerSize(afterSentinel);
  const out = new Uint8Array(afterSentinel + footer);
  out.set(MAGIC, 0);
  const view = new DataView(out.buffer);
  view.setUint32(23, 7400, true);
  let cursor = header;
  for (const item of nodes) cursor = writeNode(item, view, out, cursor);
  cursor += 13;
  writeFooter(out, view, cursor);
  return out;
}

function footerSize(pos: number): number {
  const at = pos + 16 + 4;
  let pad = (16 - (at % 16)) % 16;
  if (pad === 0) pad = 16;
  return 16 + 4 + pad + 4 + 120 + 16;
}

function writeFooter(out: Uint8Array, view: DataView, pos: number): void {
  out.set(FOOT_ID, pos);
  pos += 16;
  pos += 4;
  const at = pos;
  let pad = (16 - (at % 16)) % 16;
  if (pad === 0) pad = 16;
  pos += pad;
  view.setUint32(pos, 7400, true);
  pos += 4 + 120;
  out.set(FOOT_MAGIC, pos);
}

function nodeSize(item: FbxNode): number {
  const nameLen = utf8.encode(item.name).length;
  let props = 0;
  for (const prop of item.props) props += propSize(prop);
  let children = 0;
  for (const child of item.children) children += nodeSize(child);
  return 13 + nameLen + props + children + (item.children.length > 0 ? 13 : 0);
}

function propSize(prop: FbxProp): number {
  switch (prop.k) {
    case 'I':
      return 5;
    case 'L':
    case 'D':
      return 9;
    case 'C':
      return 2;
    case 'S':
      return 5 + utf8.encode(prop.v).length;
    case 'R':
      return 5 + prop.v.byteLength;
    case 'd':
      return 13 + prop.v.length * 8;
    case 'i':
      return 13 + prop.v.length * 4;
  }
}

function writeNode(item: FbxNode, view: DataView, out: Uint8Array, offset: number): number {
  const start = offset;
  const name = utf8.encode(item.name);
  let props = 0;
  for (const prop of item.props) props += propSize(prop);
  const end = start + nodeSize(item);
  view.setUint32(offset, end, true);
  view.setUint32(offset + 4, item.props.length, true);
  view.setUint32(offset + 8, props, true);
  view.setUint8(offset + 12, name.length);
  offset += 13;
  out.set(name, offset);
  offset += name.length;
  for (const prop of item.props) offset = writeProp(prop, view, out, offset);
  for (const child of item.children) offset = writeNode(child, view, out, offset);
  if (item.children.length > 0) offset += 13;
  if (offset !== end) throw new Error(`FBX node ${item.name} ended at ${offset}, expected ${end}`);
  return end;
}

function writeProp(prop: FbxProp, view: DataView, out: Uint8Array, offset: number): number {
  view.setUint8(offset, prop.k.charCodeAt(0));
  offset += 1;
  switch (prop.k) {
    case 'I':
      view.setInt32(offset, prop.v, true);
      return offset + 4;
    case 'L':
      view.setBigInt64(offset, BigInt(prop.v), true);
      return offset + 8;
    case 'D':
      view.setFloat64(offset, prop.v, true);
      return offset + 8;
    case 'C':
      view.setUint8(offset, prop.v ? 1 : 0);
      return offset + 1;
    case 'S': {
      const bytes = utf8.encode(prop.v);
      view.setUint32(offset, bytes.length, true);
      out.set(bytes, offset + 4);
      return offset + 4 + bytes.length;
    }
    case 'R':
      view.setUint32(offset, prop.v.byteLength, true);
      out.set(prop.v, offset + 4);
      return offset + 4 + prop.v.byteLength;
    case 'd':
      view.setUint32(offset, prop.v.length, true);
      view.setUint32(offset + 4, 0, true);
      view.setUint32(offset + 8, prop.v.length * 8, true);
      for (let i = 0; i < prop.v.length; i++) view.setFloat64(offset + 12 + i * 8, prop.v[i]!, true);
      return offset + 12 + prop.v.length * 8;
    case 'i':
      view.setUint32(offset, prop.v.length, true);
      view.setUint32(offset + 4, 0, true);
      view.setUint32(offset + 8, prop.v.length * 4, true);
      for (let i = 0; i < prop.v.length; i++) view.setInt32(offset + 12 + i * 4, prop.v[i]!, true);
      return offset + 12 + prop.v.length * 4;
  }
}
