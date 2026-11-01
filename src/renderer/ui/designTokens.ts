/**
 * @file designTokens.ts
 * @description Canon machine des tokens UI — docs/design/ui-ux.md §2.
 * Les CSS (`docs/mocup/css/tokens.css`, `atelier.css`) doivent rester alignés.
 */

/** Couleurs §2 (hex canon uppercase, comparaison en lower). */
export const BR_COLOR_TOKENS = {
  'plaza-pastel': '#F7B8C9',
  'garage-oil': '#E87A3A',
  'beach-mint': '#5ECFBF',
  'billboard-magenta': '#D946A8',
  'stud-yellow': '#F5C518',
  ink: '#1A1520',
  paper: '#FFF6EC',
  asphalt: '#2B3040',
  danger: '#E23D3D',
  safe: '#3BB273',
} as const;

export type BrColorToken = keyof typeof BR_COLOR_TOKENS;

/** Tokens non-couleur exigés par la bible écrans / mocup. */
export const BR_LAYOUT_TOKENS = {
  scrim: 'rgb(26 21 32 / 55%)',
  'scrim-heavy': 'rgb(26 21 32 / 72%)',
  radius: '6px',
  border: '4px',
  'hud-margin': '48px',
} as const;

export const BR_FONT_TOKENS = {
  display: 'Fredoka',
  body: 'Nunito Sans',
} as const;

/** Écrans joueur (`data-screen`) — UIM1 / ui-ux §3. */
export const MOCUP_PLAYER_SCREENS = [
  'title',
  'loading',
  'hub',
  'garage',
  'shop',
  'countdown',
  'race-hud',
  'pause',
  'results',
  'settings',
] as const;

/** Microcopy pool v1 (sous-chaînes stables). */
export const MOCUP_MICROCOPY_SNIPPETS = [
  'Tu n’es personne. Encore.',
  'Chargement de ta médiocrité',
  'On jugera ton build',
  'Pas de glory',
  'Même la médiocrité a droit à un break',
] as const;

/** Palettes / motifs refusés (ui-ux anti-patterns). */
export const UI_ANTIPATTERN_HEX = [
  '#7c3aed',
  '#8b5cf6',
  '#a78bfa',
  '#6366f1',
  '#4f46e5',
  '#7e22ce',
] as const;
