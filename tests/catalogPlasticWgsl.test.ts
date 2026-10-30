/**
 * @file catalogPlasticWgsl.test.ts
 * @description Compile CatalogPlasticPBR to WGSL offline and check the UV1 aging sample.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Material, ShaderGraphCompiler, type ShaderGraph } from '@naanouff/w3dts-core';

type FetchStub = (url: string) => Promise<{
  ok: boolean;
  status: number;
  text: () => Promise<string>;
  json: () => Promise<unknown>;
}>;

async function compileFragment(graphFile: string): Promise<string> {
  const g = globalThis as unknown as { fetch: FetchStub };
  const realFetch = g.fetch;
  g.fetch = async (url) => {
    const text = readFileSync(`public${String(url).split('?')[0]}`, 'utf8');
    return { ok: true, status: 200, text: async () => text, json: async () => JSON.parse(text) };
  };
  try {
    const silent = new Proxy({}, { get: () => () => undefined });
    const compiler = new ShaderGraphCompiler(silent as never);
    await compiler.initialize();
    const graph = JSON.parse(readFileSync(graphFile, 'utf8')) as ShaderGraph;
    const mat = new Material({ name: 'wgsl-test', shaderGraph: graph } as never);
    const out = await compiler.compile(graph, mat, {
      alphaMode: 'OPAQUE',
      hasShadows: true,
      hasIBL: true,
    } as never);
    return out.fragmentWGSL;
  } finally {
    g.fetch = realFetch;
  }
}

describe('CatalogPlasticPBR WGSL', () => {
  it('samples the aging map on UV1 through a bound texture, not the ORM slot', async () => {
    const wgsl = await compileFragment('public/shader-graphs/CatalogPlasticPBR.json');
    expect(wgsl).toMatch(/textureSample\(baseColorTexture, textureSampler, var_aging_uv\)/);
    expect(wgsl).toContain('let var_aging_uv = input.uv1;');
    expect(wgsl).not.toMatch(/material\.\w+Texture/);
    const sampled = new Set(
      [...wgsl.matchAll(/@group\(1\) @binding\(\d+\) var (\w+): texture_/g)].map((m) => m[1])
    );
    expect(sampled.size).toBeLessThanOrEqual(8);
  });

  it('shows the UV grid on UV0 or UV1 from uvChannel', async () => {
    const wgsl = await compileFragment('public/shader-graphs/MinifigUVGridDebug.json');
    expect(wgsl).toContain('let var_uv1_node = input.uv1;');
    expect(wgsl).toContain('mix(var_tf_uv_albedo, var_uv1_node, material.uvChannel)');
  });
});
