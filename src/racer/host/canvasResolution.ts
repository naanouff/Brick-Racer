/**
 * @file canvasResolution.ts
 * @description Cap backbuffer resolution for racing fps headroom (fill-rate bound).
 */

/** Max device-pixel ratio used for the game canvas (1 = CSS pixels). */
export const MAX_CANVAS_DPR = 1;

/**
 * Longest buffer edge in pixels. Full HD windows stay fill-rate bound even at DPR 1;
 * shrinking the window to ~720p jumps to 120 fps — so we render ≤ this and let CSS upscale.
 */
export const MAX_BUFFER_LONG_EDGE = 1280;

export type CanvasBufferSize = { width: number; height: number };

/**
 * Compute capped buffer size from CSS layout (uniform scale, never upscale above 1×).
 */
export function computeCanvasBufferSize(
  cssW: number,
  cssH: number,
  opts?: { dprCap?: number; maxLongEdge?: number; dpr?: number }
): CanvasBufferSize {
  const dprCap = opts?.dprCap ?? MAX_CANVAS_DPR;
  const maxLong = opts?.maxLongEdge ?? MAX_BUFFER_LONG_EDGE;
  const dpr = Math.min(opts?.dpr ?? 1, dprCap);
  let width = Math.max(1, Math.round(Math.max(1, cssW) * dpr));
  let height = Math.max(1, Math.round(Math.max(1, cssH) * dpr));
  const longEdge = Math.max(width, height);
  if (longEdge > maxLong) {
    const s = maxLong / longEdge;
    width = Math.max(1, Math.round(width * s));
    height = Math.max(1, Math.round(height * s));
  }
  return { width, height };
}

/**
 * Sync canvas buffer size to layout size, capped by DPR + {@link MAX_BUFFER_LONG_EDGE}.
 * CSS size stays full-window; GPU renders the smaller buffer (browser upscales).
 */
export function fitCanvasBuffer(
  canvas: HTMLCanvasElement,
  dprCap = MAX_CANVAS_DPR
): CanvasBufferSize {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const cssW = Math.max(1, canvas.clientWidth || canvas.width || 1);
  const cssH = Math.max(1, canvas.clientHeight || canvas.height || 1);
  const { width, height } = computeCanvasBufferSize(cssW, cssH, { dprCap, dpr });
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  return { width, height };
}
