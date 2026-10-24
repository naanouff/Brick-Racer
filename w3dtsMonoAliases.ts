/**
 * Vite / Vitest aliases for unpublished @naanouff/w3dts-* (GitHub Packages).
 * Expects sibling checkout: ../w3dts_repos/w3dts (see docs/build.md).
 *
 * Levels are TypeScript modules (no SceneDD / scenedd alias).
 */
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
export const W3DTS_MONO_ROOT = resolve(root, '../w3dts_repos/w3dts');

/** [package id, path under packages/] */
const PACKAGES: Array<[string, string]> = [
  ['@naanouff/w3dts-scripts', 'scripts/dist/w3dts-scripts.es.js'],
  // npm 0.2.8 lacks LegoWheel / LegoAxleBracket / MeshLOD used by public/gproc kart graphs.
  ['@naanouff/w3dts-gproc', 'gproc/src/index.ts'],
  // npm 0.0.28 lacks yawAssist / uprightStiffness / antiWheelie / applyKartPhysicsCollisionTuning.
  ['@naanouff/w3dts-physics', 'physics/src/index.ts'],
];

export function isW3dtsMonoAvailable(): boolean {
  if (process.env.BRICK_RACER_NO_MONO === '1') return false;
  return PACKAGES.every(([, entry]) => existsSync(resolve(W3DTS_MONO_ROOT, 'packages', entry)));
}

export function createW3dtsMonoAliases(): Record<string, string> {
  const aliases: Record<string, string> = {};
  for (const [id, entry] of PACKAGES) {
    aliases[id] = resolve(W3DTS_MONO_ROOT, 'packages', entry);
  }
  return aliases;
}

