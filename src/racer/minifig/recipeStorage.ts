/**
 * @file recipeStorage.ts
 * @description Persist editor recipe across level reloads (sessionStorage).
 */

import { cloneBoltRecipe } from './recipes/c01-bolt';
import type { MinifigRecipe } from './types';
import { validateRecipe } from './validateRecipe';

export const MINIFIG_RECIPE_STORAGE_KEY = 'brick-racer-minifig-recipe';

export function loadStoredRecipe(): MinifigRecipe {
  if (typeof sessionStorage === 'undefined') return cloneBoltRecipe();
  try {
    const raw = sessionStorage.getItem(MINIFIG_RECIPE_STORAGE_KEY);
    if (!raw) return cloneBoltRecipe();
    const parsed = JSON.parse(raw) as MinifigRecipe;
    const result = validateRecipe(parsed);
    return result.ok ? result.recipe : cloneBoltRecipe();
  } catch {
    return cloneBoltRecipe();
  }
}

export function saveStoredRecipe(recipe: MinifigRecipe): void {
  if (typeof sessionStorage === 'undefined') return;
  const result = validateRecipe(recipe);
  if (!result.ok) return;
  sessionStorage.setItem(MINIFIG_RECIPE_STORAGE_KEY, JSON.stringify(result.recipe));
}

export function resetStoredRecipe(): MinifigRecipe {
  const bolt = cloneBoltRecipe();
  saveStoredRecipe(bolt);
  return bolt;
}
