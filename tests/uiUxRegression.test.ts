/**
 * @file uiUxRegression.test.ts
 * @description Garde-fous UI/UX : tokens, maquettes UIM1/UIM2, Atelier React.
 * Canon : docs/design/ui-ux.md · docs/mocup/ · src/renderer/ui/designTokens.ts
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BR_COLOR_TOKENS,
  BR_FONT_TOKENS,
  BR_LAYOUT_TOKENS,
  MOCUP_MICROCOPY_SNIPPETS,
  MOCUP_PLAYER_SCREENS,
  UI_ANTIPATTERN_HEX,
} from '../src/renderer/ui/designTokens';
import {
  LEVEL_IDS,
  levelAccent,
  levelGroup,
} from '../src/racer/levels/registry';

const ROOT = process.cwd();
const MOCUP = join(ROOT, 'docs', 'mocup');
const TOKENS_CSS = join(MOCUP, 'css', 'tokens.css');
const ATELIER_CSS = join(ROOT, 'src', 'renderer', 'atelier', 'atelier.css');
const INDEX_HTML = join(MOCUP, 'index.html');
const ATELIER_HTML = join(MOCUP, 'atelier.html');
const UI_UX_MD = join(ROOT, 'docs', 'design', 'ui-ux.md');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

/** Parse `--name: value;` declarations (first wins). */
function parseCssCustomProps(css: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    const name = m[1].toLowerCase();
    if (!out.has(name)) out.set(name, m[2].trim());
  }
  return out;
}

