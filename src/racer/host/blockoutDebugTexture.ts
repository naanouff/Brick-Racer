/**
 * @file blockoutDebugTexture.ts
 * @description Runtime debug grid for texel-density / readability (BO1g).
 */

import { TextureLoader, type Engine } from '@naanouff/w3dts-core';

/** Cache key in ResourceManager.textureCache. */
export const BO_DEBUG_GRID_TEXTURE_ID = 'bo_debug_grid';

/** Texture resolution (px). */
export const BO_DEBUG_GRID_SIZE = 1024;

/** Target env density (px per world unit / meter). */
export const BO_DEBUG_PX_PER_METER = 256;

/** Meters covered by one texture tile at env density. */
export const BO_DEBUG_TILE_METERS = BO_DEBUG_GRID_SIZE / BO_DEBUG_PX_PER_METER; // 4

/** texScale for world triplanar: UV = worldPos * texScale → 1 tile per TILE_METERS. */
export const BO_DEBUG_TEX_SCALE_ENV = 1 / BO_DEBUG_TILE_METERS; // 0.25

/** Kart object-space denser grid: 512 px/m → texScale = 0.5 (tile = 2 m). */
export const BO_DEBUG_TEX_SCALE_KART = 0.5;

function drawDebugGrid(ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D): void {
  const S = BO_DEBUG_GRID_SIZE;
  const cell = S / 4; // 1 m at 256 px/m
  const fine = cell / 4; // 0.25 m

  for (let gy = 0; gy < 4; gy++) {
    for (let gx = 0; gx < 4; gx++) {
      const x0 = gx * cell;
      const y0 = gy * cell;
      const even = (gx + gy) % 2 === 0;
      ctx.fillStyle = even ? '#c8c8c8' : '#9a9a9a';
      ctx.fillRect(x0, y0, cell, cell);

      ctx.fillStyle = '#2a2a2a';
      ctx.font = `bold ${Math.floor(cell * 0.18)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${gx},${gy}`, x0 + cell * 0.5, y0 + cell * 0.55);
    }
  }

  ctx.strokeStyle = 'rgba(40,40,40,0.45)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= S; i += fine) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, S);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(S, i);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(20,20,20,0.75)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= S; i += cell) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, S);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(S, i);
    ctx.stroke();
  }

  ctx.strokeStyle = '#111';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, S - 6, S - 6);

  // Orientation arrow (+X in texture U)
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.moveTo(cell * 0.2, cell * 0.25);
  ctx.lineTo(cell * 0.75, cell * 0.25);
  ctx.lineTo(cell * 0.75, cell * 0.15);
  ctx.lineTo(cell * 0.92, cell * 0.32);
  ctx.lineTo(cell * 0.75, cell * 0.49);
  ctx.lineTo(cell * 0.75, cell * 0.39);
  ctx.lineTo(cell * 0.2, cell * 0.39);
  ctx.closePath();
  ctx.fill();

  ctx.font = `bold ${Math.floor(S * 0.035)}px monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#111';
  ctx.fillText(`${BO_DEBUG_PX_PER_METER} px/m`, 16, S - 20);
}

/**
 * Builds the debug grid ImageBitmap (no GPU). Useful for tests / SSR-safe checks.
 */
export async function createDebugGridImageBitmap(): Promise<ImageBitmap> {
  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(BO_DEBUG_GRID_SIZE, BO_DEBUG_GRID_SIZE)
      : (() => {
          const c = document.createElement('canvas');
          c.width = BO_DEBUG_GRID_SIZE;
          c.height = BO_DEBUG_GRID_SIZE;
          return c;
        })();
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable for debug grid');
  drawDebugGrid(ctx as CanvasRenderingContext2D);
  if (canvas instanceof OffscreenCanvas) {
    return canvas.transferToImageBitmap();
  }
  return createImageBitmap(canvas);
}

/**
 * Uploads and registers `bo_debug_grid` on the engine resource manager (idempotent).
 */
export async function ensureBlockoutDebugTexture(engine: Engine): Promise<GPUTexture> {
  const rm = engine.resourceManager;
  const existing = rm.getTexture(BO_DEBUG_GRID_TEXTURE_ID);
  if (existing) return existing;

  const device = engine.webGPUContext.device;
  if (!device) throw new Error('WebGPU device required for debug grid texture');

  const bitmap = await createDebugGridImageBitmap();
  // flipY: canvas Y-down → GPU V-up so triplanar (uv=*.zy / *.xy) keeps labels upright on walls.
  const { texture, sampler } = TextureLoader.fromImageBitmap(device, bitmap, {
    generateMips: true,
    createSampler: true,
    flipY: true,
    samplerDescriptor: {
      addressModeU: 'repeat',
      addressModeV: 'repeat',
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'linear',
      maxAnisotropy: 16,
    },
  });
  bitmap.close?.();

  rm.registerTexture(BO_DEBUG_GRID_TEXTURE_ID, texture);
  return texture;
}

/**
 * Resolve `?debugTex=` — **default off** (triplanar grid is expensive; racing needs fps headroom).
 * Enable with `?debugTex=1` / `true` / `on`.
 */
export function resolveDebugTexEnabled(search = ''): boolean {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const v = (q.get('debugTex') ?? '0').toLowerCase();
  return v === '1' || v === 'true' || v === 'on';
}
