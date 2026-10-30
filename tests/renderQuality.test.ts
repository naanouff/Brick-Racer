import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { litRenderGraphPath, resolveRenderQuality } from '../src/racer/host/renderQuality';

describe('render quality', () => {
  it('defaults to the fast graph', () => {
    expect(resolveRenderQuality('')).toBe('fast');
    expect(resolveRenderQuality('?render=other')).toBe('fast');
    expect(resolveRenderQuality('?render=showcase')).toBe('showcase');
  });

  it('fast graph has HBAO + grading without shadows / SSR / bloom / AA', () => {
    const graph = JSON.parse(readFileSync(`public${litRenderGraphPath('fast')}`, 'utf8')) as {
      passes: Array<{ name: string; viewType?: string; shaderPath?: string; builtInPipeline?: string }>;
    };
    expect(graph.passes.some((p) => p.viewType === 'shadow')).toBe(false);
    expect(graph.passes.some((p) => p.builtInPipeline === 'skybox')).toBe(true);
    const shaders = graph.passes.map((p) => p.shaderPath ?? '').join(' ');
    expect(shaders).toMatch(/hbao\.frag/);
    expect(shaders).toMatch(/color_grading/);
    expect(shaders).toMatch(/tonemapping/);
    expect(shaders).not.toMatch(/ssr|bloom|bright|fxaa|dof/i);
  });
});
