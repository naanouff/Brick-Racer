/**
 * @file types.ts
 * @description LEGO part / color catalog types (BC1 — data-first).
 */

/** Vertical / stud occupancy at yaw 0: [studs X, plates Y, studs Z]. */
export type BrickFootprint = readonly [number, number, number];

export type BrickPartCategory =
  | 'brick'
  | 'plate'
  | 'tile'
  | 'round'
  | 'slope'
  | 'dish'
  | 'cone'
  | 'arch'
  | 'bracket'
  | 'plant'
  | 'technic'
  | 'other';

export const BRICK_PART_CATEGORIES: readonly BrickPartCategory[] = [
  'brick',
  'plate',
  'tile',
  'round',
  'slope',
  'dish',
  'cone',
  'arch',
  'bracket',
  'plant',
  'technic',
  'other',
] as const;

export type BrickMeshStatus = 'missing' | 'box' | 'ready';

export type BrickPartDef = {
  /** Stable Brick-Racer id = LEGO design number when known (e.g. "3005", "85080"). */
  id: string;
  name: string;
  category: BrickPartCategory;
  footprint: BrickFootprint;
  /** Short ids accepted in manuals (legacy BW1). */
  aliases?: readonly string[];
  mesh: { status: BrickMeshStatus; asset?: string };
  /** LDraw design id when different from `id` (else omit — use `id`). */
  ldrawId?: string;
  /** Free-form search tags (ED). */
  tags?: readonly string[];
  /** Optional notes (BOM mapping, LDraw file, …). */
  notes?: string;
};

export type BrickColorDef = {
  /** Runtime slug used in manuals / materials (`gray`, `cyan`). */
  id: string;
  name: string;
  /** sRGB 0..1 plastic base. */
  rgb: readonly [number, number, number];
  /** BrickLink color id when known. */
  blId?: number;
  /** Approximate translucency intent (materials may still be opaque in BW1). */
  translucent?: boolean;
  aliases?: readonly string[];
};

export type BrickCatalog = {
  version: number;
  parts: readonly BrickPartDef[];
  colors: readonly BrickColorDef[];
};
