/**
 * @file types.ts
 * @description Minifig recipe + slot types (BRICK-MF1a).
 */

/** Cosmetic slots aligned with docs/design/minifig-gproc.md. */
export const MINIFIG_SLOTS = [
  'head',
  'facePrint',
  'hat',
  'hair',
  'torso',
  'arms',
  'hands',
  'hipsLegs',
  'accessoryL',
  'accessoryR',
] as const;

export type MinifigSlot = (typeof MINIFIG_SLOTS)[number];

/** Slots that must resolve to a catalog part id (prints are separate). */
export const MINIFIG_PART_SLOTS = [
  'head',
  'hat',
  'hair',
  'torso',
  'arms',
  'hands',
  'hipsLegs',
  'accessoryL',
  'accessoryR',
] as const satisfies readonly MinifigSlot[];

export type MinifigPartSlot = (typeof MINIFIG_PART_SLOTS)[number];

export type MinifigSlotAssignment = {
  /** Catalog part id (e.g. `head.basic`). Omit / null = empty slot. */
  part?: string | null;
  /** Face / torso print id (catalog print entry). */
  print?: string | null;
  /** CSS hex `#RRGGBB` or `#RGB`. */
  tint?: string | null;
};

export type MinifigRecipe = {
  id: string;
  displayName: string;
  slots: Partial<Record<MinifigSlot, MinifigSlotAssignment>>;
};

export type MinifigPartKind = 'mesh' | 'print';

export type MinifigCatalogEntry = {
  id: string;
  slot: MinifigSlot | 'print';
  kind: MinifigPartKind;
  displayName: string;
  /** GPROC graph id (center / single part). Assemble uses a blockout proxy when unset. */
  gprocId?: string;
  /** Mirrored L/R graphs for paired parts (arms, legs). */
  gprocPair?: { left: string; right: string };
  /** Default tint when recipe omits one. */
  defaultTint?: string;
  /** Rough brick AABB used by blockout assemble (full extents). */
  proxySize?: [number, number, number];
  /** Public URL for print atlases / decals (MF3). */
  textureUrl?: string;
};
