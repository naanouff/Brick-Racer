/**
 * @file assemblySchema.ts
 * @description Multi-module brick assembly (DC4) — compose *.layers.json with stud offsets.
 */

import type { ManualValidationIssue } from './manualSchema';

export type AssemblyModule = {
  /** Optional label for step titles. */
  id?: string;
  /** Path relative to the assembly file, or basename under layers/. */
  file: string;
  /** Offset [sx, py, sz] in studs / plates. Default [0,0,0]. */
  offset?: [number, number, number];
};

export type BrickAssembly = {
  id: string;
  version?: number;
  title?: string;
  modules: AssemblyModule[];
};

export type AssemblyValidationResult =
  | { ok: true; assembly: BrickAssembly }
  | { ok: false; issues: ManualValidationIssue[] };

function isInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && Number.isInteger(n);
}

function pushIssue(issues: ManualValidationIssue[], path: string, message: string): void {
  issues.push({ path, message });
}

export function validateAssembly(raw: unknown): AssemblyValidationResult {
  const issues: ManualValidationIssue[] = [];
  if (!raw || typeof raw !== 'object') {
    return { ok: false, issues: [{ path: '', message: 'assembly must be an object' }] };
  }
  const m = raw as Record<string, unknown>;
  if (typeof m.id !== 'string' || !m.id) pushIssue(issues, 'id', 'id required');
  if (m.version !== undefined && (!isInt(m.version) || m.version < 1)) {
    pushIssue(issues, 'version', 'version >= 1 integer');
  }
  if (!Array.isArray(m.modules) || m.modules.length === 0) {
    pushIssue(issues, 'modules', 'at least one module');
  } else {
    m.modules.forEach((mod, i) => {
      const p = `modules[${i}]`;
      if (!mod || typeof mod !== 'object') {
        pushIssue(issues, p, 'module must be object');
        return;
      }
      const o = mod as Record<string, unknown>;
      if (typeof o.file !== 'string' || !o.file) {
        pushIssue(issues, `${p}.file`, 'file path required');
      }
      if (o.id !== undefined && typeof o.id !== 'string') {
        pushIssue(issues, `${p}.id`, 'id must be string');
      }
      if (o.offset !== undefined) {
        if (!Array.isArray(o.offset) || o.offset.length !== 3 || !o.offset.every(isInt)) {
          pushIssue(issues, `${p}.offset`, 'offset must be [sx,py,sz] integers');
        }
      }
    });
  }
  if (issues.length) return { ok: false, issues };
  return {
    ok: true,
    assembly: {
      id: m.id as string,
      version: typeof m.version === 'number' ? m.version : 1,
      title: typeof m.title === 'string' ? m.title : undefined,
      modules: m.modules as AssemblyModule[],
    },
  };
}

export function formatAssemblyIssues(issues: ManualValidationIssue[]): string {
  return issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join('\n');
}
