/**
 * @file colorNearest.ts
 * @description Map set / LDraw / BL color names → brick-lab editor slugs (CF3a).
 */

/** Editor brush colors used by brick-lab MCP / materials. */
export const EDITOR_COLOR_SLUGS = [
  'white',
  'black',
  'yellow',
  'red',
  'green',
  'lime',
  'sand',
  'gray',
  'dark_gray',
  'terracotta',
  'cyan',
  'clear',
] as const;

export type EditorColorSlug = (typeof EDITOR_COLOR_SLUGS)[number];

const EXACT: Record<string, EditorColorSlug> = {
  white: 'white',
  black: 'black',
  yellow: 'yellow',
  red: 'red',
  green: 'green',
  lime: 'lime',
  sand: 'sand',
  tan: 'sand',
  gray: 'gray',
  grey: 'gray',
  light_bluish_gray: 'gray',
  lightbluishgray: 'gray',
  dark_gray: 'dark_gray',
  dark_grey: 'dark_gray',
  dark_bluish_gray: 'dark_gray',
  darkbluishgray: 'dark_gray',
  terracotta: 'terracotta',
  dark_orange: 'terracotta',
  darkorange: 'terracotta',
  reddish_brown: 'terracotta',
  brown: 'terracotta',
  cyan: 'cyan',
  trans_light_blue: 'cyan',
  translightblue: 'cyan',
  light_blue: 'cyan',
  clear: 'clear',
  trans_clear: 'clear',
  translucent: 'clear',
  transparent: 'clear',
};

/**
 * Nearest brick-lab color slug for a free-form color name / id.
 * Unknown → `gray` (safe default for structure).
 */
export function nearestEditorColor(raw: string): EditorColorSlug {
  const key = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  if (EXACT[key]) return EXACT[key]!;
  if (key.includes('trans') && (key.includes('blue') || key.includes('azure'))) return 'cyan';
  if (key.includes('trans') || key.includes('clear')) return 'clear';
  if (key.includes('orange') || key.includes('nougat') || key.includes('brown')) {
    return 'terracotta';
  }
  if (key.includes('tan') || key.includes('beige') || key.includes('sand')) return 'sand';
  if (key.includes('dark') && key.includes('gray')) return 'dark_gray';
  if (key.includes('dark') && key.includes('grey')) return 'dark_gray';
  if (key.includes('lime') || key.includes('bright_green')) return 'lime';
  if (key.includes('green')) return 'green';
  if (key.includes('yellow')) return 'yellow';
  if (key.includes('red')) return 'red';
  if (key.includes('white')) return 'white';
  if (key.includes('black')) return 'black';
  if (key.includes('gray') || key.includes('grey')) return 'gray';
  return 'gray';
}

/** Hints for set 10359 Fountain Garden (Icons Botanical palette). */
export const SET_10359_COLOR_HINTS: { from: string; to: EditorColorSlug; note: string }[] = [
  { from: 'White', to: 'white', note: 'stone / arches' },
  { from: 'Tan', to: 'sand', note: 'paths / coping' },
  { from: 'Dark Orange', to: 'terracotta', note: 'zellij accents' },
  { from: 'Light Bluish Gray', to: 'gray', note: 'fountain metal / dishes' },
  { from: 'Dark Bluish Gray', to: 'dark_gray', note: 'accents' },
  { from: 'Black', to: 'black', note: 'round pillars 3941' },
  { from: 'Green', to: 'green', note: 'foliage' },
  { from: 'Trans-Light Blue', to: 'cyan', note: 'water' },
  { from: 'Trans-Clear', to: 'clear', note: 'cascades' },
  { from: 'Red', to: 'red', note: 'flowers' },
  { from: 'Bright Light Yellow', to: 'yellow', note: 'flowers' },
];
