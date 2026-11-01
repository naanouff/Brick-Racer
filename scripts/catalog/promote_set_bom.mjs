#!/usr/bin/env node
/**
 * Promote a Rebrickable set BOM against public/catalog/master-index.json (CF1b).
 *
 * Usage:
 *   pnpm catalog:promote-set -- 10359
 *   pnpm catalog:promote-set -- 10359 --write-parts
 *   pnpm catalog:promote-set -- --ids-file path.txt
 *
 * Downloads Rebrickable sets/inventories/inventory_parts CSVs into data/rebrickable/ if missing.
 */

import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MASTER = path.join(ROOT, 'public/catalog/master-index.json');
const PARTS_JSON = path.join(ROOT, 'src/racer/hub/brick/catalog/data/parts.json');
const RB = path.join(ROOT, 'data/rebrickable');
const BOM_DIR = path.join(ROOT, 'public/catalog/bom');

const CDN = {
  sets: 'https://cdn.rebrickable.com/media/downloads/sets.csv.gz',
  inventories: 'https://cdn.rebrickable.com/media/downloads/inventories.csv.gz',
  inventory_parts: 'https://cdn.rebrickable.com/media/downloads/inventory_parts.csv.gz',
};

const COLOR_HINTS_10359 = [
  { from: 'White', to: 'white', note: 'stone / arches' },
  { from: 'Tan', to: 'sand', note: 'paths / coping' },
  { from: 'Dark Orange', to: 'terracotta', note: 'zellij accents' },
  { from: 'Light Bluish Gray', to: 'gray', note: 'fountain metal / dishes' },
  { from: 'Dark Bluish Gray', to: 'dark_gray', note: 'accents' },
  { from: 'Black', to: 'black', note: 'round pillars' },
  { from: 'Green', to: 'green', note: 'foliage' },
  { from: 'Trans-Light Blue', to: 'cyan', note: 'water' },
  { from: 'Trans-Clear', to: 'clear', note: 'cascades' },
  { from: 'Red', to: 'red', note: 'flowers' },
  { from: 'Bright Light Yellow', to: 'yellow', note: 'flowers' },
];

function parseArgs(argv) {
  const out = { setNum: null, idsFile: null, writeParts: false, forceFetch: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--write-parts') out.writeParts = true;
    else if (a === '--force-fetch') out.forceFetch = true;
    else if (a === '--ids-file') out.idsFile = argv[++i];
    else if (a.startsWith('-')) throw new Error(`unknown flag ${a}`);
    else rest.push(a);
  }
  if (rest[0]) out.setNum = String(rest[0]).replace(/-1$/, '');
  return out;
}

