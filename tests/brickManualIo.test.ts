import { existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  listBrickManualFiles,
  readBrickManualFile,
  writeBrickManualFile,
} from '../src/main/brickManualWrite';
import { validateManual } from '../src/racer/hub/brick/manual';
import {
  createEmptyEditorState,
  editorStateToManual,
  manualToEditorState,
  placeEditorBrick,
  validateEditorManual,
} from '../src/racer/levels/brickLab/editor';

const STEM = 'zz-ed-roundtrip';
const MANUALS_DIR = path.resolve(__dirname, '../src/racer/hub/brick/manuals');
const FILE = path.join(MANUALS_DIR, `${STEM}.manual.json`);

afterEach(() => {
  if (existsSync(FILE)) unlinkSync(FILE);
});

describe('brick manual save / load IPC helpers', () => {
  it('lists existing manuals including fountain', () => {
    const listed = listBrickManualFiles();
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.stems).toContain('fountain');
    expect(listed.stems).toContain('tower');
  });

  it('reads fountain and validates', () => {
    const res = readBrickManualFile('fountain');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const checked = validateManual(res.manual);
    expect(checked.ok).toBe(true);
  });

  it('rejects bad stem', () => {
    expect(writeBrickManualFile('Bad Stem', { id: 'x' }).ok).toBe(false);
    expect(readBrickManualFile('../escape').ok).toBe(false);
  });

  it('round-trips editor place → write → read → editor', () => {
    const state = createEmptyEditorState(STEM, 'Roundtrip');
    state.partId = '3005';
    state.colorId = 'gray';
    expect(placeEditorBrick(state, 0, 0, 0)).toBeTruthy();
    expect(placeEditorBrick(state, 2, 0, 1)).toBeTruthy();
    expect(validateEditorManual(state)).toEqual([]);

    const manual = editorStateToManual(state);
    const written = writeBrickManualFile(STEM, manual);
    expect(written.ok, written.error).toBe(true);
    expect(written.path && existsSync(written.path)).toBe(true);

    const listed = listBrickManualFiles();
    expect(listed.ok && listed.stems.includes(STEM)).toBe(true);

    const loaded = readBrickManualFile(STEM);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const checked = validateManual(loaded.manual);
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;

    const restored = manualToEditorState(checked.manual, STEM);
    expect(restored.stem).toBe(STEM);
    expect(restored.title).toBe('Roundtrip');
    expect(restored.ops).toHaveLength(2);
    expect(restored.ops.map((o) => o.at)).toEqual([
      [0, 0, 0],
      [2, 0, 1],
    ]);
    expect(restored.ops.map((o) => o.part)).toEqual(['3005', '3005']);
    expect(validateEditorManual(restored)).toEqual([]);
  });
});
