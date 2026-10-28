/**
 * @file catalogStudioHdr.ts
 * @description High-contrast studio HDR for catalog-lab: a hard sun over a dim ground.
 * Equirect row 0 is +Y (sky), matching equirect-to-cube.frag.wgsl.
 */

/** Radiance RGBE bytes. Sun sits near the catalog key light. */
export function buildCatalogStudioHdr(): ArrayBuffer {
  const width = 256;
  const height = 128;
  const rgbe = new Uint8Array(width * height * 4);
  // Key light comes from the opposite of CL_Sun direction (0.35, -0.85, 0.4).
  const sunU = 0.136;
  const sunV = 0.178;
  for (let y = 0; y < height; y++) {
    const v = (y + 0.5) / height;
    const up = Math.cos(v * Math.PI);
    for (let x = 0; x < width; x++) {
      const u = (x + 0.5) / width;
      const du = Math.min(Math.abs(u - sunU), 1 - Math.abs(u - sunU));
      const dv = v - sunV;
      const sun = Math.exp(-(du * du + dv * dv) * 1800);
      const sky = up > 0 ? 0.15 + 0.45 * up : 0;
      const ground = up < 0 ? 0.045 * (1 + up) : 0;
      const r = sky * 0.55 + ground * 0.9 + sun * 48;
      const g = sky * 0.72 + ground * 0.75 + sun * 46;
      const b = sky * 1.05 + ground * 0.55 + sun * 40;
      const px = (y * width + x) * 4;
      const enc = encodeRgbe(r, g, b);
      rgbe[px] = enc[0];
      rgbe[px + 1] = enc[1];
      rgbe[px + 2] = enc[2];
      rgbe[px + 3] = enc[3];
    }
  }

  const header = new TextEncoder().encode(
    `#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`
  );
  const body = rleScanlines(rgbe, width, height);
  const out = new Uint8Array(header.byteLength + body.length);
  out.set(header, 0);
  out.set(body, header.byteLength);
  return out.buffer;
}

function encodeRgbe(r: number, g: number, b: number): [number, number, number, number] {
  const v = Math.max(r, g, b);
  if (v < 1e-32) return [0, 0, 0, 0];
  const e = Math.ceil(Math.log2(v)) + 128;
  const scale = 255 * 2 ** (128 - e);
  return [
    Math.min(255, Math.round(r * scale)),
    Math.min(255, Math.round(g * scale)),
    Math.min(255, Math.round(b * scale)),
    e,
  ];
}

function rleScanlines(rgbe: Uint8Array, width: number, height: number): Uint8Array {
  const chunks: number[] = [];
  for (let y = 0; y < height; y++) {
    chunks.push(2, 2, (width >> 8) & 255, width & 255);
    for (let c = 0; c < 4; c++) {
      const plane = new Uint8Array(width);
      for (let x = 0; x < width; x++) plane[x] = rgbe[(y * width + x) * 4 + c]!;
      let i = 0;
      while (i < width) {
        let run = 1;
        while (i + run < width && plane[i + run] === plane[i] && run < 127) run++;
        chunks.push(128 + run, plane[i]!);
        i += run;
      }
    }
  }
  return Uint8Array.from(chunks);
}
