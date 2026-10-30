/**
 * @file minifigUvGridDebug.ts
 * @description UV 0–1 debug grid for minifig-lab (read stretch / island layout).
 */

import { TextureLoader, type Engine } from '@naanouff/w3dts-core';
import type { MaterialSpec } from '../levels/shared/levelTypes';
import { MINIFIG_PLASTIC_SHADER_ID } from './plasticMaterial';

export const MINIFIG_UV_GRID_TEXTURE_ID = 'mf_uv_grid';
export const MINIFIG_UV_GRID_SHADER_ID = 'minifig_uv_grid';
export const MINIFIG_UV_GRID_SHADER_URL = '/shader-graphs/MinifigUVGridDebug.json';

/** GPROC parts use `minifig_plastic`; LDraw parts use the catalog graph. */
const UV_GRID_SOURCE_SHADERS = new Set([MINIFIG_PLASTIC_SHADER_ID, 'catalog_plastic']);

/** One texture tile = UV square [0,1]². */
export const MINIFIG_UV_GRID_SIZE = 1024;

/** Major divisions per axis (each cell = 0.1 UV). */
export const MINIFIG_UV_GRID_CELLS = 10;

function drawMinifigUvGrid(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D): void {
  const S = MINIFIG_UV_GRID_SIZE;
  const cells = MINIFIG_UV_GRID_CELLS;
  const cell = S / cells;

  const palette = ['#e8e8e8', '#b8b8b8'] as const;
  for (let gy = 0; gy < cells; gy++) {
    for (let gx = 0; gx < cells; gx++) {
      const x0 = gx * cell;
      const y0 = gy * cell;
      ctx.fillStyle = palette[(gx + gy) % 2]!;
      ctx.fillRect(x0, y0, cell, cell);

      ctx.fillStyle = '#1a1a1a';
      ctx.font = `bold ${Math.max(10, Math.floor(cell * 0.22))}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${gx},${gy}`, x0 + cell * 0.5, y0 + cell * 0.52);
    }
  }

  const fine = cell / 5;
  ctx.strokeStyle = 'rgba(30,30,30,0.35)';
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

  ctx.strokeStyle = '#111';
  ctx.lineWidth = 3;
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

  ctx.strokeStyle = '#000';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, S - 8, S - 8);

  ctx.fillStyle = '#c0392b';
  ctx.font = `bold ${Math.floor(S * 0.04)}px monospace`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('U →', S - 16, S - 12);

  ctx.fillStyle = '#27ae60';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('V ↑', 16, 12);

  ctx.fillStyle = '#111';
  ctx.font = `bold ${Math.floor(S * 0.028)}px monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('UV [0,1]', 16, S - 12);
}

export async function createMinifigUvGridImageBitmap(): Promise<ImageBitmap> {
  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(MINIFIG_UV_GRID_SIZE, MINIFIG_UV_GRID_SIZE)
      : (() => {
          const c = document.createElement('canvas');
          c.width = MINIFIG_UV_GRID_SIZE;
          c.height = MINIFIG_UV_GRID_SIZE;
          return c;
        })();
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable for minifig UV grid');
  drawMinifigUvGrid(ctx as CanvasRenderingContext2D);
  if (canvas instanceof OffscreenCanvas) {
    return canvas.transferToImageBitmap();
  }
  return createImageBitmap(canvas);
}

export async function ensureMinifigUvGridTexture(engine: Engine): Promise<GPUTexture> {
  const rm = engine.resourceManager;
  const existing = rm.getTexture(MINIFIG_UV_GRID_TEXTURE_ID);
  if (existing) return existing;

  const device = engine.webGPUContext.device;
  if (!device) throw new Error('WebGPU device required for minifig UV grid');

  const bitmap = await createMinifigUvGridImageBitmap();
  const { texture } = TextureLoader.fromImageBitmap(device, bitmap, {
    generateMips: true,
    createSampler: false,
    flipY: true,
  });
  bitmap.close?.();
  rm.registerTexture(MINIFIG_UV_GRID_TEXTURE_ID, texture);
  return texture;
}

/** `?uvGrid=1` / `true` / `on` on minifig-lab. */
export function resolveMinifigUvGridEnabled(search = ''): boolean {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const v = (q.get('uvGrid') ?? '0').toLowerCase();
  return v === '1' || v === 'true' || v === 'on';
}

/** Swaps minifig plastic mats to flat UV-grid preview (all body gproc parts). */
export function applyMinifigUvGridDebugMaterials(materials: Record<string, MaterialSpec>): void {
  for (const spec of Object.values(materials)) {
    if (!UV_GRID_SOURCE_SHADERS.has(spec.shaderGraphId)) continue;
    spec.shaderGraphId = MINIFIG_UV_GRID_SHADER_ID;
    spec.properties = {
      baseColor: [1, 1, 1, 1],
      roughness: 0.42,
      metallic: 0,
      opacity: 1,
      baseColorTexture: MINIFIG_UV_GRID_TEXTURE_ID,
    };
  }
}
