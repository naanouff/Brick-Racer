/**
 * @file flattenPrintDecal.ts
 * @description Crop framed Nano-Banana illustrations into full-bleed print decals
 * (strip silhouette outlines via border flood-fill, stretch to square).
 *
 * Run: pnpm flatten:minifig-prints
 * Inputs: public/minifig/prints/*.source.webp
 */

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

type Rgb = readonly [number, number, number];

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function dist2(a: Rgb, b: Rgb): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

function parseHex(hex: string): Rgb {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

/** Dark enough to be a silhouette/frame stroke (not grease mid-tones). */
function isOutline(r: number, g: number, b: number): boolean {
  return (r + g + b) / 3 < 70;
}

async function flatten(
  inputRel: string,
  outputRel: string,
  bgHex: string,
  size: number,
  insetFrac: number
): Promise<void> {
  const input = resolve(root, inputRel);
  const output = resolve(root, outputRel);
  const bg = parseHex(bgHex);
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const tol = 50 * 50;

  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      const rgb: Rgb = [data[i]!, data[i + 1]!, data[i + 2]!];
      if (dist2(rgb, bg) > tol) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < minX) throw new Error(`No content in ${inputRel}`);

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const pad = Math.max(6, Math.floor(Math.min(bw, bh) * insetFrac));
  const left = minX + pad;
  const top = minY + pad;
  const width = Math.max(8, bw - 2 * pad);
  const height = Math.max(8, bh - 2 * pad);

  const raw = await sharp(input)
    .extract({ left, top, width, height })
    .resize(size, size, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const d = raw.data;
  const w = raw.info.width;
  const h = raw.info.height;
  const seen = new Uint8Array(w * h);
  const q: number[] = [];
  const push = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const id = y * w + x;
    if (seen[id]) return;
    const i = id * 4;
    if (!isOutline(d[i]!, d[i + 1]!, d[i + 2]!)) return;
    seen[id] = 1;
    q.push(id);
  };
  for (let x = 0; x < w; x++) {
    for (let o = 0; o <= 3; o++) {
      push(x, o);
      push(x, h - 1 - o);
    }
  }
  for (let y = 0; y < h; y++) {
    for (let o = 0; o <= 3; o++) {
      push(o, y);
      push(w - 1 - o, y);
    }
  }
  for (let qi = 0; qi < q.length; qi++) {
    const id = q[qi]!;
    const x = id % w;
    const y = (id - x) / w;
    d[id * 4] = bg[0];
    d[id * 4 + 1] = bg[1];
    d[id * 4 + 2] = bg[2];
    d[id * 4 + 3] = 255;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  writeFileSync(
    output,
    await sharp(d, { raw: { width: w, height: h, channels: 4 } }).webp({ quality: 90 }).toBuffer()
  );
  console.log(`wrote ${outputRel} ← ${width}×${height} @ (${left},${top})`);
}

async function main(): Promise<void> {
  await flatten(
    'public/minifig/prints/face-frown-stubble-orange.source.webp',
    'public/minifig/prints/face-frown-stubble-orange.webp',
    '#F5D76E',
    512,
    0.08
  );
  await flatten(
    'public/minifig/prints/torso-mechanic.source.webp',
    'public/minifig/prints/torso-mechanic.webp',
    '#1B4F72',
    1024,
    0.08
  );
  await flatten(
    'public/minifig/prints/face-frown-stubble-orange.source.webp',
    'docs/design/art/minifig/prints/face-frown-stubble-orange.webp',
    '#F5D76E',
    512,
    0.08
  );
  await flatten(
    'public/minifig/prints/torso-mechanic.source.webp',
    'docs/design/art/minifig/prints/torso-mechanic.webp',
    '#1B4F72',
    1024,
    0.08
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
