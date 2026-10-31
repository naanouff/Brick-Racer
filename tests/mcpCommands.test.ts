/**
 * @file mcpCommands.test.ts
 * @description LT4 + BA1/BA2 — MCP command apply.
 */

import { describe, expect, it } from 'vitest';
import { createEmptyEditorState } from '../src/racer/levels/brickLab/editor/editorState';
import { applyMcpCommand } from '../src/racer/levels/brickLab/editor/mcpCommands';
import {
  macroColumn,
  macroFillRect,
  macroRingOrDisc,
  macroWall,
} from '../src/racer/levels/brickLab/editor/mcpMacros';

describe('applyMcpCommand (LT4)', () => {
  it('status reports connected on brick-lab', async () => {
    const state = createEmptyEditorState('demo', 'Demo');
    const res = await applyMcpCommand({ type: 'status' }, { levelId: 'brick-lab', state });
    expect(res.ok).toBe(true);
    expect(res.connected).toBe(true);
    expect(res.stem).toBe('demo');
  });

  it('place_bricks places a lot with one undo', async () => {
    const state = createEmptyEditorState();
    const res = await applyMcpCommand(
      {
        type: 'place_bricks',
        bricks: [
          { part: '3005', color: 'gray', at: [0, 0, 0] },
          { part: '3005', color: 'gray', at: [1, 0, 0] },
        ],
      },
      { levelId: 'brick-lab', state }
    );
    expect(res.ok).toBe(true);
    expect(state.ops).toHaveLength(2);
    expect(state.undo).toHaveLength(1);

    const undo = await applyMcpCommand({ type: 'undo' }, { levelId: 'brick-lab', state });
    expect(undo.ok).toBe(true);
    expect(state.ops).toHaveLength(0);
  });

  it('place_bricks rejects collision partially', async () => {
    const state = createEmptyEditorState();
    await applyMcpCommand(
      {
        type: 'place_bricks',
        bricks: [{ part: '3005', color: 'gray', at: [0, 0, 0] }],
      },
      { levelId: 'brick-lab', state }
    );
    const res = await applyMcpCommand(
      {
        type: 'place_bricks',
        bricks: [
          { part: '3005', color: 'gray', at: [0, 0, 0] },
          { part: '3005', color: 'red', at: [2, 0, 0] },
        ],
      },
      { levelId: 'brick-lab', state }
    );
    expect(res.ok).toBe(true);
    expect(res.rejected).toEqual([
      expect.objectContaining({ index: 0, reason: 'collision', cell: [0, 0, 0] }),
    ]);
    expect(state.ops).toHaveLength(2);
  });

  it('refuses edits when not on brick-lab', async () => {
    const state = createEmptyEditorState();
    const res = await applyMcpCommand(
      { type: 'place_bricks', bricks: [{ part: '3005', color: 'gray', at: [0, 0, 0] }] },
      { levelId: 'race-test', state }
    );
    expect(res.ok).toBe(false);
    expect(String(res.error)).toMatch(/non connecté/);
  });

  it('set_brush updates part and rot', async () => {
    const state = createEmptyEditorState();
    const res = await applyMcpCommand(
      { type: 'set_brush', part: '3001', rot: 90 },
      { levelId: 'brick-lab', state }
    );
    expect(res.ok).toBe(true);
    expect(state.partId).toBe('3001');
    expect(state.rot).toBe(90);
  });
});

