/**
 * @file blockoutDebugTexture.test.ts
 * @description Debug grid materials + shader graph wiring (no GPU).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BO_DEBUG_GRID_TEXTURE_ID,
  BO_DEBUG_PX_PER_METER,
  BO_DEBUG_TEX_SCALE_ENV,
  BO_DEBUG_TILE_METERS,
  resolveDebugTexEnabled,
} from '../src/racer/host/blockoutDebugTexture';
import { blockoutMaterials } from '../src/racer/levels/shared/blockoutKit';

describe('debug tex query', () => {
  it('defaults off; 1/true/on enables', () => {
    expect(resolveDebugTexEnabled('')).toBe(false);
    expect(resolveDebugTexEnabled('?level=race-test')).toBe(false);
    expect(resolveDebugTexEnabled('?debugTex=0')).toBe(false);
    expect(resolveDebugTexEnabled('?debugTex=1')).toBe(true);
    expect(resolveDebugTexEnabled('?debugTex=true')).toBe(true);
    expect(resolveDebugTexEnabled('?debugTex=on')).toBe(true);
  });
});

describe('texel density convention', () => {
  it('256 px/m → 1024 covers 4 m → texScale 0.25', () => {
    expect(BO_DEBUG_PX_PER_METER).toBe(256);
    expect(BO_DEBUG_TILE_METERS).toBe(4);
    expect(BO_DEBUG_TEX_SCALE_ENV).toBeCloseTo(0.25, 5);
  });
});

describe('blockoutMaterials debug grid', () => {
  it('opaque BO_* use bo_grid + texture id when debug on', () => {
    const mats = blockoutMaterials({ debugTex: true });
    expect(mats.BO_Asphalt?.shaderGraphId).toBe('bo_grid');
    expect(mats.BO_Asphalt?.properties.baseColorTexture).toBe(BO_DEBUG_GRID_TEXTURE_ID);
    expect(mats.BO_Asphalt?.properties.texScale).toBe(BO_DEBUG_TEX_SCALE_ENV);
    expect(mats.BK_Body?.shaderGraphId).toBe('bo_grid_obj');
  });

  it('BO_Cp / BO_Trigger are opaque (no BLEND transparent queue)', () => {
    const mats = blockoutMaterials({ debugTex: false });
    expect(mats.BO_Cp?.shaderGraphId).toBe('pbr');
    expect(mats.BO_Trigger?.shaderGraphId).toBe('pbr');
    expect(mats.BO_Cp?.properties.alphaMode).toBeUndefined();
    expect(mats.BO_Cp?.properties.tag).toBeUndefined();
  });

  it('debug off → solid pbr for opaques', () => {
    const mats = blockoutMaterials({ debugTex: false });
    expect(mats.BO_Wall?.shaderGraphId).toBe('pbr');
    expect(mats.BO_Wall?.properties.baseColorTexture).toBeUndefined();
  });
});

describe('BlockoutGrid shader graphs', () => {
  for (const name of ['BlockoutGridPBR', 'BlockoutGridObjectPBR']) {
    it(`${name} wires TriPlanarSample → PBRMasterNode`, () => {
      const raw = readFileSync(
        resolve(__dirname, `../public/shader-graphs/${name}.json`),
        'utf8'
      );
      const graph = JSON.parse(raw) as {
        nodes: Array<{ id: string; type: string }>;
        connections: Array<{ fromNodeId: string; toNodeId: string }>;
      };
      expect(graph.nodes.some((n) => n.type === 'TriPlanarSample')).toBe(true);
      expect(graph.nodes.some((n) => n.type === 'PBRMasterNode')).toBe(true);
      const tri = graph.nodes.find((n) => n.type === 'TriPlanarSample')!;
      const master = graph.nodes.find((n) => n.type === 'PBRMasterNode')!;
      // tinted path: triplanar → tinted → … → master
      const reachesMaster = (fromId: string, depth = 0): boolean => {
        if (depth > 12) return false;
        if (fromId === master.id) return true;
        return graph.connections
          .filter((c) => c.fromNodeId === fromId)
          .some((c) => reachesMaster(c.toNodeId, depth + 1));
      };
      expect(reachesMaster(tri.id)).toBe(true);
    });
  }
});
