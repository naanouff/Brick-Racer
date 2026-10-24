import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { litRenderGraphPath, resolveRenderQuality } from '../src/racer/host/renderQuality';

describe('render quality', () => {
  it('defaults to the fast graph', () => {
    expect(resolveRenderQuality('')).toBe('fast');
    expect(resolveRenderQuality('?render=other')).toBe('fast');
    expect(resolveRenderQuality('?render=showcase')).toBe('showcase');
  });

  it('fast graph has no costly passes', () => {
    const graph = JSON.parse(readFileSync(`public${litRenderGraphPath('fast')}`, 'utf8')) as {
      passes: Array<{ name: string; viewType?: string; shaderPath?: string }>;
    };
    expect(graph.passes.some((p) => p.viewType === 'shadow')).toBe(false);
    const shaders = graph.passes.map((p) => p.shaderPath ?? '').join(' ');
    expect(shaders).not.toMatch(/hbao|ssr|bloom|blur|bright|fxaa|dof/i);
  });
});
