/**
 * @file types.ts
 * @description LEGO part / color catalog types (BC1 + BRICK-MT1).
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

/** Surface finish derived from LDConfig (BRICK-MT). */
export type BrickMaterialKind =
  | 'plastic'
  | 'transparent'
  | 'rubber'
  | 'chrome'
  | 'metallic'
  | 'pearl'
  | 'glow'
  | 'glitter'
  | 'satin'
  | 'speckle';

export const BRICK_MATERIAL_KINDS: readonly BrickMaterialKind[] = [
  'plastic',
  'transparent',
  'rubber',
  'chrome',
  'metallic',
  'pearl',
  'glow',
  'glitter',
  'satin',
  'speckle',
] as const;

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
  /**
   * When set, UI / validators prefer colours whose `material` is in this list
   * (e.g. tires → `['rubber']`). Warning only — not a hard schema error.
   */
  allowedMaterials?: readonly BrickMaterialKind[];
};

export type BrickGlitterDef = {
  rgb: readonly [number, number, number];
  fraction: number;
  size: number;
};

/** @deprecated Prefer BrickGlitterDef */
export type BrickColorGlitter = BrickGlitterDef;

export type BrickColorDef = {
  /** Runtime slug = LDraw name lowercased (`light_bluish_grey`, `trans_clear`). */
  id: string;
  name: string;
  /** sRGB 0..1 base from LDConfig VALUE. */
  rgb: readonly [number, number, number];
  /** Official LDraw colour CODE. */
  ldrawCode?: number;
  /** Finish / material kind from LDConfig keywords. */
  material?: BrickMaterialKind;
  /** 0..1 when LDConfig ALPHA present. */
  alpha?: number;
  /** LDConfig LUMINANCE (glow). */
  luminance?: number;
  /** Glitter / speckle particle params from MATERIAL block. */
  glitter?: BrickGlitterDef;
  /** BrickLink color id when known. */
  blId?: number;
  /**
   * Approximate translucency (UI / legacy). Prefer `material` + `alpha`.
   * Set by palette gen for transparent / glitter / satin.
   */
  translucent?: boolean;
  /** Highlight in material→colour picker (MT3). */
  common?: boolean;
  /** Legacy / alternate slugs (`gray` → light_bluish_grey). */
  aliases?: readonly string[];
};

export type BrickCatalog = {
  version: number;
  parts: readonly BrickPartDef[];
  colors: readonly BrickColorDef[];
};
