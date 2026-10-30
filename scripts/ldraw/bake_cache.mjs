/**
 * @file bake_cache.mjs
 * @description Pre-warm data/ldraw-cache for Bolt + fountain LDraw parts (CL5d).
 * Loads the TS sources through Vite SSR (extensionless imports, no extra runner).
 * Usage: pnpm ldraw:bake
 */

import { createServer } from 'vite';

const server = await createServer({
  configFile: false,
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false },
});

try {
  const { runLdrawBake } = await server.ssrLoadModule('/scripts/ldraw/bakeJobs.ts');
  const fail = await runLdrawBake();
  if (fail > 0) process.exitCode = 1;
} finally {
  await server.close();
}
