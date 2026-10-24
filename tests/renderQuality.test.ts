import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { litRenderGraphPath, resolveRenderQuality } from '../src/racer/host/renderQuality';

describe('render quality', () => {
  it('defaults to the fast graph', () => {
    expect(resolveRenderQuality('')).toBe('fast');
    expect(resolveRenderQuality('?render=other')).toBe('fast');
    expect(resolveRenderQuality('?render=showcase')).toBe('showcase');
  });

  it('fast graph has no costly post passes', () => {
    const graph = JSON.parse(readFileSync(`public${litRenderGraphPath('fast')}`, 'utf8')) as {
      passes: Array<{ name: string; viewType?: string; shaderPath?: string; builtInPipeline?: string }>;
    };
    expect(graph.passes.some((p) => p.viewType === 'shadow')).toBe(false);
    expect(graph.passes.some((p) => p.builtInPipeline === 'skybox')).toBe(true);
    const shaders = graph.passes.map((p) => p.shaderPath ?? '').join(' ');
    expect(shaders).not.toMatch(/hbao|ssr|bloom|blur|bright|fxaa|dof/i);
    expect(shaders).toMatch(/tonemapping/);
  });
});
