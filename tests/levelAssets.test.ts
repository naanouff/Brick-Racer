import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GProcExecutor, bootstrapGProcRuntime, type GProcGraph } from '@naanouff/w3dts-gproc';
import { sandboxKartSpec } from '../src/racer/levels/sandboxKart/sandboxKartSpec';
import { isW3dtsMonoAvailable } from '../w3dtsMonoAliases';

const publicDir = resolve(__dirname, '../public');

function readPublic(url: string): string {
  return readFileSync(resolve(publicDir, url.replace(/^\//, '')), 'utf8');
}

describe('sandbox kart assets', () => {
  it.skipIf(!isW3dtsMonoAvailable())('every geometry graph executes with the bundled gproc', () => {
    bootstrapGProcRuntime();
    for (const ref of sandboxKartSpec.geometryGraphs) {
      const graph = JSON.parse(readPublic(ref.url)) as GProcGraph;
      const result = GProcExecutor.executeDetailed(graph, {});
      expect(result.errors, ref.id).toEqual([]);
      expect(result.ok, ref.id).toBe(true);
    }
  });

  it('shader templates only use bindings declared by core 0.0.37', () => {
    // core 0.0.37 has no hybrid AOV bindings; newer viewer-editor templates fail to compile.
    const pbr = readPublic('/shaders/graph_templates/pbr_master_node.wgsl');
    expect(pbr).not.toContain('hybridShadowAov');
  });
});
