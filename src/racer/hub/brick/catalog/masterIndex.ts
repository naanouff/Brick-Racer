/**
 * @file masterIndex.ts
 * @description Types + fetch for public/catalog/master-index.json (CL1).
 */

import type { BrickFootprint } from './types';

export type MasterIndexEntry = {
  id: string;
  name: string;
  category_id: string;
  ldraw_id: string | null;
  footprint: BrickFootprint;
  dims_mm?: { w?: number; h?: number; d?: number };
};

export type MasterIndexFile = {
  version: number;
  count: number;
  parts: MasterIndexEntry[];
};

const MASTER_INDEX_URL = '/catalog/master-index.json';

let cached: MasterIndexFile | null = null;

export async function loadMasterIndex(
  url = MASTER_INDEX_URL,
  force = false
): Promise<MasterIndexFile> {
  if (cached && !force) return cached;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`master-index HTTP ${res.status}`);
  const data = (await res.json()) as MasterIndexFile;
  if (!Array.isArray(data.parts)) throw new Error('master-index: missing parts[]');
  cached = data;
  return data;
}

export function clearMasterIndexCache(): void {
  cached = null;
}
