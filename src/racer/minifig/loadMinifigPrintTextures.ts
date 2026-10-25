/**
 * @file loadMinifigPrintTextures.ts
 * @description Upload minifig print WebP (+ 1×1 white) into ResourceManager (BRICK-MF3d).
 */

import { TextureLoader, type Engine } from '@naanouff/w3dts-core';
import { MINIFIG_FLAT_NORMAL_ID } from './plasticMapSets';
import { MINIFIG_WHITE_TEXTURE_ID } from './plasticMaterial';

async function ensureWhiteTexture(engine: Engine): Promise<void> {
  const rm = engine.resourceManager;
  if (rm.getTexture(MINIFIG_WHITE_TEXTURE_ID)) return;
  const device = engine.webGPUContext?.device;
  if (!device) return;

  const data = new Uint8Array([255, 255, 255, 255]);
  const texture = device.createTexture({
    label: MINIFIG_WHITE_TEXTURE_ID,
    size: { width: 1, height: 1 },
    format: 'rgba8unorm',
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });
  device.queue.writeTexture({ texture }, data, { bytesPerRow: 4 }, { width: 1, height: 1 });
  rm.registerTexture(MINIFIG_WHITE_TEXTURE_ID, texture);

  if (rm.getTexture(MINIFIG_FLAT_NORMAL_ID)) return;
  const flat = device.createTexture({
    label: MINIFIG_FLAT_NORMAL_ID,
    size: { width: 1, height: 1 },
    format: 'rgba8unorm',
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });
  device.queue.writeTexture(
    { texture: flat },
    new Uint8Array([128, 128, 255, 255]),
    { bytesPerRow: 4 },
    { width: 1, height: 1 }
  );
  rm.registerTexture(MINIFIG_FLAT_NORMAL_ID, flat);
}

async function loadUrlTexture(engine: Engine, url: string): Promise<void> {
  const rm = engine.resourceManager;
  if (rm.getTexture(url)) return;
  const device = engine.webGPUContext?.device;
  if (!device) return;

  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`[minifig] failed to load print texture ${url}: ${res.status}`);
    return;
  }
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  // Browser-decoded WebP: flipY so V=0 is image bottom (matches unwrap V↑).
  const { texture } = TextureLoader.fromImageBitmap(device, bitmap, {
    generateMips: true,
    createSampler: false,
    flipY: true,
  });
  bitmap.close?.();
  rm.registerTexture(url, texture);
}

/**
 * Ensures white + every `baseColorTexture` URL referenced by materials is uploaded.
 */
export async function ensureMinifigPrintTextures(
  engine: Engine,
  materials: Record<string, { properties?: Record<string, unknown> }>
): Promise<void> {
  await ensureWhiteTexture(engine);
  const urls = new Set<string>();
  for (const spec of Object.values(materials)) {
    for (const value of Object.values(spec.properties ?? {})) {
      if (typeof value === 'string' && value.startsWith('/')) urls.add(value);
    }
  }
  await Promise.all([...urls].map((url) => loadUrlTexture(engine, url)));
}
