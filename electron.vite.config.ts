import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { createW3dtsMonoAliases, isW3dtsMonoAvailable, W3DTS_MONO_ROOT } from './w3dtsMonoAliases';

const monoOk = isW3dtsMonoAvailable();
const monoAliases = monoOk ? createW3dtsMonoAliases() : {};
if (!monoOk) {
  console.warn(
    '[brick-racer] w3dts monorepo not found — @naanouff/w3dts-scripts (and gproc/physics/input mono overrides) will fail to resolve. Set W3DTS_MONO_ROOT or checkout ../w3dts/w3dts (see docs/build.md).'
  );
}
const fsAllow = [resolve('.')];
if (monoOk) {
  fsAllow.push(W3DTS_MONO_ROOT);
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          ldrawBakeWorker: resolve('src/main/ldrawBakeWorker.ts'),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: 'index.js',
        },
      },
    },
  },
  renderer: {
    root: resolve('src/renderer'),
    publicDir: resolve('public'),
    plugins: [react()],
    resolve: {
      alias: monoAliases,
      // World stores components by class identity: one copy of each engine package or
      // components added by gproc/physics/scripts are invisible to the renderer.
      dedupe: [
        '@naanouff/w3dts-core',
        '@naanouff/w3dts-logger',
        '@naanouff/w3dts-physics',
        '@naanouff/w3dts-input',
        'gl-matrix',
      ],
    },
    optimizeDeps: {
      // Keep mono aliases (scripts / gproc / physics / input) out of the prebundle.
      exclude: [
        '@naanouff/w3dts-scripts',
        '@naanouff/w3dts-gproc',
        '@naanouff/w3dts-physics',
        '@naanouff/w3dts-input',
      ],
    },
    server: {
      fs: {
        allow: fsAllow,
      },
      watch: {
        ignored: ['**/tmp/**'],
      },
    },
  },
});
