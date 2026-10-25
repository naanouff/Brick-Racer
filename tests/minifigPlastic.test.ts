/**
 * @file minifigPlastic.test.ts
 * @description Plastic material + Bolt print wiring (BRICK-MF3c/d).
 */

import { describe, expect, it } from 'vitest';
import { assembleMinifigEntities, BOLT_RECIPE } from '../src/racer/minifig';
import { buildMinifigLabSpec } from '../src/racer/levels/minifigLab';
import { HEAD, TORSO } from '../src/racer/minifig/dimensions';
import {
  MINIFIG_PLASTIC_SHADER_ID,
  MINIFIG_WHITE_TEXTURE_ID,
  printFrameForPart,
} from '../src/racer/minifig/plasticMaterial';

describe('minifig plastic + prints', () => {
  it('uses minifig_plastic for body parts with MeshMaps-ready props', () => {
    const { materials } = assembleMinifigEntities(BOLT_RECIPE);
    const mats = Object.values(materials);
    expect(mats.length).toBeGreaterThan(0);
    for (const m of mats) {
      expect(m.shaderGraphId).toBe(MINIFIG_PLASTIC_SHADER_ID);
      expect(m.properties.roughness).toBe(0.34);
      expect(m.properties.dirtAmount).toBeDefined();
      expect(m.properties.fingerprintAmount).toBeDefined();
      expect(m.properties.grainAmount).toBeDefined();
      expect(m.properties.aoStrength).toBeDefined();
      expect(m.properties.baseColorTexture).toBeTruthy();
    }
  });

  it('wires Bolt face + torso WebP prints onto head/torso materials', () => {
    const { materials, entities, rootId } = assembleMinifigEntities(BOLT_RECIPE);
    const head = entities.find((e) => e.id === `${rootId}.part.head`);
    const torso = entities.find((e) => e.id === `${rootId}.part.torso`);
    expect(head && torso).toBeTruthy();

    const headMatId =
      head?.components.find((c) => c.type === 'gproc') &&
      (head.components.find((c) => c.type === 'gproc') as { materialIds?: string[] })
        .materialIds?.[0];
    const torsoMatId =
      torso?.components.find((c) => c.type === 'gproc') &&
      (torso.components.find((c) => c.type === 'gproc') as { materialIds?: string[] })
        .materialIds?.[0];

    expect(headMatId && materials[headMatId]).toBeTruthy();
    expect(torsoMatId && materials[torsoMatId]).toBeTruthy();
    expect(materials[headMatId!]!.properties.usePrint).toBe(1);
    expect(materials[headMatId!]!.properties.baseColorTexture).toBe(
      '/minifig/prints/face-frown-stubble-orange.webp'
    );
    const headFrame = materials[headMatId!]!.properties.printFrame as number[];
    const torsoFrame = materials[torsoMatId!]!.properties.printFrame as number[];
    expect(headFrame).toEqual([...printFrameForPart('head')]);
    expect(headFrame[1]! + headFrame[3]!).toBeLessThan(HEAD.height * 0.5 - 0.04);
    expect(torsoFrame).toEqual([...printFrameForPart('torso')]);
    expect(torsoFrame[2]).toBeCloseTo(TORSO.widthTop);
    expect(torsoFrame[1]! + torsoFrame[3]!).toBeLessThan(TORSO.height * 0.5);
    expect(materials[torsoMatId!]!.properties.usePrint).toBe(1);
    expect(materials[torsoMatId!]!.properties.baseColorTexture).toBe(
      '/minifig/prints/torso-mechanic.webp'
    );

    const armMat = Object.values(materials).find(
      (m) => m.properties.usePrint === 0 && m.name.includes('arms')
    );
    expect(armMat?.properties.baseColorTexture).toBe(MINIFIG_WHITE_TEXTURE_ID);
  });

  it('registers minifig_plastic shader on minifig-lab', () => {
    const spec = buildMinifigLabSpec();
    expect(spec.shaderGraphs.some((g) => g.id === MINIFIG_PLASTIC_SHADER_ID)).toBe(true);
  });
});
