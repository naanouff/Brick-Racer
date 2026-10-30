/**
 * @file catalogPlastic.test.ts
 * @description CL3a: catalog plastic mats — AmbientCG without diffuse, BC1 tint.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CATALOG_AGING_TEXTURE_ID } from '../src/racer/hub/brick/catalog/catalogAgingTexture';
import {
  CATALOG_PLASTIC_SETS,
  CATALOG_PLASTIC_SHADER_ID,
  CATALOG_UV_GRID_MATERIAL_ID,
  CATALOG_UV_GRID_UV1_MATERIAL_ID,
  DEFAULT_CATALOG_PLASTIC_SET,
  catalogPlasticMaterialId,
  catalogPlasticMaterials,
  catalogUvGridMaterials,
} from '../src/racer/hub/brick/catalog/catalogPlasticMaterials';
import { buildCityTestSpec } from '../src/racer/levels/cityTest/cityTestSpec';
import { BRICK_COLOR_IDS, getColor } from '../src/racer/hub/brick/brickCatalog';
import { MINIFIG_UV_GRID_SHADER_ID, MINIFIG_UV_GRID_TEXTURE_ID } from '../src/racer/minifig/minifigUvGridDebug';
import { PLASTIC_MAP_SETS } from '../src/racer/minifig/plasticMapSets';
import { buildBrickLabSpec } from '../src/racer/levels/brickLab/brickLabSpec';
import { buildCatalogLabSpec } from '../src/racer/levels/catalogLab/catalogLabSpec';

describe('catalogPlasticMaterials', () => {
  const mats = catalogPlasticMaterials();

  it('registers every set × BC1 color under CL_plastic_*', () => {
    expect(CATALOG_PLASTIC_SETS).toEqual(['017b', '003', 'off']);
    for (const set of CATALOG_PLASTIC_SETS) {
      for (const color of BRICK_COLOR_IDS) {
        const id = catalogPlasticMaterialId(set, color);
        expect(mats[id]?.shaderGraphId).toBe(CATALOG_PLASTIC_SHADER_ID);
      }
    }
    expect(Object.keys(mats)).toHaveLength(
      CATALOG_PLASTIC_SETS.length * BRICK_COLOR_IDS.length * 2
    );
    expect(mats[catalogPlasticMaterialId('003', 'gray', false)]?.properties.edgeWear).toBe(0);
    expect(mats[catalogPlasticMaterialId('003', 'gray', false)]?.properties.aoStrength).toBe(0);
    expect(mats[CATALOG_UV_GRID_MATERIAL_ID]).toBeUndefined();
  });

  it('defaults preview plastic to 017b (landmark / minifig LDraw)', () => {
    expect(DEFAULT_CATALOG_PLASTIC_SET).toBe('017b');
  });

  it('keeps UV grid mats separate (need minifig_uv_grid shader)', () => {
    const grids = catalogUvGridMaterials();
    expect(grids[CATALOG_UV_GRID_MATERIAL_ID]?.shaderGraphId).toBe(MINIFIG_UV_GRID_SHADER_ID);
    expect(grids[CATALOG_UV_GRID_MATERIAL_ID]?.properties.baseColorTexture).toBe(
      MINIFIG_UV_GRID_TEXTURE_ID
    );
    expect(grids[CATALOG_UV_GRID_MATERIAL_ID]?.properties.uvChannel).toBe(0);
    expect(grids[CATALOG_UV_GRID_UV1_MATERIAL_ID]?.properties.uvChannel).toBe(1);
    expect(grids[CATALOG_UV_GRID_UV1_MATERIAL_ID]?.properties.baseColorTexture).toBe(
      MINIFIG_UV_GRID_TEXTURE_ID
    );
  });

  it('uses BC1 rgb as baseColor and never references plastic*-color.webp', () => {
    const gray = getColor('gray')!;
    const off = mats[catalogPlasticMaterialId('off', 'gray')]!;
    expect(off.properties.baseColor).toEqual([gray.rgb[0], gray.rgb[1], gray.rgb[2], 1]);
    expect(off.properties.usePlasticMaps).toBe(0);

    const withMaps = mats[catalogPlasticMaterialId('003', 'cyan')]!;
    expect(withMaps.properties.usePlasticMaps).toBe(1);
    expect(withMaps.properties.emissiveTexture).toBe(PLASTIC_MAP_SETS['003'].surface);
    expect(withMaps.properties.normalTexture).toBe(PLASTIC_MAP_SETS['003'].normal);

    const blob = JSON.stringify(mats);
    expect(blob).not.toMatch(/plastic\d+.*-color\.webp/);
    expect(blob).not.toContain('plastic003-color');
    expect(blob).not.toContain('plastic017b-color');
  });

  it('keeps procedural speckle off and MeshMaps wear on', () => {
    for (const set of CATALOG_PLASTIC_SETS) {
      const m = mats[catalogPlasticMaterialId(set, 'lime')]!;
      expect(m.properties.dirtAmount).toBe(0);
      expect(m.properties.grainAmount).toBe(0);
      expect(m.properties.fingerprintAmount).toBe(0);
      expect(m.properties.greaseGloss).toBe(0);
      expect(m.properties.normalDetailScale).toBe(0);
      expect(m.properties.edgeWear).toBeGreaterThan(0);
      expect(m.properties.cavityStrength).toBeGreaterThan(0);
      expect(m.properties.aoStrength).toBeGreaterThan(0);
      expect(m.properties.useAgingMap).toBe(1);
      expect(m.properties.baseColorTexture).toBe(CATALOG_AGING_TEXTURE_ID);
      expect(m.properties.usePrint).toBe(0);
      expect(m.properties.metallicRoughnessTexture).toBeUndefined();
    }
    const clean = mats[catalogPlasticMaterialId('003', 'gray', false)]!;
    expect(clean.properties.useAgingMap).toBe(0);
    expect(clean.properties.baseColorTexture).toBe(CATALOG_AGING_TEXTURE_ID);
  });

  it('samples the aging map from UV set 1', () => {
    const graph = readFileSync('public/shader-graphs/CatalogPlasticPBR.json', 'utf8');
    expect(graph).toContain('"uvSet": 1');
    expect(graph).not.toContain('metallicRoughnessTexture');
    expect(graph).toContain('"useAgingMap"');
    expect(graph).not.toContain('agingTexture');
    const minifig = readFileSync('public/shader-graphs/MinifigPlasticPBR.json', 'utf8');
    expect(minifig).not.toContain('agingTexture');
    expect(minifig).not.toContain('useAgingMap');
  });
});

describe('catalogLabSpec plastic', () => {
  it('loads the catalog plastic shader and CL materials', () => {
    const spec = buildCatalogLabSpec();
    expect(spec.shaderGraphs.some((g) => g.id === CATALOG_PLASTIC_SHADER_ID)).toBe(true);
    expect(spec.shaderGraphs.some((g) => g.id === MINIFIG_UV_GRID_SHADER_ID)).toBe(true);
    expect(spec.materials[catalogPlasticMaterialId('003', 'gray')]).toBeDefined();
    expect(spec.materials[catalogPlasticMaterialId('off', 'yellow')]).toBeDefined();
    expect(spec.materials[CATALOG_UV_GRID_MATERIAL_ID]).toBeDefined();
  });
});

describe('brickLabSpec plastic', () => {
  it('registers UV grid shader for CL_uv_grid materials', () => {
    const spec = buildBrickLabSpec();
    expect(spec.shaderGraphs.some((g) => g.id === CATALOG_PLASTIC_SHADER_ID)).toBe(true);
    expect(spec.shaderGraphs.some((g) => g.id === MINIFIG_UV_GRID_SHADER_ID)).toBe(true);
    expect(spec.materials[CATALOG_UV_GRID_MATERIAL_ID]?.shaderGraphId).toBe(MINIFIG_UV_GRID_SHADER_ID);
  });
});

describe('cityTestSpec plastic', () => {
  it('loads catalog plastic without UV grid mats (no minifig_uv_grid shader)', () => {
    const spec = buildCityTestSpec();
    expect(spec.materials[catalogPlasticMaterialId('017b', 'gray')]).toBeDefined();
    expect(spec.materials[CATALOG_UV_GRID_MATERIAL_ID]).toBeUndefined();
    expect(spec.shaderGraphs.some((g) => g.id === MINIFIG_UV_GRID_SHADER_ID)).toBe(false);
  });
});
