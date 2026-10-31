/**
 * @file brickManualWrite.ts
 * @description Dev IPC: list / read / write brick-lab manuals under manuals/ (ED4).
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export type ManualWriteResult = {
  ok: boolean;
  path?: string;
  error?: string;
};

export type ManualListResult =
  | { ok: true; stems: string[] }
  | { ok: false; error: string };

export type ManualReadResult =
  | { ok: true; stem: string; manual: unknown; path: string }
  | { ok: false; error: string };

const STEM_RE = /^[a-z0-9-]+$/;

function manualsDir(): string {
  return path.join(__dirname, '../../src/racer/hub/brick/manuals');
}

export function listBrickManualFiles(): ManualListResult {
  try {
    const dir = manualsDir();
    if (!existsSync(dir)) return { ok: true, stems: [] };
    const stems = readdirSync(dir)
      .filter((f) => f.endsWith('.manual.json'))
      .map((f) => f.replace(/\.manual\.json$/i, ''))
      .filter((s) => STEM_RE.test(s))
      .sort((a, b) => a.localeCompare(b));
    return { ok: true, stems };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function readBrickManualFile(stem: unknown): ManualReadResult {
  const s = String(stem ?? '').trim();
  if (!STEM_RE.test(s)) return { ok: false, error: 'stem must match [a-z0-9-]+' };
  try {
    const filePath = path.join(manualsDir(), `${s}.manual.json`);
    if (!existsSync(filePath)) return { ok: false, error: `introuvable: ${s}.manual.json` };
    const manual = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
    if (!manual || typeof manual !== 'object') return { ok: false, error: 'json object required' };
    return { ok: true, stem: s, manual, path: filePath };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function writeBrickManualFile(stem: unknown, json: unknown): ManualWriteResult {
  const s = String(stem ?? '').trim();
  if (!STEM_RE.test(s)) return { ok: false, error: 'stem must match [a-z0-9-]+' };
  if (!json || typeof json !== 'object') return { ok: false, error: 'json object required' };
  try {
    const dir = manualsDir();
    mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `${s}.manual.json`);
    writeFileSync(filePath, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
    return { ok: true, path: filePath };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
