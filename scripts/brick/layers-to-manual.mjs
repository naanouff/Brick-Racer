/**
 * @file layers-to-manual.mjs
 * @description Convert *.layers.json or *.assembly.json → manuals/<stem>.manual.json.
 * Usage: pnpm brick:layers [path.layers.json|path.assembly.json]
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const layersDir = join(root, 'src/racer/hub/brick/layers');
const defaultLayers = join(layersDir, 'fountain.layers.json');
const manualsDir = join(root, 'src/racer/hub/brick/manuals');

const inputPath = resolve(process.argv[2] ?? defaultLayers);
const isAssembly = /\.assembly\.json$/i.test(inputPath);

const server = await createServer({
  configFile: false,
  appType: 'custom',
  logLevel: 'error',
  root,
  server: { middlewareMode: true, hmr: false },
});

try {
  const raw = JSON.parse(await readFile(inputPath, 'utf8'));
  let manual;
  if (isAssembly) {
    const { brickifyAssembly } = await server.ssrLoadModule(
      '/src/racer/hub/brick/manual/brickifyAssembly.ts'
    );
    const baseDir = dirname(inputPath);
    manual = brickifyAssembly(raw, (file) => {
      const abs = resolve(baseDir, file);
      return JSON.parse(readFileSync(abs, 'utf8'));
    });
  } else {
    const { brickifyLayers } = await server.ssrLoadModule(
      '/src/racer/hub/brick/manual/brickifyLayers.ts'
    );
    manual = brickifyLayers(raw);
  }

  const stem =
    typeof manual.id === 'string' && manual.id.startsWith('landmark.')
      ? manual.id.slice('landmark.'.length)
      : basename(inputPath).replace(/\.(layers|assembly)\.json$/i, '');
  await mkdir(manualsDir, { recursive: true });
  const outPath = join(manualsDir, `${stem}.manual.json`);
  await writeFile(outPath, `${JSON.stringify(manual, null, 2)}\n`, 'utf8');
  console.log(
    `[brick:layers] ${inputPath} → ${outPath} (${manual.steps.length} steps${isAssembly ? ', assembly' : ''})`
  );
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await server.close();
}