async function downloadGz(url, destCsv) {
  mkdirSync(path.dirname(destCsv), { recursive: true });
  console.log(`Downloading ${url}`);
  const res = await fetch(url, { headers: { 'User-Agent': 'Brick-Racer-catalog-cf/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(destCsv, gunzipSync(buf));
  console.log(`  → ${destCsv}`);
}

async function ensureCsv(name, force) {
  const csv = path.join(RB, `${name}.csv`);
  if (!force && existsSync(csv)) return csv;
  await downloadGz(CDN[name], csv);
  return csv;
}

function parseCsvLine(line) {
  const cols = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') {
      cols.push(cur);
      cur = '';
    } else cur += ch;
  }
  cols.push(cur);
  return cols;
}

async function readCsv(file) {
  const rows = [];
  const rl = createInterface({ input: createReadStream(file, 'utf8'), crlfDelay: Infinity });
  let header = null;
  for await (const line of rl) {
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    if (!header) {
      header = cols;
      continue;
    }
    const obj = {};
    for (let i = 0; i < header.length; i++) obj[header[i]] = cols[i] ?? '';
    rows.push(obj);
  }
  return rows;
}

async function bomIdsForSet(setNum, forceFetch) {
  const setKey = setNum.includes('-') ? setNum : `${setNum}-1`;
  await ensureCsv('sets', forceFetch);
  await ensureCsv('inventories', forceFetch);
  await ensureCsv('inventory_parts', forceFetch);

  const sets = await readCsv(path.join(RB, 'sets.csv'));
  const setRow = sets.find((r) => r.set_num === setKey);
  if (!setRow) throw new Error(`set ${setKey} not found in sets.csv`);

  const inventories = await readCsv(path.join(RB, 'inventories.csv'));
  const inv = inventories.find((r) => r.set_num === setKey && String(r.version) === '1')
    ?? inventories.find((r) => r.set_num === setKey);
  if (!inv) throw new Error(`no inventory for ${setKey}`);

  const invId = String(inv.id);
  const parts = await readCsv(path.join(RB, 'inventory_parts.csv'));
  const ids = new Set();
  for (const row of parts) {
    if (String(row.inventory_id) === invId && row.part_num) ids.add(row.part_num);
  }
  return { setKey, ids: [...ids].sort() };
}

function guessCategory(name) {
  const n = name || '';
  if (/\bcone\b/i.test(n)) return 'cone';
  if (/\bdish\b|\bradar\b/i.test(n)) return 'dish';
  if (/\bslope\b/i.test(n)) return 'slope';
  if (/\bplant\b|\btree\b|\bleaf\b|\bflower\b/i.test(n)) return 'plant';
  if (/\btile\b/i.test(n)) return 'tile';
  if (/\bplate\b/i.test(n)) return 'plate';
  if (/\bround\b|\bmacaroni\b/i.test(n)) return 'round';
  if (/\bbrick\b/i.test(n)) return 'brick';
  return 'other';
}

function promote(ids, masterById, seedIds, setNum) {
  const counts = { promoted: 0, alreadyBc1: 0, unresolved: 0, noFootprint: 0 };
  const results = [];
  const defs = [];
  for (const id of ids) {
    if (seedIds.has(id)) {
      counts.alreadyBc1++;
      const e = masterById.get(id);
      results.push({ id, bucket: 'alreadyBc1' });
      if (e?.footprint) {
        defs.push({
          id,
          name: e.name,
          category: guessCategory(e.name),
          footprint: e.footprint,
          mesh: { status: 'box' },
          ...(e.ldraw_id ? { ldrawId: e.ldraw_id } : {}),
          notes: 'promoted from master-index (CF1)',
        });
      }
      continue;
    }
    const e = masterById.get(id);
    if (!e) {
      counts.unresolved++;
      results.push({ id, bucket: 'unresolved', reason: 'not in master-index' });
      continue;
    }
    const fp = e.footprint;
    if (!fp || fp[0] <= 0 || fp[1] <= 0 || fp[2] <= 0) {
      counts.noFootprint++;
      results.push({ id, bucket: 'noFootprint' });
      continue;
    }
    const def = {
      id,
      name: e.name,
      category: guessCategory(e.name),
      footprint: fp,
      mesh: { status: 'box' },
      ...(e.ldraw_id ? { ldrawId: e.ldraw_id } : {}),
      notes: 'promoted from master-index (CF1)',
    };
    defs.push(def);
    counts.promoted++;
    results.push({ id, bucket: 'promoted' });
  }
  return { setNum, counts, results, defs };
}

function mergePartsJson(defs) {
  const file = JSON.parse(readFileSync(PARTS_JSON, 'utf8'));
  const byId = new Map(file.parts.map((p) => [p.id, p]));
  for (const d of defs) byId.set(d.id, d);
  file.parts = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(PARTS_JSON, `${JSON.stringify(file, null, 2)}\n`, 'utf8');
  return file.parts.length;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(MASTER)) {
    throw new Error(`Missing ${MASTER} — run pnpm catalog:build`);
  }
  const master = JSON.parse(readFileSync(MASTER, 'utf8'));
  const masterById = new Map(master.parts.map((p) => [p.id, p]));
  const seed = JSON.parse(readFileSync(PARTS_JSON, 'utf8'));
  const seedIds = new Set(seed.parts.map((p) => p.id));

  let ids;
  let setKey = args.setNum ?? 'custom';
  if (args.idsFile) {
    ids = readFileSync(args.idsFile, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
  } else if (args.setNum) {
    const bom = await bomIdsForSet(args.setNum, args.forceFetch);
    setKey = bom.setKey;
    ids = bom.ids;
    console.log(`Set ${setKey}: ${ids.length} unique part_num`);
  } else {
    throw new Error('Usage: pnpm catalog:promote-set -- <setNum>|--ids-file file');
  }

  const report = promote(ids, masterById, seedIds, setKey);
  mkdirSync(BOM_DIR, { recursive: true });
  const stem = String(args.setNum ?? 'custom').replace(/-1$/, '');
  const out = {
    version: 1,
    setNum: setKey,
    generated: new Date().toISOString(),
    ids,
    counts: report.counts,
    colorHints: stem === '10359' ? COLOR_HINTS_10359 : [],
    unresolved: report.results.filter((r) => r.bucket === 'unresolved').map((r) => r.id),
    noFootprint: report.results.filter((r) => r.bucket === 'noFootprint').map((r) => r.id),
    defs: report.defs,
  };
  const outPath = path.join(BOM_DIR, `${stem}.json`);
  writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  console.log('counts', report.counts);
  console.log('wrote', outPath);

  if (args.writeParts) {
    const n = mergePartsJson(report.defs);
    console.log(`merged parts.json → ${n} parts`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
