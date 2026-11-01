/**
 * @file legoPalette.test.ts
 * @description BRICK-MT1 — official LDConfig palette + legacy aliases + materialOf.
 */

import { describe, expect, it } from 'vitest';
import {
  BRICK_CATALOG,
  BRICK_MATERIAL_KINDS,
  catalogColorsByMaterial,
  catalogCommonColorIds,
  getColor,
  isBrickColorId,
  isBrickMaterialKind,
  materialOf,
  resolveColorId,
  validateManual,
} from '../src/racer/hub/brick';
import { brickMaterialId } from '../src/racer/hub/brick/brickCatalog';
import { brickCatalogMaterials } from '../src/racer/hub/brick/brickMaterials';

describe('lego palette (MT1)', () => {
  it('loads the official LDConfig palette (300+ colours)', () => {
    expect(BRICK_CATALOG.colors.length).toBeGreaterThanOrEqual(300);
    expect(BRICK_CATALOG.version).toBeGreaterThanOrEqual(2);
  });

  it('counts each material kind', () => {
    const counts: Record<string, number> = {};
    for (const kind of BRICK_MATERIAL_KINDS) counts[kind] = 0;
    for (const c of BRICK_CATALOG.colors) {
      const k = c.material ?? 'plastic';
      expect(isBrickMaterialKind(k), `bad material on ${c.id}`).toBe(true);
      counts[k] = (counts[k] ?? 0) + 1;
    }
    expect(counts.plastic).toBeGreaterThan(100);
    expect(counts.rubber).toBeGreaterThan(40);
    expect(counts.transparent).toBeGreaterThan(20);
    expect(counts.chrome).toBeGreaterThan(3);
    expect(counts.pearl).toBeGreaterThan(10);
    expect(counts.glitter + counts.satin).toBeGreaterThan(5);
  });

  it('resolves legacy slugs to official ids', () => {
    expect(resolveColorId('gray')).toBe('light_bluish_grey');
    expect(resolveColorId('lbg')).toBe('light_bluish_grey');
    expect(resolveColorId('light_bluish_gray')).toBe('light_bluish_grey');
    expect(resolveColorId('dark_gray')).toBe('dark_bluish_grey');
    expect(resolveColorId('sand')).toBe('tan');
    expect(resolveColorId('terracotta')).toBe('reddish_brown');
    expect(resolveColorId('cyan')).toBe('trans_light_blue');
    expect(resolveColorId('tlb')).toBe('trans_light_blue');
    expect(resolveColorId('clear')).toBe('trans_clear');
    expect(resolveColorId('white')).toBe('white');
    expect(resolveColorId('black')).toBe('black');
  });

  it('resolves LDraw CODE as string', () => {
    expect(resolveColorId('71')).toBe('light_bluish_grey');
    expect(resolveColorId('47')).toBe('trans_clear');
    expect(resolveColorId('256')).toBe('rubber_black');
  });

  it('materialOf follows finish + legacy translucent', () => {
    expect(materialOf('gray')).toBe('plastic');
    expect(materialOf('clear')).toBe('transparent');
    expect(materialOf('trans_clear')).toBe('transparent');
    expect(materialOf('rubber_black')).toBe('rubber');
    expect(materialOf('chrome_silver')).toBe('chrome');
    expect(materialOf('pearl_gold')).toBe('pearl');
    expect(materialOf('glow_in_dark_white')).toBe('glow');
    expect(materialOf('glitter_trans_clear')).toBe('glitter');
    expect(materialOf('opal_trans_clear')).toBe('satin');
    expect(materialOf('unknown_xyz')).toBe('plastic');
  });

  it('accepts legacy colours in validateManual', () => {
    const ok = validateManual({
      id: 'test.mt1',
      version: 1,
      origin: [0, 0, 0],
      envelope: { size: [3, 2, 3] },
      steps: [
        {
          title: 'legacy',
          ops: [
            { op: 'brick', part: '3005', color: 'gray', at: [0, 0, 0] },
            { op: 'brick', part: '3005', color: 'cyan', at: [1, 0, 0] },
            { op: 'brick', part: '3005', color: 'clear', at: [2, 0, 0] },
          ],
        },
      ],
    });
    expect(ok.ok).toBe(true);
    expect(isBrickColorId('gray')).toBe(true);
    expect(isBrickColorId('cyan')).toBe(true);
  });

  it('brickMaterialId resolves aliases', () => {
    expect(brickMaterialId('gray')).toBe('BRICK_light_bluish_grey');
    expect(brickMaterialId('clear')).toBe('BRICK_trans_clear');
    const mats = brickCatalogMaterials();
    expect(mats['BRICK_light_bluish_grey']).toBeTruthy();
    expect(mats['BRICK_trans_clear']?.properties.alphaMode).toBe('BLEND');
    expect(mats['BRICK_rubber_black']?.properties.roughness).toBeGreaterThan(0.8);
  });

  it('exposes common colours for UI / plastic pregen', () => {
    const common = catalogCommonColorIds();
    expect(common.length).toBeGreaterThanOrEqual(20);
    expect(common).toContain('light_bluish_grey');
    expect(common).toContain('trans_clear');
    expect(common).toContain('rubber_black');
    expect(getColor('gray')?.common).toBe(true);
    expect(catalogColorsByMaterial('rubber').length).toBeGreaterThan(40);
  });
});
