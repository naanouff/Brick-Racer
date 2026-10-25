/**
 * @file validateRecipe.ts
 * @description Recipe ↔ catalog validation (BRICK-MF1a).
 */

import { getCatalogEntry } from './catalog';
import {
  MINIFIG_PART_SLOTS,
  type MinifigRecipe,
  type MinifigSlot,
} from './types';

export type RecipeValidationError = {
  slot?: MinifigSlot;
  message: string;
};

export type RecipeValidationResult =
  | { ok: true; recipe: MinifigRecipe }
  | { ok: false; errors: RecipeValidationError[] };

/**
 * Validates part / print ids against the catalog.
 * Unknown ids → clear errors (never silent).
 */
export function validateRecipe(recipe: MinifigRecipe): RecipeValidationResult {
  const errors: RecipeValidationError[] = [];

  if (!recipe.id?.trim()) {
    errors.push({ message: 'Recipe id is required' });
  }
  if (!recipe.displayName?.trim()) {
    errors.push({ message: 'Recipe displayName is required' });
  }
  if (!recipe.slots || typeof recipe.slots !== 'object') {
    errors.push({ message: 'Recipe slots object is required' });
    return { ok: false, errors };
  }

  for (const slot of MINIFIG_PART_SLOTS) {
    const assign = recipe.slots[slot];
    if (!assign?.part) continue;
    const entry = getCatalogEntry(assign.part);
    if (!entry) {
      errors.push({
        slot,
        message: `Unknown part id "${assign.part}" for slot ${slot}`,
      });
      continue;
    }
    if (entry.kind !== 'mesh') {
      errors.push({
        slot,
        message: `Catalog id "${assign.part}" is a print, not a mesh part`,
      });
      continue;
    }
    if (entry.slot !== slot) {
      errors.push({
        slot,
        message: `Part "${assign.part}" belongs to slot ${entry.slot}, not ${slot}`,
      });
    }
  }

  const face = recipe.slots.facePrint;
  if (face?.print) {
    const entry = getCatalogEntry(face.print);
    if (!entry) {
      errors.push({
        slot: 'facePrint',
        message: `Unknown face print id "${face.print}"`,
      });
    } else if (entry.kind !== 'print') {
      errors.push({
        slot: 'facePrint',
        message: `Catalog id "${face.print}" is not a print`,
      });
    }
  }

  const torso = recipe.slots.torso;
  if (torso?.print) {
    const entry = getCatalogEntry(torso.print);
    if (!entry) {
      errors.push({
        slot: 'torso',
        message: `Unknown torso print id "${torso.print}"`,
      });
    } else if (entry.kind !== 'print') {
      errors.push({
        slot: 'torso',
        message: `Catalog id "${torso.print}" is not a print`,
      });
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, recipe };
}

/** Throws with a single readable message if invalid. */
export function assertValidRecipe(recipe: MinifigRecipe): MinifigRecipe {
  const result = validateRecipe(recipe);
  if (!result.ok) {
    const detail = result.errors
      .map((e) => (e.slot ? `[${e.slot}] ${e.message}` : e.message))
      .join('; ');
    throw new Error(`Invalid minifig recipe: ${detail}`);
  }
  return result.recipe;
}
