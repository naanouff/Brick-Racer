/**
 * @file smoke.test.ts
 * @project brick-racer
 * @description Minimal package smoke checks.
 */

import { readFileSync } from 'node:fs';
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
});
