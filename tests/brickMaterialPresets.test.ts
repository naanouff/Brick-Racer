/**
 * @file brickMaterialPresets.test.ts
 * @description BRICK-MT2 — finish presets + blend / rubber / transparent.
 */

import { describe, expect, it } from 'vitest';
import {
  RUBBER_PRESET,
  TRANSPARENT_PRESET,
  applyPresetToProps,
  materialKindNeedsBlend,
  presetFor,
  presetForColorId,
} from '../src/racer/hub/brick/materials/brickMaterialPresets';
import { brickCatalogMaterials } from '../src/racer/hub/brick/brickMaterials';
import { catalogPlasticMaterials } from '../src/racer/hub/brick/catalog/catalogPlasticMaterials';
import { KART_RUBBER_PBR_OVERRIDES } from '../src/racer/vehicles/kart/kartWheelLook';

describe('brickMaterialPresets (MT2)', () => {
  it('maps kinds to expected roughness / transmission', () => {
    expect(presetFor('plastic').roughness).toBeCloseTo(0.34);
    expect(presetFor('rubber')).toEqual(RUBBER_PRESET);
    expect(presetFor('transparent').transmissionFactor).toBe(0.9);
    expect(presetFor('transparent').alphaMode).toBe('BLEND');
    expect(presetFor('chrome').metallic).toBe(1);
    expect(materialKindNeedsBlend('transparent')).toBe(true);
    expect(materialKindNeedsBlend('rubber')).toBe(false);
    expect(materialKindNeedsBlend('glitter')).toBe(true);
    expect(materialKindNeedsBlend('satin')).toBe(true);
  });

  it('uses colour alpha for transparent', () => {
    const p = presetForColorId('trans_clear');
    expect(p.alphaMode).toBe('BLEND');
    expect(p.opacity).toBeDefined();
    expect(p.opacity!).toBeLessThan(1);
    expect(p.castShadow).toBe(false);
  });

  it('rubber black is matte with AmbientCG maps enabled', () => {
    const p = presetForColorId('rubber_black');
    expect(p.roughness).toBeGreaterThanOrEqual(0.9);
    expect(p.metallic).toBe(0);
    expect(p.usePlasticMaps).toBe(1);
  });

  it('applyPresetToProps writes bag fields', () => {
    const props: Record<string, unknown> = {};
    applyPresetToProps(props, TRANSPARENT_PRESET, [0.9, 0.9, 0.95]);
    expect(props.transmissionFactor).toBe(0.9);
    expect(props.alphaMode).toBe('BLEND');
    expect(props.baseColor).toEqual([0.9, 0.9, 0.95, TRANSPARENT_PRESET.opacity]);
  });

  it('flat brick mats carry rubber / transparent presets', () => {
    const mats = brickCatalogMaterials();
    expect(mats['BRICK_rubber_black']?.properties.roughness).toBe(RUBBER_PRESET.roughness);
    expect(mats['BRICK_trans_clear']?.properties.alphaMode).toBe('BLEND');
    expect(mats['BRICK_trans_clear']?.properties.transmissionFactor).toBe(0.9);
  });

  it('catalog plastic common mats apply finish presets', () => {
    const mats = catalogPlasticMaterials();
    const rubber = mats['CL_plastic_017b_rubber_black'];
    expect(rubber).toBeTruthy();
    expect(rubber!.properties.roughness).toBe(RUBBER_PRESET.roughness);
    expect(rubber!.properties.usePlasticMaps).toBe(1);
    expect(String(rubber!.properties.emissiveTexture)).toContain('rubber004-surface');
    expect(String(rubber!.properties.normalTexture)).toContain('rubber004-normal');
    const glass = mats['CL_plastic_017b_trans_clear'];
    expect(glass?.properties.alphaMode).toBe('BLEND');
    expect(glass?.properties.transmissionFactor).toBe(0.9);
  });

  it('kart rubber overrides share RUBBER_PRESET', () => {
    expect(KART_RUBBER_PBR_OVERRIDES.roughness).toBe(RUBBER_PRESET.roughness);
    expect(KART_RUBBER_PBR_OVERRIDES.metallic).toBe(RUBBER_PRESET.metallic);
    expect(KART_RUBBER_PBR_OVERRIDES.specularFactor).toBe(RUBBER_PRESET.specularFactor);
  });
});
