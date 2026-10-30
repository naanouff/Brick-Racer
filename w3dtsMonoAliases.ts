/**
 * Vite / Vitest aliases for unpublished @naanouff/w3dts-* (GitHub Packages).
 * Expects a sibling w3dts monorepo checkout (see docs/build.md).
 *
 * Levels are TypeScript modules (no SceneDD / scenedd alias).
 */
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

/** [package id, path under packages/] */
const PACKAGES: Array<[string, string]> = [
  ['@naanouff/w3dts-scripts', 'scripts/dist/w3dts-scripts.es.js'],
  // npm 0.2.8 lacks LegoWheel / LegoAxleBracket / MeshLOD used by public/gproc kart graphs.
  ['@naanouff/w3dts-gproc', 'gproc/src/index.ts'],
  // npm 0.0.28 lacks yawAssist / uprightStiffness / antiWheelie / applyKartPhysicsCollisionTuning.
  ['@naanouff/w3dts-physics', 'physics/src/index.ts'],
  // npm 0.0.21 lacks HID gamepad (INP-G) — bindings + writeGamepadHardware.
  ['@naanouff/w3dts-input', 'input/src/index.ts'],
];

function packagesReady(monoRoot: string): boolean {
  return PACKAGES.every(([, entry]) => existsSync(resolve(monoRoot, 'packages', entry)));
}

/**
 * Resolve monorepo root: W3DTS_MONO_ROOT env, then known sibling layouts.
 */
function resolveMonoRoot(): string | null {
  if (process.env.BRICK_RACER_NO_MONO === '1') return null;

  const candidates: string[] = [];
  const fromEnv = process.env.W3DTS_MONO_ROOT?.trim();
  if (fromEnv) candidates.push(resolve(fromEnv));
  // Local layout used on this machine / Web folder.
  candidates.push(resolve(root, '../w3dts/w3dts'));
  // Documented layout (CI / other workstations).
  candidates.push(resolve(root, '../w3dts_repos/w3dts'));

  for (const candidate of candidates) {
    if (packagesReady(candidate)) return candidate;
  }
  return null;
}

const resolvedMono = resolveMonoRoot();

export const W3DTS_MONO_ROOT = resolvedMono ?? resolve(root, '../w3dts/w3dts');

export function isW3dtsMonoAvailable(): boolean {
  return resolvedMono !== null;
}

export function createW3dtsMonoAliases(): Record<string, string> {
  if (!resolvedMono) return {};
  const aliases: Record<string, string> = {};
  for (const [id, entry] of PACKAGES) {
    aliases[id] = resolve(resolvedMono, 'packages', entry);
  }
  return aliases;
}
