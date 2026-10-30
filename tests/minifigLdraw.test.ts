/**
 * @file minifigLdraw.test.ts
 * @description MF2a–c: LDraw catalog ids, scale, assemble prefer LDraw.
 */

import { describe, expect, it } from 'vitest';
import {
  assembleMinifigEntities,
  BOLT_RECIPE,
  collectRecipeLdrawIds,
  MINIFIG_LDRAW_PLACEMENT_LDU,
  MINIFIG_LDRAW_PLASTIC_SET,
  minifigLdrawAgingTextureId,
  minifigLdrawGamePosition,
  minifigLdrawMeshId,
  minifigLdrawPrintFrame,
  minifigLdrawRotation,
  PART_CATALOG,
  requireCatalogEntry,
} from '../src/racer/minifig';
import { PLASTIC_MAP_SETS } from '../src/racer/minifig/plasticMapSets';
import { CATALOG_PLASTIC_SHADER_ID } from '../src/racer/hub/brick/catalog/catalogPlasticMaterials';

const BOLT_LDRAW = {
  head: '3626c',
  hat: '4485',
  torso: '973',
  armL: '3819',
  armR: '3818',
  hand: '3820',
  hips: '3815',
  legL: '3817',
  legR: '3816',
  wrench: '4006',
} as const;

describe('minifig LDraw catalog (MF2a)', () => {
  it('maps Bolt mesh slots to BOM design ids', () => {
    expect(requireCatalogEntry('head.basic').ldrawId).toBe(BOLT_LDRAW.head);
    expect(requireCatalogEntry('hat.cap_mechanic').ldrawId).toBe(BOLT_LDRAW.hat);
    expect(requireCatalogEntry('torso.coverall').ldrawId).toBe(BOLT_LDRAW.torso);
    expect(requireCatalogEntry('arms.coverall').ldrawPair).toEqual({
      left: BOLT_LDRAW.armL,
      right: BOLT_LDRAW.armR,
    });
    expect(requireCatalogEntry('hands.glove').ldrawId).toBe(BOLT_LDRAW.hand);
    expect(requireCatalogEntry('legs.coverall').ldrawId).toBe(BOLT_LDRAW.hips);
    expect(requireCatalogEntry('legs.coverall').ldrawPair).toEqual({
      left: BOLT_LDRAW.legL,
      right: BOLT_LDRAW.legR,
    });
    expect(requireCatalogEntry('prop.wrench_chrome').ldrawId).toBe(BOLT_LDRAW.wrench);
  });

  it('collects unique LDraw ids from Bolt recipe', () => {
    const ids = collectRecipeLdrawIds(BOLT_RECIPE);
    expect(ids).toEqual(
      [
        BOLT_LDRAW.armR,
        BOLT_LDRAW.armL,
        BOLT_LDRAW.head,
        BOLT_LDRAW.hips,
        BOLT_LDRAW.legR,
        BOLT_LDRAW.legL,
        BOLT_LDRAW.hand,
        BOLT_LDRAW.hat,
        BOLT_LDRAW.torso,
      ].sort()
    );
    // accessoryR is parked on the TS preset — wrench stays in the catalog only.
    expect(ids).not.toContain(BOLT_LDRAW.wrench);
  });

  it('keeps GPROC ids as legacy fallback on mesh entries', () => {
    for (const e of PART_CATALOG.filter((p) => p.kind === 'mesh' && p.id !== 'hat.none')) {
      const hasLdraw = !!(e.ldrawId || e.ldrawPair);
      const hasGproc = !!(e.gprocId || e.gprocPair);
      expect(hasLdraw || hasGproc).toBe(true);
    }
  });
});

