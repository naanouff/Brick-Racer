/**
 * @file c01-bolt.ts
 * @description Preset recipe Bolt (C01) — no Meshy GLB (BRICK-MF1d).
 */

import type { MinifigRecipe } from '../types';

/** Aligné fiche C01 + docs/design/minifig-gproc.md. */
export const BOLT_RECIPE: MinifigRecipe = {
  id: 'c01-bolt',
  displayName: 'Bolt',
  slots: {
    head: { part: 'head.basic', tint: '#F5D76E' },
    facePrint: { print: 'face.frown_stubble_orange' },
    hat: { part: 'hat.cap_mechanic', tint: '#1a1a1a' },
    torso: { part: 'torso.coverall', tint: '#1B4F72', print: 'print.mechanic' },
    arms: { part: 'arms.coverall', tint: '#1B4F72' },
    hands: { part: 'hands.glove', tint: '#111111' },
    hipsLegs: { part: 'legs.coverall', tint: '#1B4F72' },
    // Accessories (wrench, etc.) parked for now — catalog + assemble still support them.
  },
};

export function cloneBoltRecipe(): MinifigRecipe {
  return structuredClone(BOLT_RECIPE);
}