function normalizeHex(value: string): string | null {
  const v = value.trim().toLowerCase();
  const short = /^#([0-9a-f]{3})$/i.exec(v);
  if (short) {
    const [r, g, b] = short[1];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  const full = /^#([0-9a-f]{6})$/i.exec(v);
  return full ? `#${full[1]}` : null;
}

function normalizeSpaceRgb(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function extractSection(html: string, screen: string): string {
  const re = new RegExp(
    `<section[^>]*data-screen="${screen}"[^>]*>([\\s\\S]*?)</section>`,
    'i',
  );
  const m = re.exec(html);
  expect(m, `section data-screen="${screen}"`).toBeTruthy();
  return m![1];
}

describe('UI/UX design tokens (canon)', () => {
  it('ui-ux.md §2 still lists every color token hex', () => {
    const md = read(UI_UX_MD);
    for (const [key, hex] of Object.entries(BR_COLOR_TOKENS)) {
      const token = `--br-${key}`;
      expect(md, token).toMatch(new RegExp(token.replace(/-/g, '\\-')));
      expect(md.toLowerCase(), `${token} hex`).toContain(hex.toLowerCase());
    }
  });

  it('mocup tokens.css matches canon colors + layout', () => {
    const props = parseCssCustomProps(read(TOKENS_CSS));
    for (const [key, hex] of Object.entries(BR_COLOR_TOKENS)) {
      const got = props.get(`br-${key}`);
      expect(got, `--br-${key}`).toBeTruthy();
      expect(normalizeHex(got!), `--br-${key}`).toBe(hex.toLowerCase());
    }
    for (const [key, expected] of Object.entries(BR_LAYOUT_TOKENS)) {
      const got = props.get(`br-${key}`);
      expect(got, `--br-${key}`).toBeTruthy();
      if (key.startsWith('scrim')) {
        expect(normalizeSpaceRgb(got!)).toBe(normalizeSpaceRgb(expected));
      } else {
        expect(got!.toLowerCase()).toBe(expected.toLowerCase());
      }
    }
    const display = props.get('br-font-display') ?? '';
    const body = props.get('br-font-body') ?? '';
    expect(display).toContain(BR_FONT_TOKENS.display);
    expect(body).toContain(BR_FONT_TOKENS.body);
  });

  it('atelier.css keeps color + layout token parity with mocup', () => {
    const mocup = parseCssCustomProps(read(TOKENS_CSS));
    const atelier = parseCssCustomProps(read(ATELIER_CSS));
    for (const key of Object.keys(BR_COLOR_TOKENS)) {
      const name = `br-${key}`;
      expect(atelier.has(name), `--${name} missing in atelier.css`).toBe(true);
      expect(normalizeHex(atelier.get(name)!)).toBe(normalizeHex(mocup.get(name)!));
    }
    for (const key of Object.keys(BR_LAYOUT_TOKENS)) {
      const name = `br-${key}`;
      expect(atelier.has(name), `--${name} missing in atelier.css`).toBe(true);
      const a = atelier.get(name)!;
      const m = mocup.get(name)!;
      if (key.startsWith('scrim')) {
        expect(normalizeSpaceRgb(a)).toBe(normalizeSpaceRgb(m));
      } else {
        expect(a.toLowerCase()).toBe(m.toLowerCase());
      }
    }
    const display = atelier.get('br-font-display') ?? '';
    const body = atelier.get('br-font-body') ?? '';
    expect(display).toContain(BR_FONT_TOKENS.display);
    expect(body).toContain(BR_FONT_TOKENS.body);
  });
});

describe('UI/UX mocup player screens (UIM1)', () => {
  it('ships index + redirect screens + assets', () => {
    expect(existsSync(INDEX_HTML)).toBe(true);
    expect(existsSync(join(MOCUP, 'css', 'base.css'))).toBe(true);
    expect(existsSync(join(MOCUP, 'css', 'screens.css'))).toBe(true);
    expect(existsSync(join(MOCUP, 'js', 'nav.js'))).toBe(true);
    expect(existsSync(join(MOCUP, 'assets', 'logo.svg'))).toBe(true);
    for (const screen of MOCUP_PLAYER_SCREENS) {
      const redirect = join(MOCUP, 'screens', `${screen}.html`);
      expect(existsSync(redirect), redirect).toBe(true);
      expect(read(redirect)).toContain(`#${screen}`);
    }
  });

  it('index.html exposes every player data-screen', () => {
    const html = read(INDEX_HTML);
    for (const screen of MOCUP_PLAYER_SCREENS) {
      expect(html).toMatch(
        new RegExp(`data-screen="${screen}"`, 'i'),
      );
    }
  });

  it('keeps microcopy pool + critical CTAs', () => {
    const html = read(INDEX_HTML);
    for (const snippet of MOCUP_MICROCOPY_SNIPPETS) {
      expect(html, snippet).toContain(snippet);
    }
    const title = extractSection(html, 'title');
    expect(title).toMatch(/Jouer/i);
    expect(title).toMatch(/Param[eè]tres/i);
    expect(title).toMatch(/pas affilié/i);

    const garage = extractSection(html, 'garage');
    expect(garage).toMatch(/Équiper|Equiper/i);
    expect(garage).toMatch(/Sortir/i);
    expect(garage).toMatch(/btn--oil/);

    const shop = extractSection(html, 'shop');
    expect(shop).toMatch(/Équiper|Acheter|Equiper/i);
    expect(shop).toMatch(/btn--magenta|plaque--magenta/);

    const pause = extractSection(html, 'pause');
    expect(pause).toMatch(/Reprendre/i);
    expect(pause).toMatch(/Recommencer/i);
    expect(pause).toMatch(/Quitter/i);

    const results = extractSection(html, 'results');
    expect(results).toMatch(/RETOUR HUB|Retour hub/i);
  });

  it('race HUD has position/tour/timer/item and forbids speed + minimap', () => {
    const hud = extractSection(read(INDEX_HTML), 'race-hud');
    expect(hud).toMatch(/P\d\/\d/i);
    expect(hud).toMatch(/Tour\s+\d\/\d/i);
    expect(hud).toMatch(/\d{2}:\d{2}/);
    expect(hud).toMatch(/ITEM/i);
    expect(hud).not.toMatch(/minimap/i);
    expect(hud).not.toMatch(/\bkm\/h\b/i);
    expect(hud).not.toMatch(/\bvitesse\b/i);
    expect(hud).not.toMatch(/\bRPM\b/);
  });

  it('nav.js lists the same screens and Esc map for overlays', () => {
    const nav = read(join(MOCUP, 'js', 'nav.js'));
    for (const screen of MOCUP_PLAYER_SCREENS) {
      expect(nav).toContain(`"${screen}"`);
    }
    expect(nav).toMatch(/garage:\s*"hub"/);
    expect(nav).toMatch(/shop:\s*"hub"/);
    expect(nav).toMatch(/"race-hud":\s*"pause"/);
    expect(nav).toMatch(/pause:\s*"race-hud"/);
  });
});

describe('UI/UX atelier (UIM2 + React port)', () => {
  it('ships atelier.html linked from index and using shared tokens.css', () => {
    expect(existsSync(ATELIER_HTML)).toBe(true);
    const atelier = read(ATELIER_HTML);
    expect(atelier).toContain('css/tokens.css');
    expect(atelier).toMatch(/pas affilié/i);
    const index = read(INDEX_HTML);
    expect(index).toMatch(/atelier\.html/);
  });

  it('atelier mock + registry expose the six slices with token accents', () => {
    expect([...LEVEL_IDS]).toEqual([
      'race-test',
      'city-test',
      'sandbox-kart',
      'brick-lab',
      'catalog-lab',
      'minifig-lab',
    ]);
    expect(levelGroup('race-test')).toBe('pistes');
    expect(levelGroup('brick-lab')).toBe('labs');
    expect(levelAccent('race-test')).toBe('var(--br-stud-yellow)');
    expect(levelAccent('city-test')).toBe('var(--br-beach-mint)');
    expect(levelAccent('sandbox-kart')).toBe('var(--br-plaza-pastel)');
    expect(levelAccent('brick-lab')).toBe('var(--br-garage-oil)');
    expect(levelAccent('catalog-lab')).toBe('var(--br-garage-oil)');
    expect(levelAccent('minifig-lab')).toBe('var(--br-billboard-magenta)');

    const html = read(ATELIER_HTML);
    for (const id of LEVEL_IDS) {
      expect(html).toContain(id);
    }
  });

  it('AtelierShell stays the React port of the atelier shell', () => {
    const shell = join(ROOT, 'src', 'renderer', 'atelier', 'AtelierShell.tsx');
    expect(existsSync(shell)).toBe(true);
    const src = read(shell);
    expect(src).toContain("import './atelier.css'");
    expect(src).toContain('LEVEL_IDS');
    expect(src).toMatch(/br-atelier/);
  });

  it('brick-lab does not lock the rail to collapsed width (expanded state works)', () => {
    const css = read(ATELIER_CSS);
    // Forced --rail-w: 56px on .is-brick-lab alone made « PIST… / LABS… » with no expand.
    // Match only the dedicated rule (not `.is-catalog, .is-brick-lab`).
    const brickLabOnly = [
      ...css.matchAll(/(?:^|\n)\.br-atelier\.is-brick-lab\s*\{([^}]*)\}/g),
    ].map((m) => m[1]);
    expect(brickLabOnly.some((b) => /--menubar-h/.test(b))).toBe(true);
    for (const block of brickLabOnly) {
      expect(block).not.toMatch(/--rail-w\s*:\s*56px/);
    }
    expect(css).toMatch(
      /\.br-atelier\.is-rail-collapsed\s*\{[^}]*--rail-w\s*:\s*56px/,
    );
  });
});

describe('UI/UX anti-patterns', () => {
  const cssRoots = [
    TOKENS_CSS,
    join(MOCUP, 'css', 'base.css'),
    join(MOCUP, 'css', 'screens.css'),
    ATELIER_CSS,
    ATELIER_HTML,
  ];

  it('rejects purple / indigo SaaS palette in mocup + atelier CSS', () => {
    for (const file of cssRoots) {
      const text = read(file).toLowerCase();
      for (const hex of UI_ANTIPATTERN_HEX) {
        expect(text.includes(hex), `${file} contains ${hex}`).toBe(false);
      }
    }
  });

  it('rejects glassmorphism violet / heavy glow language in player CSS', () => {
    const playerCss = [
      read(join(MOCUP, 'css', 'base.css')),
      read(join(MOCUP, 'css', 'screens.css')),
    ].join('\n');
    expect(playerCss).not.toMatch(/backdrop-filter\s*:\s*blur\([^)]{4,}\)/i);
    expect(playerCss).not.toMatch(/box-shadow\s*:[^;]*0\s+0\s+\d{2,}px[^;]*#(?:7c3aed|8b5cf6|a78bfa)/i);
  });

  it('does not hardcode antipattern hex in renderer TSX', () => {
    const rendererDir = join(ROOT, 'src', 'renderer');
    const files = readdirSync(rendererDir, { recursive: true })
      .map(String)
      .filter((f) => f.endsWith('.tsx') || f.endsWith('.css'));
    for (const rel of files) {
      const text = read(join(rendererDir, rel)).toLowerCase();
      for (const hex of UI_ANTIPATTERN_HEX) {
        expect(text.includes(hex), `${rel} contains ${hex}`).toBe(false);
      }
    }
  });
});