describe('minifig LDraw placement (MF2c)', () => {
  it('keeps feet on y=0 and stacks torso above hips without extra scale', () => {
    const hips = minifigLdrawGamePosition('hips');
    const torso = minifigLdrawGamePosition('torso');
    const head = minifigLdrawGamePosition('head');
    const feetDrop = minifigLdrawGamePosition('legL');
    expect(hips[1]).toBeGreaterThan(0.4);
    expect(hips[1]).toBeLessThan(0.7);
    expect(torso[1]).toBeGreaterThan(hips[1]);
    expect(head[1]).toBeGreaterThan(torso[1]);
    expect(feetDrop[1]).toBeLessThan(hips[1]);
    expect(head[1] - feetDrop[1]).toBeLessThan(1.2);
  });

  it('puts arms on game X (LDraw X) and the cap on the head origin', () => {
    const armL = minifigLdrawGamePosition('armL');
    const armR = minifigLdrawGamePosition('armR');
    expect(armL[0]).toBeGreaterThan(0.2);
    expect(armR[0]).toBeLessThan(-0.2);
    expect(Math.abs(armL[2])).toBeLessThan(0.01);
    expect(minifigLdrawGamePosition('hat')[1]).toBeCloseTo(
      minifigLdrawGamePosition('head')[1],
      5
    );
  });

  it('rests the torso on the hips and the head on the shoulders', () => {
    const ldu = MINIFIG_LDRAW_PLACEMENT_LDU;
    // 973 bottom (local 32) on the 3815 top (0); 3626c bottom (local 24) on the shoulders (0).
    expect(ldu.torso[1] + 32).toBe(ldu.hips[1]);
    expect(ldu.head[1] + 24).toBe(ldu.torso[1]);
  });

  it('plugs the hands into the arm holes, tilted 45° about X, in front of the figure', () => {
    const armL = minifigLdrawGamePosition('armL');
    const handL = minifigLdrawGamePosition('handL');
    const handR = minifigLdrawGamePosition('handR');
    expect(handL[1]).toBeLessThan(armL[1]);
    expect(handL[2]).toBeGreaterThan(0.1);
    expect(handR[0]).toBeCloseTo(-handL[0], 5);
    const q = minifigLdrawRotation('handL');
    const half = (45 * Math.PI) / 360;
    expect(q[0]).toBeCloseTo(Math.sin(half), 5);
    expect(q[3]).toBeCloseTo(Math.cos(half), 5);
    expect(minifigLdrawRotation('head')).toEqual([0, 0, 0, 1]);
  });

  it('frames prints on the head barrel and the chest, below the part origin', () => {
    const head = minifigLdrawPrintFrame('head')!;
    const torso = minifigLdrawPrintFrame('torso')!;
    expect(head[1] + head[3]).toBeLessThan(0);
    expect(head[0]).toBeCloseTo(-head[2] / 2, 6);
    expect(torso[1] + torso[3]).toBeLessThan(0);
    expect(torso[1]).toBeGreaterThan(-0.45);
    expect(minifigLdrawPrintFrame('legL')).toBeNull();
  });
});

describe('assembleMinifig LDraw (MF2d)', () => {
  it('emits MF_ldraw renderables when parts are ready', () => {
    const readyIds = new Set(collectRecipeLdrawIds(BOLT_RECIPE));
    const sizes = new Map<string, readonly [number, number, number]>();
    for (const id of readyIds) sizes.set(id, [0.2, 0.3, 0.2]);

    const { entities } = assembleMinifigEntities(BOLT_RECIPE, {
      ldraw: { readyIds, sizes },
    });
    const head = entities.find((e) => e.id.endsWith('.part.head'));
    expect(head?.transform.scale).toEqual([1, 1, 1]);
    expect(head?.transform.position[1]).toBeCloseTo(minifigLdrawGamePosition('head')[1], 5);
    expect(
      head?.components.some(
        (c) =>
          c.type === 'renderable' && c.meshId === minifigLdrawMeshId(BOLT_LDRAW.head)
      )
    ).toBe(true);
    const armL = entities.find((e) => e.id.endsWith('.part.arm.L'));
    expect(
      armL?.components.some(
        (c) =>
          c.type === 'renderable' && c.meshId === minifigLdrawMeshId(BOLT_LDRAW.armL)
      )
    ).toBe(true);
    const root = entities.find((e) => e.parentId === null);
    expect(root?.transform.rotation).toEqual([0, 0, 0, 1]);
  });

  it('uses 017b + catalog tuning, keeps prints, and binds per-part aging maps', () => {
    const readyIds = new Set(collectRecipeLdrawIds(BOLT_RECIPE));
    const { entities, materials } = assembleMinifigEntities(BOLT_RECIPE, {
      ldraw: { readyIds, sizes: new Map(), agingIds: readyIds },
    });
    const matOf = (suffix: string) => {
      const e = entities.find((x) => x.id.endsWith(suffix));
      const r = e?.components.find((c) => c.type === 'renderable');
      return materials[(r as { materialId: string }).materialId]!;
    };
    const set = PLASTIC_MAP_SETS[MINIFIG_LDRAW_PLASTIC_SET];
    for (const suffix of ['.part.head', '.part.torso', '.part.hips', '.part.hand.L']) {
      const m = matOf(suffix);
      expect(m.shaderGraphId).toBe(CATALOG_PLASTIC_SHADER_ID);
      expect(m.properties.usePlasticMaps).toBe(1);
      expect(m.properties.normalTexture).toBe(set.normal);
      expect(m.properties.plasticUvScale).toBe(0.1);
      expect(m.properties.aoStrength).toBe(0.85);
      expect(m.properties.grainAmount).toBe(0);
      expect(m.properties.dirtAmount).toBe(0);
    }
    const head = matOf('.part.head');
    expect(head.properties.usePrint).toBe(1);
    expect(head.properties.useAgingMap).toBe(0);
    expect(head.properties.printFrame).toEqual(minifigLdrawPrintFrame('head'));
    const hips = matOf('.part.hips');
    expect(hips.properties.usePrint).toBe(0);
    expect(hips.properties.useAgingMap).toBe(1);
    expect(hips.properties.baseColorTexture).toBe(minifigLdrawAgingTextureId(BOLT_LDRAW.hips));
  });

  it('falls back to GPROC when LDraw context is empty', () => {
    const { entities } = assembleMinifigEntities(BOLT_RECIPE);
    const head = entities.find((e) => e.id.endsWith('.part.head'));
    expect(head?.components.some((c) => c.type === 'gproc' && c.graphId === 'minifig_head')).toBe(
      true
    );
  });
});
