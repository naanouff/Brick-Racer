/**
 * @file smoke.test.ts
 * @project brick-racer
 * @description Minimal package smoke checks.
 */

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('brick-racer smoke', () => {
  it('ships version 0.1.0 as brick-racer', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      name: string;
      version: string;
      build: { appId: string; productName: string };
    };
    expect(pkg.name).toBe('brick-racer');
    expect(pkg.version).toBe('0.1.0');
    expect(pkg.build.appId).toBe('com.naanouff.brickracer');
    expect(pkg.build.productName).toBe('Brick Racer');
  });

  it('exports startBrickRacerHost from the host module', async () => {
    const host = await import('../src/racer/host/startBrickRacerHost');
    expect(typeof host.startBrickRacerHost).toBe('function');
  });

  it('ships sandbox kart level module + runtime assets (B2c/B2d)', () => {
    expect(existsSync('src/racer/levels/sandboxKart/sandboxKartSpec.ts')).toBe(true);
    expect(existsSync('src/racer/levels/sandboxKart/spawnSandboxKart.ts')).toBe(true);
    expect(existsSync('public/script-graphs/kart-drive.json')).toBe(true);
    expect(existsSync('public/graphs/BrickRacerFast.json')).toBe(true);
    expect(existsSync('public/graphs/StandardLitGraphKart.json')).toBe(true);
    expect(existsSync('public/shaders/graph_templates/graph_vertex.vert.wgsl')).toBe(true);
    expect(existsSync('public/shader-graphs/RockProceduralPBR.json')).toBe(true);
    expect(existsSync('public/gproc/lego-brick-generator.json')).toBe(true);
  });
});
