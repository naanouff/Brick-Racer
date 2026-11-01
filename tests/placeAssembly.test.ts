/**
 * @file placeAssembly.test.ts
 * @description MCP place_assembly — merge a saved stem at an offset.
 */

import { describe, expect, it } from 'vitest';
import { createEmptyEditorState } from '../src/racer/levels/brickLab/editor/editorState';
import {
  applyMcpCommand,
  bricksFromManualOffset,
} from '../src/racer/levels/brickLab/editor/mcpCommands';
import type { BrickManual } from '../src/racer/hub/brick/manual';

const miniManual: BrickManual = {
  id: 'landmark.mod-a',
  version: 1,
  title: 'mod-a',
  origin: [0, 0, 0],
  envelope: { size: [2.64, 0.66, 2.64] },
  partsList: [
    { part: '3005', color: 'gray', qty: 1 },
    { part: '3005', color: 'red', qty: 1 },
  ],
  steps: [
    {
      title: '1',
      ops: [
        { op: 'brick', part: '3005', color: 'gray', at: [0, 0, 0] },
        { op: 'brick', part: '3005', color: 'red', at: [1, 0, 0], rot: 90 },
      ],
    },
  ],
};

describe('bricksFromManualOffset', () => {
  it('translates local at by world origin', () => {
    const bricks = bricksFromManualOffset(miniManual, [10, 2, -3]);
    expect(bricks).toEqual([
      { part: '3005', color: 'gray', at: [10, 2, -3] },
      { part: '3005', color: 'red', at: [11, 2, -3], rot: 90 },
    ]);
  });
});

describe('applyMcpCommand place_assembly', () => {
  it('merges a saved stem into the current scene at at[]', async () => {
    const state = createEmptyEditorState('master', 'Master');
    await applyMcpCommand(
      {
        type: 'place_bricks',
        bricks: [{ part: '3005', color: 'white', at: [0, 0, 0] }],
      },
      { levelId: 'brick-lab', state }
    );

    const res = await applyMcpCommand(
      { type: 'place_assembly', stem: 'mod-a', at: [5, 0, 2] },
      {
        levelId: 'brick-lab',
        state,
        readManual: async (stem) => {
          if (stem !== 'mod-a') return { ok: false, error: 'missing' };
          return { ok: true, stem, manual: miniManual };
        },
      }
    );

    expect(res.ok).toBe(true);
    expect(res.stem).toBe('mod-a');
    expect(res.placedCount).toBe(2);
    expect(state.ops).toHaveLength(3);
    expect(state.ops.map((o) => o.at)).toEqual(
      expect.arrayContaining([
        [0, 0, 0],
        [5, 0, 2],
        [6, 0, 2],
      ])
    );
    expect(state.undo).toHaveLength(2); // base place + assembly as one undo each
  });

  it('dryRun does not mutate', async () => {
    const state = createEmptyEditorState();
    const res = await applyMcpCommand(
      { type: 'place_assembly', stem: 'mod-a', at: [0, 0, 0], dryRun: true },
      {
        levelId: 'brick-lab',
        state,
        readManual: async () => ({ ok: true, stem: 'mod-a', manual: miniManual }),
      }
    );
    expect(res.ok).toBe(true);
    expect(res.dryRun).toBe(true);
    expect(state.ops).toHaveLength(0);
  });

  it('fails when stem missing', async () => {
    const state = createEmptyEditorState();
    const res = await applyMcpCommand(
      { type: 'place_assembly', stem: 'nope', at: [0, 0, 0] },
      {
        levelId: 'brick-lab',
        state,
        readManual: async () => ({ ok: false, error: 'introuvable' }),
      }
    );
    expect(res.ok).toBe(false);
    expect(String(res.error)).toMatch(/introuvable|indisponible/i);
  });
});
