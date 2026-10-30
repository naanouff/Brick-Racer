/**
 * @file minifigCatalog.test.ts
 * @description Recipe + catalogue validation (BRICK-MF1a / MF1d / MF2).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assembleMinifigEntities,
  BOLT_RECIPE,
  PART_CATALOG,
  validateRecipe,
} from '../src/racer/minifig';

describe('minifig catalog', () => {
  it('has mesh entries for critical slots', () => {
    const slots = new Set(
      PART_CATALOG.filter((e) => e.kind === 'mesh').map((e) => e.slot)
    );
    expect(slots.has('head')).toBe(true);
    expect(slots.has('torso')).toBe(true);
    expect(slots.has('hipsLegs')).toBe(true);
    expect(slots.has('hat')).toBe(true);
    expect(slots.has('accessoryR')).toBe(true);
  });

  it('accepts Bolt recipe against the catalog', () => {
    const result = validateRecipe(BOLT_RECIPE);
    expect(result.ok).toBe(true);
  });

  it('rejects unknown part ids with a clear error', () => {
    const result = validateRecipe({
      ...BOLT_RECIPE,
      slots: {
        ...BOLT_RECIPE.slots,
        head: { part: 'head.does_not_exist', tint: '#fff' },
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.message).toMatch(/Unknown part id/);
    expect(result.errors[0]?.slot).toBe('head');
  });

  it('assembles Bolt with GPROC fallback when LDraw is not preloaded', () => {
    const { entities, materials, rootId } = assembleMinifigEntities(BOLT_RECIPE);
    expect(rootId).toBe('minifig.c01-bolt');
    expect(entities.length).toBeGreaterThanOrEqual(15);
    expect(Object.keys(materials).length).toBeGreaterThan(0);
    expect(entities.some((e) => e.id.endsWith('.part.hat'))).toBe(true);
    expect(entities.some((e) => e.id.endsWith('.part.accessoryR'))).toBe(false);
    const head = entities.find((e) => e.id.endsWith('.part.head'));
    expect(head?.components.some((c) => c.type === 'gproc' && c.graphId === 'minifig_head')).toBe(
      true
    );
    const torso = entities.find((e) => e.id.endsWith('.part.torso'));
    expect(torso?.components.some((c) => c.type === 'gproc' && c.graphId === 'minifig_torso')).toBe(
      true
    );
    const hips = entities.find((e) => e.id.endsWith('.part.hips'));
    expect(hips?.components.some((c) => c.type === 'gproc' && c.graphId === 'minifig_hips')).toBe(
      true
    );
    const armL = entities.find((e) => e.id.endsWith('.part.arm.L'));
    expect(armL?.components.some((c) => c.type === 'gproc' && c.graphId === 'minifig_arm_l')).toBe(
      true
    );
    const armR = entities.find((e) => e.id.endsWith('.part.arm.R'));
    expect(armR?.components.some((c) => c.type === 'gproc' && c.graphId === 'minifig_arm_r')).toBe(
      true
    );
  });

  it('keeps public JSON recipe in sync with TS preset', () => {
    const jsonPath = resolve(__dirname, '../public/minifig/recipes/c01-bolt.json');
    const fromDisk = JSON.parse(readFileSync(jsonPath, 'utf8')) as typeof BOLT_RECIPE;
    expect(fromDisk.id).toBe(BOLT_RECIPE.id);
    expect(fromDisk.slots.head?.part).toBe(BOLT_RECIPE.slots.head?.part);
    expect(fromDisk.slots.hat?.part).toBe(BOLT_RECIPE.slots.hat?.part);
    expect(validateRecipe(fromDisk).ok).toBe(true);
  });
});
