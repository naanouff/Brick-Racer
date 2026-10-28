/**
 * @file catalogAgingTexture.ts
 * @description One shared 256² UV1 aging map. Materials bind it at level spawn; previews overwrite the pixels.
 */

import type { Engine } from '@naanouff/w3dts-core';
import { LDRAW_AGING_SIZE } from '../ldraw/ldrawAgingBake';

/** ResourceManager id. Sampled by MinifigPlasticPBR when useAgingMap = 1. */
export const CATALOG_AGING_TEXTURE_ID = 'CL_aging_map';

let neutral: Uint8Array | null = null;

/** R = 0, G = 0, B = 1 (open AO), A = 0. Shared buffer — do not mutate. */
export function neutralAgingPixels(size = LDRAW_AGING_SIZE): Uint8Array {
  if (neutral && neutral.length === size * size * 4) return neutral;
  const pixels = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) pixels[i * 4 + 2] = 255;
  neutral = pixels;
  return pixels;
}

export function ensureCatalogAgingTexture(engine: Engine): GPUTexture | null {
  const existing = engine.resourceManager.getTexture(CATALOG_AGING_TEXTURE_ID);
  if (existing && existing.width === LDRAW_AGING_SIZE && existing.height === LDRAW_AGING_SIZE) {
    return existing;
  }
  existing?.destroy();
  const device = engine.webGPUContext?.device;
  if (!device) return null;
  const size = LDRAW_AGING_SIZE;
  const texture = device.createTexture({
    label: CATALOG_AGING_TEXTURE_ID,
    size: { width: size, height: size },
    format: 'rgba8unorm',
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });
  device.queue.writeTexture(
    { texture },
    neutralAgingPixels(size) as Uint8Array<ArrayBuffer>,
    { bytesPerRow: size * 4 },
    { width: size, height: size }
  );
  engine.resourceManager.registerTexture(CATALOG_AGING_TEXTURE_ID, texture);
  return texture;
}

/** Replace the atlas pixels. The material keeps the same GPUTexture. */
export function uploadCatalogAgingTexture(engine: Engine, rgba: Uint8Array): void {
  const texture = ensureCatalogAgingTexture(engine);
  const device = engine.webGPUContext?.device;
  if (!texture || !device) return;
  const size = LDRAW_AGING_SIZE;
  if (rgba.byteLength !== size * size * 4) return;
  device.queue.writeTexture(
    { texture },
    rgba as Uint8Array<ArrayBuffer>,
    { bytesPerRow: size * 4 },
    { width: size, height: size }
  );
}
