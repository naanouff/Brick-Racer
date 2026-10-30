/**
 * @file renderQuality.ts
 * @project brick-racer
 * @description Lit render graph selection: HBAO+grading by default, full showcase opt-in (`?render=showcase`).
 */

export type RenderQuality = 'fast' | 'showcase';

export const RENDER_GRAPH_BY_QUALITY: Record<RenderQuality, string> = {
  fast: '/graphs/BrickRacerFast.json',
  showcase: '/graphs/StandardLitGraphKart.json',
};

export function resolveRenderQuality(search = globalThis.location?.search ?? ''): RenderQuality {
  return new URLSearchParams(search).get('render') === 'showcase' ? 'showcase' : 'fast';
}

export function litRenderGraphPath(quality: RenderQuality = resolveRenderQuality()): string {
  return RENDER_GRAPH_BY_QUALITY[quality];
}
