/**
 * @file gitignoreCatalogAssets.test.ts
 * @description Contract: LEGO notice PDFs and catalog thumb PNGs stay out of git.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const GITIGNORE = join(ROOT, '.gitignore');

describe('gitignore catalog / notice assets', () => {
  it('ignores LEGO notice PDFs and catalog thumb PNGs', () => {
    const text = readFileSync(GITIGNORE, 'utf8');
    expect(text).toMatch(/docs\/notices\/\*\*\/\*\.pdf/);
    expect(text).toMatch(/public\/catalog\/thumbs\/\*\.png/);
  });
});
