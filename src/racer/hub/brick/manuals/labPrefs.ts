/**
 * @file labPrefs.ts
 * @description brick-lab HUD prefs (manual / shell / overlay / view) — sessionStorage.
 */

import { isBrickManualId, type BrickManualId } from './registry';

const MANUAL_KEY = 'brick-racer.brickLab.manual';
const SHELL_KEY = 'brick-racer.brickLab.shell';
const OVERLAY_OPACITY_KEY = 'brick-racer.brickLab.overlayOpacity';
const VIEW_KEY = 'brick-racer.brickLab.view';

const VIEWS = ['orbit', 'face', 'side', 'top'] as const;
export type BrickLabViewPref = (typeof VIEWS)[number];

export type { BrickManualId };
export { isBrickManualId };

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

/** 0–1 overlay opacity; default 0.35. */
export function readBrickLabOverlayOpacity(): number {
  try {
    const raw = sessionStorage.getItem(OVERLAY_OPACITY_KEY);
    if (raw == null) return 0.35;
    const n = Number(raw);
    if (Number.isFinite(n)) return Math.min(1, Math.max(0, n));
  } catch {
    /* ignore */
  }
  return 0.35;
}

export function writeBrickLabOverlayOpacity(opacity: number): void {
  try {
    sessionStorage.setItem(
      OVERLAY_OPACITY_KEY,
      String(Math.min(1, Math.max(0, opacity)))
    );
  } catch {
    /* ignore */
  }
}

export function readBrickLabView(): BrickLabViewPref {
  try {
    const raw = sessionStorage.getItem(VIEW_KEY);
    if (raw && (VIEWS as readonly string[]).includes(raw)) {
      return raw as BrickLabViewPref;
    }
  } catch {
    /* ignore */
  }
  return 'orbit';
}

export function writeBrickLabView(view: BrickLabViewPref): void {
  try {
    sessionStorage.setItem(VIEW_KEY, view);
  } catch {
    /* ignore */
  }
}
