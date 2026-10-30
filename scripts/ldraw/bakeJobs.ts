/**
 * @file bakeJobs.ts
 * @description LDraw parts to pre-bake (Bolt recipe + fountain), run sequentially.
 */

import { ldrawPartMesh } from '../../src/main/ldrawBakeCache';
import { fountainLdrawIds } from '../../src/racer/hub/brick/landmark/fountainLdraw';
import type { LdrawMeshAnchor } from '../../src/racer/hub/brick/ldraw/ldrawGeometry';
import { collectRecipeLdrawIds } from '../../src/racer/minifig/catalog';
import { BOLT_RECIPE } from '../../src/racer/minifig/recipes/c01-bolt';

type Job = { id: string; anchor: LdrawMeshAnchor };

export function ldrawBakeJobs(): Job[] {
  const unique = new Map<string, Job>();
  const add = (id: string, anchor: LdrawMeshAnchor): void => {
    unique.set(`${anchor}:${id}`, { id, anchor });
  };
  for (const id of collectRecipeLdrawIds(BOLT_RECIPE)) add(id, 'origin');
  for (const id of fountainLdrawIds()) add(id, 'origin');
  return [...unique.values()].sort((a, b) =>
    a.anchor === b.anchor ? a.id.localeCompare(b.id) : a.anchor.localeCompare(b.anchor)
  );
}

/** Returns the number of failed parts. */
export async function runLdrawBake(): Promise<number> {
  const jobs = ldrawBakeJobs();
  console.log(`[ldraw:bake] ${jobs.length} part(s)…`);
  let fail = 0;
  for (const job of jobs) {
    const t0 = performance.now();
    const res = await ldrawPartMesh(job.id, job.anchor);
    const ms = Math.round(performance.now() - t0);
    if (res.ok) {
      console.log(`  ok   ${job.anchor}/${job.id}  ${res.mesh.triangleCount} tri  ${ms} ms`);
    } else {
      fail++;
      console.warn(`  fail ${job.anchor}/${job.id}: ${res.error}`);
    }
  }
  console.log(`[ldraw:bake] done · ${jobs.length - fail} ok · ${fail} fail`);
  return fail;
}
