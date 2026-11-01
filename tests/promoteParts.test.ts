/**
 * @file promoteParts.test.ts
 * @description CF1a — BOM id resolve against master-index.
 */

import { describe, expect, it } from 'vitest';
import {
  indexMasterParts,
  masterEntryToPartDef,
  promotePartsFromMaster,
  type MasterIndexEntry,
} from '../src/racer/hub/brick/catalog';

const masterParts: MasterIndexEntry[] = [
  {
    id: '3001',
    name: 'Brick 2 x 4',
    category_id: '5',
    footprint: [2, 3, 4],
    ldraw_id: '3001',
  },
  {
    id: '99991',
    name: 'Plate 1 x 1 Round',
    category_id: '21',
    footprint: [1, 1, 1],
    ldraw_id: '99991',
  },
  {
    id: '99992',
    name: 'Weird Part',
    category_id: '1',
    footprint: [0, 1, 1],
    ldraw_id: null,
  },
];

describe('promotePartsFromMaster (CF1a)', () => {
  const masterById = indexMasterParts(masterParts);
  const seedIds = new Set(['3001']);

  it('masterEntryToPartDef rejects invalid footprint', () => {
    expect(masterEntryToPartDef(masterParts[2]!)).toBeNull();
    expect(masterEntryToPartDef(masterParts[1]!)?.category).toBe('plate');
  });

  it('buckets alreadyBc1 / promoted / unresolved / noFootprint', () => {
    const report = promotePartsFromMaster(
      ['3001', '99991', '99992', 'nope', '99991'],
      masterById,
      seedIds,
      { setNum: '10359' }
    );
    expect(report.setNum).toBe('10359');
    expect(report.counts).toEqual({
      alreadyBc1: 1,
      promoted: 1,
      noFootprint: 1,
      unresolved: 1,
    });
    expect(report.defs.map((d) => d.id).sort()).toEqual(['3001', '99991']);
    expect(report.defs.find((d) => d.id === '99991')?.mesh.status).toBe('box');
  });
});
