/**
 * @file registry.ts
 * @description Known brick manuals for brick-lab hot-swap.
 */

import fountainManual from './fountain.manual.json';
import type { BrickManual } from '../manual/manualSchema';

export type BrickManualId = 'fountain';

export const BRICK_MANUAL_IDS: readonly BrickManualId[] = ['fountain'];

export function getBrickManual(id: BrickManualId): BrickManual {
  switch (id) {
    case 'fountain':
      return fountainManual as BrickManual;
  }
}

export function brickManualLabel(id: BrickManualId): string {
  switch (id) {
    case 'fountain':
      return 'Fontaine A1';
  }
}
