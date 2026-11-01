import { describe, expect, it } from 'vitest';
import { validateManual } from '../src/racer/hub/brick';
import {
  FAMILY_MAP_CATEGORY_IDS,
  familyForCategoryId,
  type CatalogCategoriesFile,
} from '../src/racer/hub/brick/catalog/catalogFamilies';
import {
  buildOccupancy,
  createEmptyEditorState,
  editorStateToManual,
  footprintCollides,
  isValidManualStem,
  moveEditorBrick,
  placeEditorBrick,
  removeEditorBrick,
  stackHeightUnder,
  undoEditor,
  validateEditorManual,
} from '../src/racer/levels/brickLab/editor';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('brick-lab editor (ED)', () => {
  it('places, stacks, undoes, and validates a manual', () => {
    const state = createEmptyEditorState('demo', 'Demo');
    state.partId = '3005';
    state.colorId = 'gray';
    expect(placeEditorBrick(state, 0, 0, 0)).toBeTruthy();
    expect(state.ops).toHaveLength(1);
    expect(stackHeightUnder(state.ops, '3005', 0, 0, 0)).toBe(3);
    expect(placeEditorBrick(state, 0, 3, 0)).toBeTruthy();
    expect(state.ops).toHaveLength(2);
    expect(footprintCollides(buildOccupancy(state.ops), '3005', 0, 0, 0, 0)).toBe(true);
    const topId = state.ops[1]!.id;
    expect(removeEditorBrick(state, topId)).toBe(true);
    expect(state.ops).toHaveLength(1);
    expect(undoEditor(state)).toBe(true);
    expect(state.ops).toHaveLength(2);

    const manual = editorStateToManual(state);
    expect(validateManual(manual).ok).toBe(true);
    expect(validateEditorManual(state)).toEqual([]);
  });

  it('rejects invalid stem', () => {
    expect(isValidManualStem('fountain')).toBe(true);
    expect(isValidManualStem('Bad Stem')).toBe(false);
  });

  it('moves a selected brick without overlapping itself', () => {
    const state = createEmptyEditorState('move', 'Move');
    state.partId = '3005';
    state.colorId = 'gray';
    const a = placeEditorBrick(state, 0, 0, 0);
    expect(a).toBeTruthy();
    state.selectedOpId = a!.id;
    expect(moveEditorBrick(state, a!.id, 2, 0, 0)).toBe(true);
    expect(state.ops[0]!.at).toEqual([2, 0, 0]);
    expect(placeEditorBrick(state, 0, 0, 0)).toBeTruthy();
    expect(moveEditorBrick(state, a!.id, 0, 0, 0)).toBe(false);
    expect(state.ops.find((o) => o.id === a!.id)!.at).toEqual([2, 0, 0]);
  });

  it('envelope covers bricks offset from origin (not just AABB span)', () => {
    const state = createEmptyEditorState('offset', 'Offset');
    state.partId = '3005';
    state.colorId = 'gray';
    expect(placeEditorBrick(state, 10, 0, 12)).toBeTruthy();
    expect(placeEditorBrick(state, 11, 0, 12)).toBeTruthy();
    expect(validateEditorManual(state)).toEqual([]);
  });
});

describe('catalog families (ED1)', () => {
  it('maps known Rebrickable categories and covers the static map', () => {
    const raw = readFileSync(
      resolve(__dirname, '../public/catalog/categories.json'),
      'utf8'
    );
    const file = JSON.parse(raw) as CatalogCategoriesFile;
    expect(file.categories.length).toBeGreaterThanOrEqual(70);
    for (const id of FAMILY_MAP_CATEGORY_IDS) {
      expect(familyForCategoryId(file, id), `missing family for ${id}`).not.toBe('other');
    }
    expect(familyForCategoryId(file, '11')).toBe('bricks');
    expect(familyForCategoryId(file, '14')).toBe('plates');
    expect(familyForCategoryId(file, '20')).toBe('rounds');
    expect(familyForCategoryId(file, '999')).toBe('other');
  });
});
