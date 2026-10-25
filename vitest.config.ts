import { defineConfig } from 'vitest/config';
import { createW3dtsMonoAliases, isW3dtsMonoAvailable } from './w3dtsMonoAliases';

export default defineConfig({
  resolve: {
    alias: isW3dtsMonoAvailable() ? createW3dtsMonoAliases() : {},
    dedupe: [
      '@naanouff/w3dts-core',
      '@naanouff/w3dts-logger',
      '@naanouff/w3dts-input',
      'gl-matrix',
    ],
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
