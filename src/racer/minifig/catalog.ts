/**
 * @file catalog.ts
 * @description Part catalog — GPROC parts for all body slots (BRICK-MF2).
 */

import type { MinifigCatalogEntry } from './types';

/** Catalog — mesh parts map to MF2 generators; arms/legs declare mirrored L/R graphs. */
export const PART_CATALOG: readonly MinifigCatalogEntry[] = [
  {
    id: 'head.basic',
    slot: 'head',
    kind: 'mesh',
    displayName: 'Tête basique',
    defaultTint: '#F5D76E',
    gprocId: 'minifig_head',
    proxySize: [0.5, 0.58, 0.5],
  },
  {
    id: 'hat.cap_mechanic',
    slot: 'hat',
    kind: 'mesh',
    displayName: 'Casquette mécano',
    defaultTint: '#1a1a1a',
    gprocId: 'minifig_hat',
    proxySize: [0.52, 0.2, 0.58],
  },
  {
    id: 'hat.none',
    slot: 'hat',
    kind: 'mesh',
    displayName: 'Sans casquette',
    proxySize: [0.01, 0.01, 0.01],
  },
  {
    id: 'torso.coverall',
    slot: 'torso',
    kind: 'mesh',
    displayName: 'Combinaison (torse)',
    defaultTint: '#1B4F72',
    gprocId: 'minifig_torso',
    proxySize: [0.62, 0.72, 0.36],
  },
  {
    id: 'torso.plain',
    slot: 'torso',
    kind: 'mesh',
    displayName: 'Torse uni',
    defaultTint: '#C0392B',
    gprocId: 'minifig_torso',
    proxySize: [0.62, 0.72, 0.36],
  },
  {
    id: 'arms.coverall',
    slot: 'arms',
    kind: 'mesh',
    displayName: 'Bras combinaison',
    defaultTint: '#1B4F72',
    gprocPair: { left: 'minifig_arm_l', right: 'minifig_arm_r' },
    proxySize: [0.21, 0.58, 0.21],
  },
  {
    id: 'hands.glove',
    slot: 'hands',
    kind: 'mesh',
    displayName: 'Gants',
    defaultTint: '#111111',
    gprocId: 'minifig_hand',
    proxySize: [0.18, 0.16, 0.18],
  },
  {
    id: 'hands.bare',
    slot: 'hands',
    kind: 'mesh',
    displayName: 'Mains nues',
    defaultTint: '#F5D76E',
    gprocId: 'minifig_hand',
    proxySize: [0.18, 0.16, 0.18],
  },
  {
    id: 'legs.coverall',
    slot: 'hipsLegs',
    kind: 'mesh',
    displayName: 'Jambes combinaison',
    defaultTint: '#1B4F72',
    gprocId: 'minifig_hips',
    gprocPair: { left: 'minifig_leg_l', right: 'minifig_leg_r' },
    proxySize: [0.33, 0.7, 0.38],
  },
  {
    id: 'prop.wrench_chrome',
    slot: 'accessoryR',
    kind: 'mesh',
    displayName: 'Clé chrome',
    defaultTint: '#B0B7C3',
    gprocId: 'minifig_wrench',
    proxySize: [0.1, 0.5, 0.14],
  },
  {
    id: 'face.frown_stubble_orange',
    slot: 'facePrint',
    kind: 'print',
    displayName: 'Visage frown + stubble',
    textureUrl: '/minifig/prints/face-frown-stubble-orange.webp',
  },
  {
    id: 'print.mechanic',
    slot: 'print',
    kind: 'print',
    displayName: 'Print mécano',
    textureUrl: '/minifig/prints/torso-mechanic.webp',
  },
] as const;

const BY_ID = new Map(PART_CATALOG.map((e) => [e.id, e]));

export function getCatalogEntry(id: string): MinifigCatalogEntry | undefined {
  return BY_ID.get(id);
}

export function requireCatalogEntry(id: string): MinifigCatalogEntry {
  const entry = BY_ID.get(id);
  if (!entry) {
    throw new Error(`Unknown minifig catalog id: "${id}"`);
  }
  return entry;
}

export function listCatalogForSlot(slot: MinifigCatalogEntry['slot']): MinifigCatalogEntry[] {
  return PART_CATALOG.filter((e) => e.slot === slot && e.kind === 'mesh');
}
