/**
 * @file build_lego_palette.mjs
 * @description Parse data/ldraw/ldraw/LDConfig.ldr → colors.json v2 (BRICK-MT1).
 *
 * Usage: node scripts/catalog/build_lego_palette.mjs
 * Notes: LDConfig_TLG.ldr in the complete.zip is a stub (“Content removed”);
 *        display names come from !COLOUR tokens + optional // LEGOID comments.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const LDCONFIG = join(ROOT, 'data/ldraw/ldraw/LDConfig.ldr');
const OUT = join(ROOT, 'src/racer/hub/brick/catalog/data/colors.json');

/** @typedef {'plastic'|'transparent'|'rubber'|'chrome'|'metallic'|'pearl'|'glow'|'glitter'|'satin'|'speckle'} BrickMaterialKind */

/** Legacy Brick-Racer slugs → official LDraw slug (MT1 compat). */
const LEGACY_ALIASES = {
  gray: 'light_bluish_grey',
  lbg: 'light_bluish_grey',
  light_bluish_gray: 'light_bluish_grey',
  dark_gray: 'dark_bluish_grey',
  dbg: 'dark_bluish_grey',
  dark_bluish_gray: 'dark_bluish_grey',
  sand: 'tan',
  terracotta: 'reddish_brown',
  cyan: 'trans_light_blue',
  tlb: 'trans_light_blue',
  clear: 'trans_clear',
};

/** Curated “common” swatches for UI (until MT3 full picker). */
const COMMON_SLUGS = new Set([
  'black',
  'white',
  'light_bluish_grey',
  'dark_bluish_grey',
  'red',
  'yellow',
  'blue',
  'green',
  'lime',
  'tan',
  'reddish_brown',
  'orange',
  'dark_orange',
  'bright_pink',
  'magenta',
  'purple',
  'dark_blue',
  'bright_light_blue',
  'medium_azure',
  'dark_turquoise',
  'bright_green',
  'olive_green',
  'dark_tan',
  'light_nougat',
  'nougat',
  'trans_clear',
  'trans_light_blue',
  'trans_red',
  'trans_yellow',
  'trans_green',
  'trans_orange',
  'trans_black',
  'rubber_black',
  'rubber_yellow',
  'rubber_red',
  'chrome_silver',
  'chrome_gold',
  'metallic_silver',
  'pearl_gold',
  'flat_silver',
  'glow_in_dark_white',
]);

/**
 * @param {string} hex
 * @returns {[number, number, number]}
 */