describe('applyMcpCommand (BA1)', () => {
  it('dryRun place_bricks mutates nothing and reports collision detail', async () => {
    const state = createEmptyEditorState();
    await applyMcpCommand(
      { type: 'place_bricks', bricks: [{ part: '3005', color: 'gray', at: [0, 0, 0] }] },
      { levelId: 'brick-lab', state }
    );
    const before = state.ops.length;
    const undoLen = state.undo.length;
    const res = await applyMcpCommand(
      {
        type: 'place_bricks',
        dryRun: true,
        bricks: [
          { part: '3005', color: 'red', at: [0, 0, 0] },
          { part: '3005', color: 'red', at: [3, 0, 0] },
        ],
      },
      { levelId: 'brick-lab', state }
    );
    expect(res.ok).toBe(true);
    expect(res.dryRun).toBe(true);
    expect(state.ops).toHaveLength(before);
    expect(state.undo).toHaveLength(undoLen);
    expect(res.placed).toEqual([{ index: 1, id: 'dry1' }]);
    expect(res.rejected).toEqual([
      expect.objectContaining({ index: 0, reason: 'collision', cell: [0, 0, 0] }),
    ]);
  });

  it('query_region returns occupied cells and ops', async () => {
    const state = createEmptyEditorState();
    await applyMcpCommand(
      {
        type: 'place_bricks',
        bricks: [
          { part: '3005', color: 'gray', at: [0, 0, 0] },
          { part: '3005', color: 'gray', at: [5, 0, 5] },
        ],
      },
      { levelId: 'brick-lab', state }
    );
    const res = await applyMcpCommand(
      { type: 'query_region', min: [0, 0, 0], max: [1, 2, 1] },
      { levelId: 'brick-lab', state }
    );
    expect(res.ok).toBe(true);
    expect((res.cells as unknown[]).length).toBeGreaterThan(0);
    expect((res.ops as unknown[]).length).toBe(1);
  });

  it('analyze lists floating bricks and BOM', async () => {
    const state = createEmptyEditorState();
    await applyMcpCommand(
      {
        type: 'place_bricks',
        bricks: [
          { part: '3005', color: 'gray', at: [0, 0, 0] },
          { part: '3005', color: 'cyan', at: [2, 6, 0] },
        ],
      },
      { levelId: 'brick-lab', state }
    );
    const res = await applyMcpCommand({ type: 'analyze' }, { levelId: 'brick-lab', state });
    expect(res.ok).toBe(true);
    expect(res.ops).toBe(2);
    expect(res.bbox).toEqual({ min: [0, 0, 0], max: [2, 8, 0] });
    expect(res.bom).toEqual(
      expect.arrayContaining([
        { part: '3005', color: 'gray', qty: 1 },
        { part: '3005', color: 'cyan', qty: 1 },
      ])
    );
    expect(res.floating).toEqual([
      expect.objectContaining({ part: '3005', color: 'cyan', at: [2, 6, 0] }),
    ]);
  });

  it('remove_bricks removes a region with one undo', async () => {
    const state = createEmptyEditorState();
    await applyMcpCommand(
      {
        type: 'place_bricks',
        bricks: [
          { part: '3005', color: 'gray', at: [0, 0, 0] },
          { part: '3005', color: 'gray', at: [1, 0, 0] },
          { part: '3005', color: 'gray', at: [8, 0, 0] },
        ],
      },
      { levelId: 'brick-lab', state }
    );
    const res = await applyMcpCommand(
      { type: 'remove_bricks', min: [0, 0, 0], max: [2, 3, 2] },
      { levelId: 'brick-lab', state }
    );
    expect(res.ok).toBe(true);
    expect(state.ops).toHaveLength(1);
    expect(state.ops[0]!.at).toEqual([8, 0, 0]);
    expect(state.undo).toHaveLength(2);
    await applyMcpCommand({ type: 'undo' }, { levelId: 'brick-lab', state });
    expect(state.ops).toHaveLength(3);
  });

  it('set_view calls context callback', async () => {
    const state = createEmptyEditorState();
    const views: string[] = [];
    const res = await applyMcpCommand(
      { type: 'set_view', view: 'top' },
      {
        levelId: 'brick-lab',
        state,
        setView: (v) => {
          views.push(v);
        },
      }
    );
    expect(res.ok).toBe(true);
    expect(views).toEqual(['top']);
  });
});

describe('mcpMacros (BA2)', () => {
  it('fill_rect covers every stud without internal overlap', () => {
    const bricks = macroFillRect({
      min: [0, 0, 0],
      max: [3, 0, 2],
      color: 'gray',
      part: '3024',
    });
    expect(bricks.length).toBe(12);
    const cells = new Set(bricks.map((b) => `${b.at[0]},${b.at[2]}`));
    expect(cells.size).toBe(12);
  });

  it('wall along X has no footprint collisions in batch', async () => {
    const specs = macroWall({
      from: [0, 0, 0],
      to: [5, 2, 0],
      color: 'gray',
      part: '3005',
    });
    expect(specs.length).toBeGreaterThan(0);
    const state = createEmptyEditorState();
    const res = await applyMcpCommand(
      { type: 'place_bricks', bricks: specs },
      { levelId: 'brick-lab', state }
    );
    expect(res.ok).toBe(true);
    expect((res.rejected as unknown[]).length).toBe(0);
  });

  it('ring radius 2 is hollow; disc is filled', () => {
    const ring = macroRingOrDisc({
      kind: 'ring',
      center: [0, 0],
      radius: 2,
      y: 0,
      color: 'gray',
      part: '6141',
    });
    const disc = macroRingOrDisc({
      kind: 'disc',
      center: [0, 0],
      radius: 2,
      y: 0,
      color: 'gray',
      part: '6141',
    });
    expect(disc.length).toBeGreaterThan(ring.length);
    expect(ring.every((b) => {
      const dx = b.at[0] + 0.5;
      const dz = b.at[2] + 0.5;
      return Math.hypot(dx, dz) >= 0.9;
    })).toBe(true);
  });

  it('column stacks by footprint height', () => {
    const col = macroColumn({
      part: '3062',
      color: 'gray',
      at: [0, 0, 0],
      count: 3,
    });
    expect(col).toHaveLength(3);
    expect(col.map((b) => b.at[1])).toEqual([0, 3, 6]);
  });

  it('ring macro places without internal collision', async () => {
    const specs = macroRingOrDisc({
      kind: 'ring',
      center: [0, 0],
      radius: 3,
      y: 0,
      color: 'gray',
      part: '6141',
    });
    const state = createEmptyEditorState();
    const res = await applyMcpCommand(
      { type: 'place_bricks', bricks: specs },
      { levelId: 'brick-lab', state }
    );
    expect(res.ok).toBe(true);
    expect((res.rejected as unknown[]).length).toBe(0);
    expect(state.ops.length).toBe(specs.length);
  });
});
