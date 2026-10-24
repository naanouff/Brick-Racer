import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { createW3dtsMonoAliases, isW3dtsMonoAvailable, W3DTS_MONO_ROOT } from './w3dtsMonoAliases';

const monoAliases = isW3dtsMonoAvailable() ? createW3dtsMonoAliases() : {};
const fsAllow = [resolve('.')];
if (isW3dtsMonoAvailable()) {
  fsAllow.push(W3DTS_MONO_ROOT);
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
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
