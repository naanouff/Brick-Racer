/**
 * @file minifigAssemble.test.ts
 * @description Hierarchical assemble + DEFAULT_POSE (BRICK-MF2d / MF2e).
 */

import { mat4, quat, vec3 } from 'gl-matrix';
import { describe, expect, it } from 'vitest';
import {
  assembleMinifigEntities,
  BOLT_RECIPE,
  DEFAULT_POSE,
  eulerDegToQuat,
  REST_POSE,
} from '../src/racer/minifig';
import { computePivots } from '../src/racer/minifig/dimensions';

function localMatrix(
  position: readonly number[],
  rotation: readonly number[]
): mat4 {
  const m = mat4.create();
  const q = quat.fromValues(rotation[0]!, rotation[1]!, rotation[2]!, rotation[3]!);
  mat4.fromRotationTranslation(m, q, vec3.fromValues(position[0]!, position[1]!, position[2]!));
  return m;
}

describe('minifig assemble hierarchy', () => {
  it('emits stable pivot ids and a single root', () => {
    const { entities, rootId } = assembleMinifigEntities(BOLT_RECIPE);
    expect(rootId).toBe('minifig.c01-bolt');
    const roots = entities.filter((e) => e.parentId === null);
    expect(roots).toHaveLength(1);
    expect(roots[0]?.id).toBe(rootId);

    for (const joint of [
      'hips',
      'hipL',
      'hipR',
      'neck',
      'shoulderL',
      'shoulderR',
      'wristL',
      'wristR',
    ] as const) {
      expect(entities.some((e) => e.id === `${rootId}.pivot.${joint}`)).toBe(true);
    }
  });

  it('parents mesh parts under pivots', () => {
    const { entities, rootId } = assembleMinifigEntities(BOLT_RECIPE);
    const byId = new Map(entities.map((e) => [e.id, e]));

    expect(byId.get(`${rootId}.part.hips`)?.parentId).toBe(`${rootId}.pivot.hips`);
    expect(byId.get(`${rootId}.part.leg.R`)?.parentId).toBe(`${rootId}.pivot.hipR`);
    expect(byId.get(`${rootId}.part.torso`)?.parentId).toBe(`${rootId}.pivot.hips`);
    expect(byId.get(`${rootId}.part.head`)?.parentId).toBe(`${rootId}.pivot.neck`);
    expect(byId.get(`${rootId}.part.hat`)?.parentId).toBe(`${rootId}.part.head`);
    expect(byId.get(`${rootId}.part.arm.R`)?.parentId).toBe(`${rootId}.pivot.shoulderR`);
    expect(byId.get(`${rootId}.part.hand.R`)?.parentId).toBe(`${rootId}.pivot.wristR`);
    expect(byId.get(`${rootId}.pivot.wristR`)?.parentId).toBe(`${rootId}.pivot.shoulderR`);
    expect(byId.get(`${rootId}.part.accessoryR`)).toBeUndefined();
  });

  it('applies DEFAULT_POSE rotations on articulation pivots', () => {
    const { entities, rootId } = assembleMinifigEntities(BOLT_RECIPE);
    const shoulderR = entities.find((e) => e.id === `${rootId}.pivot.shoulderR`);
    const expected = eulerDegToQuat(DEFAULT_POSE.shoulderR);
    expect(shoulderR?.transform.rotation[0]).toBeCloseTo(expected[0], 5);
    expect(shoulderR?.transform.rotation[1]).toBeCloseTo(expected[1], 5);
    expect(shoulderR?.transform.rotation[2]).toBeCloseTo(expected[2], 5);
    expect(shoulderR?.transform.rotation[3]).toBeCloseTo(expected[3], 5);
  });

  function worldPosition(
    entities: ReturnType<typeof assembleMinifigEntities>['entities'],
    id: string
  ): vec3 {
    const byId = new Map(entities.map((e) => [e.id, e]));
    const chain: string[] = [];
    for (let cur = byId.get(id); cur; cur = cur.parentId ? byId.get(cur.parentId) : undefined) {
      chain.unshift(cur.id);
    }
    const world = mat4.create();
    for (const cid of chain) {
      const e = byId.get(cid)!;
      mat4.multiply(world, world, localMatrix(e.transform.position, e.transform.rotation));
    }
    return mat4.getTranslation(vec3.create(), world);
  }

  it('matches computePivots exactly under REST_POSE', () => {
    const { entities, rootId } = assembleMinifigEntities(BOLT_RECIPE, { pose: REST_POSE });
    const P = computePivots();
    const expectAt = (id: string, p: readonly number[]) => {
      const w = worldPosition(entities, id);
      for (let i = 0; i < 3; i++) expect(w[i], `${id}[${i}]`).toBeCloseTo(p[i]!, 5);
    };
    expectAt(`${rootId}.pivot.shoulderR`, P.shoulderR);
    expectAt(`${rootId}.pivot.wristR`, P.wristR);
    expectAt(`${rootId}.part.hand.R`, P.handR);
    expectAt(`${rootId}.part.hand.L`, P.handL);
    expectAt(`${rootId}.pivot.hipL`, P.hipL);
    expectAt(`${rootId}.part.head`, P.head);
  });

  it('DEFAULT_POSE swings the hands outward and forward', () => {
    const rest = assembleMinifigEntities(BOLT_RECIPE, { pose: REST_POSE });
    const posed = assembleMinifigEntities(BOLT_RECIPE);
    const id = `${posed.rootId}.part.hand.R`;
    const a = worldPosition(rest.entities, id);
    const b = worldPosition(posed.entities, id);
    expect(b[0]).toBeGreaterThan(a[0]);
    expect(b[2]).toBeGreaterThan(a[2]);
    const idL = `${posed.rootId}.part.hand.L`;
    expect(worldPosition(posed.entities, idL)[0]).toBeLessThan(
      worldPosition(rest.entities, idL)[0]
    );
  });

  it('keeps editor swaps: hat.none skips hat mesh', () => {
    const { entities, rootId } = assembleMinifigEntities({
      ...BOLT_RECIPE,
      slots: {
        ...BOLT_RECIPE.slots,
        hat: { part: 'hat.none' },
      },
    });
    expect(entities.some((e) => e.id === `${rootId}.part.hat`)).toBe(false);
  });
});
