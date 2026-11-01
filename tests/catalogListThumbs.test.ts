/**
 * @file catalogListThumbs.test.ts
 * @description Non-régression : miniatures aussi en mode liste catalogue.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const PANEL = join(ROOT, 'src', 'renderer', 'catalog', 'CatalogBrowserPanel.tsx');
const CSS = join(ROOT, 'src', 'renderer', 'app.css');

describe('catalog list thumbs', () => {
  it('list rows render the same /catalog/thumbs PNG as the grid', () => {
    const src = readFileSync(PANEL, 'utf8');
    expect(src).toMatch(/const ROW_H = (\d+)/);
    const rowH = Number(/const ROW_H = (\d+)/.exec(src)![1]);
    expect(rowH).toBeGreaterThanOrEqual(36);

    // List branch (after grid) must include row thumb markup, not only grid cells.
    const listStart = src.indexOf("className=\"br-catalog__list\"");
    expect(listStart).toBeGreaterThan(0);
    const listBlock = src.slice(listStart, listStart + 2500);
    expect(listBlock).toContain('br-catalog__row-thumb');
    expect(listBlock).toMatch(/\/catalog\/thumbs\/\$\{lid\}\.png/);
    expect(listBlock).toContain('reportMissingThumb');
  });

  it('styles the list thumb slot', () => {
    const css = readFileSync(CSS, 'utf8');
    expect(css).toMatch(/\.br-catalog__row-thumb\s*\{/);
    expect(css).toMatch(/object-fit:\s*contain/);
  });
});
