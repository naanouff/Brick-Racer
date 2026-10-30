/**
 * @file labPrefs.ts
 * @description brick-lab HUD prefs (manual id + shell) — sessionStorage for packaged Electron.
 */

import { BRICK_MANUAL_IDS, type BrickManualId } from './registry';

const MANUAL_KEY = 'brick-racer.brickLab.manual';
const SHELL_KEY = 'brick-racer.brickLab.shell';

export function isBrickManualId(v: string | null | undefined): v is BrickManualId {
  return v != null && (BRICK_MANUAL_IDS as readonly string[]).includes(v);
}

export function readBrickLabManualId(): BrickManualId {
  try {
    const raw = sessionStorage.getItem(MANUAL_KEY);
    if (isBrickManualId(raw)) return raw;
  } catch {
    /* ignore */
  }
  return 'fountain';
}

export function writeBrickLabManualId(id: BrickManualId): void {
  try {
    sessionStorage.setItem(MANUAL_KEY, id);
  } catch {
    /* ignore */
  }
}

export function readBrickLabShell(): boolean {
  try {
    const raw = sessionStorage.getItem(SHELL_KEY);
    if (raw === '0') return false;
    if (raw === '1') return true;
  } catch {
    /* ignore */
  }
  return true;
}

export function writeBrickLabShell(on: boolean): void {
  try {
    sessionStorage.setItem(SHELL_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}
