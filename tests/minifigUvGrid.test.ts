/**
 * @file minifigUvGrid.test.ts
 * @description Minifig UV grid debug mode wiring.
 */

import { describe, expect, it } from 'vitest';
import { buildMinifigLabSpec } from '../src/racer/levels/minifigLab';
import {
  MINIFIG_UV_GRID_SHADER_ID,
  MINIFIG_UV_GRID_TEXTURE_ID,
  applyMinifigUvGridDebugMaterials,
  resolveMinifigUvGridEnabled,
} from '../src/racer/minifig/minifigUvGridDebug';
import { MINIFIG_PLASTIC_SHADER_ID } from '../src/racer/minifig/plasticMaterial';

describe('minifig UV grid debug', () => {
  it('resolveMinifigUvGridEnabled reads ?uvGrid=', () => {
    expect(resolveMinifigUvGridEnabled('')).toBe(false);
    expect(resolveMinifigUvGridEnabled('?uvGrid=1')).toBe(true);
    expect(resolveMinifigUvGridEnabled('?uvGrid=on')).toBe(true);
  });

  it('applyMinifigUvGridDebugMaterials swaps plastic shader + grid id', () => {
    const materials = {
      MF_test: {
        shaderGraphId: MINIFIG_PLASTIC_SHADER_ID,
        name: 'MF_test',
        properties: { usePrint: 1 },
      },
      BO_Asphalt: {
        shaderGraphId: 'blockout_grid_object',
        name: 'BO_Asphalt',
        properties: {},
      },
    };
    applyMinifigUvGridDebugMaterials(materials);
    expect(materials.MF_test.shaderGraphId).toBe(MINIFIG_UV_GRID_SHADER_ID);
    expect(materials.MF_test.properties.baseColorTexture).toBe(MINIFIG_UV_GRID_TEXTURE_ID);
    expect(materials.BO_Asphalt.shaderGraphId).toBe('blockout_grid_object');
  });

  it('buildMinifigLabSpec includes uv grid shader when uvGrid=true', () => {
    const spec = buildMinifigLabSpec({ uvGrid: true });
    expect(spec.shaderGraphs.some((g) => g.id === MINIFIG_UV_GRID_SHADER_ID)).toBe(true);
    const bodyMat = Object.values(spec.materials).find(
      (m) => m.shaderGraphId === MINIFIG_UV_GRID_SHADER_ID
    );
    expect(bodyMat?.properties.baseColorTexture).toBe(MINIFIG_UV_GRID_TEXTURE_ID);
  });
});