function hexToRgb01(hex) {
  const h = hex.replace('#', '');
  const n = Number.parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * @param {string} ldrawName
 * @param {{ alpha?: number, luminance?: number, finish: string, glitter?: object, name: string }} meta
 * @returns {BrickMaterialKind}
 */
function finishToMaterial(ldrawName, meta) {
  const { finish, alpha, luminance, glitter } = meta;
  if (finish === 'RUBBER') return 'rubber';
  if (finish === 'CHROME') return 'chrome';
  if (finish === 'METAL' || finish === 'MATTE_METALLIC') return 'metallic';
  if (finish === 'PEARLESCENT') return 'pearl';
  if (finish === 'SPECKLE') return 'speckle';
  if (finish === 'GLITTER') {
    if (/^Opal_/i.test(ldrawName)) return 'satin';
    return 'glitter';
  }
  if (luminance != null && luminance > 0 && !glitter) return 'glow';
  if (alpha != null && alpha < 1) return 'transparent';
  return 'plastic';
}

/**
 * @param {string} text
 */
function parseLdConfig(text) {
  const lines = text.split(/\r?\n/);
  /** @type {Array<Record<string, unknown>>} */
  const colors = [];
  let pendingLegoName = null;

  const colourRe =
    /^0\s+!COLOUR\s+(\S+)\s+CODE\s+(\d+)\s+VALUE\s+(#[0-9A-Fa-f]{6})\s+EDGE\s+(#[0-9A-Fa-f]{6})(.*)$/;
  const legoIdRe = /LEGOID\s+\d+\s*-\s*(.+)\s*$/;

  for (const raw of lines) {
    const line = raw.trimEnd();
    const legoM = line.match(legoIdRe);
    if (legoM && line.includes('//')) {
      pendingLegoName = legoM[1].trim();
      continue;
    }

    const m = line.match(colourRe);
    if (!m) {
      if (!line.includes('LEGOID')) pendingLegoName = null;
      continue;
    }

    const ldrawName = m[1];
    const code = Number(m[2]);
    const valueHex = m[3];
    const rest = m[5] ?? '';

    let alpha;
    const alphaM = rest.match(/\bALPHA\s+(\d+)/);
    if (alphaM) alpha = Number(alphaM[1]) / 255;

    let luminance;
    const lumM = rest.match(/\bLUMINANCE\s+(\d+)/);
    if (lumM) luminance = Number(lumM[1]);

    /** @type {string} */
    let finish = 'SOLID';
    if (/\bRUBBER\b/.test(rest)) finish = 'RUBBER';
    else if (/\bCHROME\b/.test(rest)) finish = 'CHROME';
    else if (/\bMATTE_METALLIC\b/.test(rest)) finish = 'MATTE_METALLIC';
    else if (/\bMETAL\b/.test(rest)) finish = 'METAL';
    else if (/\bPEARLESCENT\b/.test(rest)) finish = 'PEARLESCENT';
    else if (/\bMATERIAL\s+SPECKLE\b/.test(rest)) finish = 'SPECKLE';
    else if (/\bMATERIAL\s+GLITTER\b/.test(rest)) finish = 'GLITTER';

    /** @type {{ rgb: [number, number, number], fraction: number, size: number } | undefined} */
    let glitter;
    const glitterM = rest.match(
      /MATERIAL\s+GLITTER\s+VALUE\s+(#[0-9A-Fa-f]{6})\s+FRACTION\s+([\d.]+)\s+VFRACTION\s+([\d.]+)(?:\s+SIZE\s+([\d.]+))?(?:\s+MINSIZE\s+([\d.]+)\s+MAXSIZE\s+([\d.]+))?/
    );
    const speckleM = rest.match(
      /MATERIAL\s+SPECKLE\s+VALUE\s+(#[0-9A-Fa-f]{6})\s+FRACTION\s+([\d.]+)\s+VFRACTION\s+([\d.]+)(?:\s+SIZE\s+([\d.]+))?(?:\s+MINSIZE\s+([\d.]+)\s+MAXSIZE\s+([\d.]+))?/
    );
    const matM = glitterM ?? speckleM;
    if (matM) {
      const size =
        matM[4] != null
          ? Number(matM[4])
          : matM[5] != null && matM[6] != null
            ? (Number(matM[5]) + Number(matM[6])) / 2
            : 1;
      glitter = {
        rgb: hexToRgb01(matM[1]),
        fraction: Number(matM[2]),
        size,
      };
    }

    const id = ldrawName.toLowerCase();
    const material = finishToMaterial(ldrawName, {
      finish,
      alpha,
      luminance,
      glitter,
      name: ldrawName,
    });
    const name = pendingLegoName ?? ldrawName.replace(/_/g, ' ');
    pendingLegoName = null;

    const translucent =
      material === 'transparent' ||
      material === 'glitter' ||
      material === 'satin' ||
      (alpha != null && alpha < 0.98);

    /** @type {Record<string, unknown>} */
    const entry = {
      id,
      ldrawCode: code,
      name,
      rgb: hexToRgb01(valueHex).map((x) => Math.round(x * 1000) / 1000),
      material,
    };
    if (alpha != null) entry.alpha = Math.round(alpha * 1000) / 1000;
    if (luminance != null) entry.luminance = luminance;
    if (glitter) {
      entry.glitter = {
        rgb: glitter.rgb.map((x) => Math.round(x * 1000) / 1000),
        fraction: glitter.fraction,
        size: glitter.size,
      };
    }
    if (translucent) entry.translucent = true;
    if (COMMON_SLUGS.has(id)) entry.common = true;

    colors.push(entry);
  }

  return colors;
}

function attachLegacyAliases(colors) {
  /** @type {Map<string, string[]>} */
  const byTarget = new Map();
  for (const [alias, target] of Object.entries(LEGACY_ALIASES)) {
    if (alias === target) continue;
    const list = byTarget.get(target) ?? [];
    list.push(alias);
    byTarget.set(target, list);
  }

  const ids = new Set(colors.map((c) => c.id));
  for (const [target, aliases] of byTarget) {
    if (!ids.has(target)) {
      console.warn(`[palette] legacy target missing: ${target} ← ${aliases.join(', ')}`);
      continue;
    }
    const color = colors.find((c) => c.id === target);
    const existing = new Set(color.aliases ?? []);
    for (const a of aliases) {
      if (ids.has(a) && a !== target) {
        console.warn(`[palette] alias '${a}' collides with canonical id — skip`);
        continue;
      }
      existing.add(a);
    }
    color.aliases = [...existing].sort();
    color.common = true;
  }
}

function main() {
  if (!existsSync(LDCONFIG)) {
    console.error(`Missing ${LDCONFIG} — unpack data/ldraw/complete.zip first.`);
    process.exit(1);
  }
  const text = readFileSync(LDCONFIG, 'utf8');
  const colors = parseLdConfig(text);
  if (colors.length < 100) {
    console.error(`Parsed only ${colors.length} colours — abort.`);
    process.exit(1);
  }
  attachLegacyAliases(colors);
  colors.sort((a, b) => a.ldrawCode - b.ldrawCode || a.id.localeCompare(b.id));

  const byMaterial = {};
  for (const c of colors) {
    byMaterial[c.material] = (byMaterial[c.material] ?? 0) + 1;
  }

  const payload = {
    version: 2,
    source: 'LDConfig.ldr',
    colors,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${colors.length} colours → ${OUT}`);
  console.log('By material:', byMaterial);
  console.log(
    'Legacy:',
    Object.entries(LEGACY_ALIASES)
      .map(([a, t]) => `${a}→${t}`)
      .join(', ')
  );
}

main();
