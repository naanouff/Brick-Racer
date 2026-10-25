/**
 * @file gprocGraphs.ts
 * @description Minifig GPROC graph refs (BRICK-MF1 / MF2).
 */

import type { GraphRef } from '../levels/shared/levelTypes';

export const MINIFIG_GPROC_GRAPHS: readonly GraphRef[] = [
  { id: 'minifig_head', url: '/gproc/minifig-head-generator.json' },
  { id: 'minifig_torso', url: '/gproc/minifig-torso-generator.json' },
  { id: 'minifig_arm_r', url: '/gproc/minifig-arm-r-generator.json' },
  { id: 'minifig_arm_l', url: '/gproc/minifig-arm-l-generator.json' },
  { id: 'minifig_hand', url: '/gproc/minifig-hand-generator.json' },
  { id: 'minifig_hips', url: '/gproc/minifig-hips-generator.json' },
  { id: 'minifig_leg_r', url: '/gproc/minifig-leg-r-generator.json' },
  { id: 'minifig_leg_l', url: '/gproc/minifig-leg-l-generator.json' },
  { id: 'minifig_hat', url: '/gproc/minifig-hat-generator.json' },
  { id: 'minifig_wrench', url: '/gproc/minifig-wrench-generator.json' },
] as const;

export type MinifigGprocGraphId = (typeof MINIFIG_GPROC_GRAPHS)[number]['id'];
