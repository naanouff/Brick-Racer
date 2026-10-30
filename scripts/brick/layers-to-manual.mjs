/**
 * @file layers-to-manual.mjs
 * @description Convert *.layers.json → manuals/<stem>.manual.json (DC1d).
 * Usage: pnpm brick:layers [path.layers.json]
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const defaultLayers = join(root, 'src/racer/hub/brick/layers/fountain.layers.json');
const manualsDir = join(root, 'src/racer/hub/brick/manuals');

const inputPath = resolve(process.argv[2] ?? defaultLayers);

const server = await createServer({
  configFile: false,
  appType: 'custom',
  logLevel: 'error',
  root,
  server: { middlewareMode: true, hmr: false },
});

try {
  const { brickifyLayers } = await server.ssrLoadModule(
    '/src/racer/hub/brick/manual/brickifyLayers.ts'
  );
  const raw = JSON.parse(await readFile(inputPath, 'utf8'));
  const manual = brickifyLayers(raw);
  const stem =
    typeof manual.id === 'string' && manual.id.startsWith('landmark.')
      ? manual.id.slice('landmark.'.length)
      : basename(inputPath).replace(/\.layers\.json$/i, '');
  await mkdir(manualsDir, { recursive: true });
  const outPath = join(manualsDir, `${stem}.manual.json`);
  await writeFile(outPath, `${JSON.stringify(manual, null, 2)}\n`, 'utf8');
  console.log(`[brick:layers] ${inputPath} → ${outPath} (${manual.steps.length} steps)`);
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await server.close();
}
