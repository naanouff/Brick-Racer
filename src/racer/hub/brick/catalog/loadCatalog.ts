/**
 * @file loadCatalog.ts
 * @description Load + index brick part / color catalog (BC1).
 */

import colorsJson from './data/colors.json';
import partsJson from './data/parts.json';
import type {
  BrickCatalog,
  BrickColorDef,
  BrickFootprint,
  BrickMaterialKind,
  BrickMeshStatus,
  BrickPartDef,
} from './types';
import { BRICK_MATERIAL_KINDS } from './types';

type PartsFile = { version: number; parts: BrickPartDef[] };
type ColorsFile = {
  version: number;
  source?: string;
  generated?: string;
  colors: BrickColorDef[];
};

function buildPartIndex(parts: readonly BrickPartDef[]): {
  byId: Map<string, BrickPartDef>;
  resolve: Map<string, string>;
} {
  const byId = new Map<string, BrickPartDef>();
  const resolve = new Map<string, string>();
  for (const p of parts) {
    if (byId.has(p.id)) {
      throw new Error(`duplicate part id '${p.id}' in catalog`);
    }
    byId.set(p.id, p);
    resolve.set(p.id, p.id);
    for (const a of p.aliases ?? []) {
      if (resolve.has(a) && resolve.get(a) !== p.id) {
        throw new Error(`alias '${a}' maps to both ${resolve.get(a)} and ${p.id}`);
      }
      resolve.set(a, p.id);
    }
  }
  return { byId, resolve };
}

function buildColorIndex(colors: readonly BrickColorDef[]): {
  byId: Map<string, BrickColorDef>;
  resolve: Map<string, string>;
  byCode: Map<number, string>;
} {
  const byId = new Map<string, BrickColorDef>();
  const resolve = new Map<string, string>();
  const byCode = new Map<number, string>();
  for (const c of colors) {
    if (byId.has(c.id)) {
      throw new Error(`duplicate color id '${c.id}' in catalog`);
    }
    byId.set(c.id, c);
    resolve.set(c.id, c.id);
    if (c.ldrawCode != null) {
      if (byCode.has(c.ldrawCode) && byCode.get(c.ldrawCode) !== c.id) {
        throw new Error(
          `duplicate ldrawCode ${c.ldrawCode}: ${byCode.get(c.ldrawCode)} vs ${c.id}`
        );
      }
      byCode.set(c.ldrawCode, c.id);
      resolve.set(String(c.ldrawCode), c.id);
    }
    for (const a of c.aliases ?? []) {
      if (resolve.has(a) && resolve.get(a) !== c.id) {
        throw new Error(`color alias '${a}' maps to both ${resolve.get(a)} and ${c.id}`);
      }
      resolve.set(a, c.id);
    }
  }
  return { byId, resolve, byCode };
}

const partsFile = partsJson as unknown as PartsFile;
const colorsFile = colorsJson as unknown as ColorsFile;

/** Ids from disk seed `parts.json` (immutable set for CF promote reports). */
export const SEED_PART_IDS: ReadonlySet<string> = new Set(partsFile.parts.map((p) => p.id));

/** Mutable runtime parts (seed + CL1 registerPartRuntime). */
const runtimeParts: BrickPartDef[] = [...partsFile.parts];

let partIndex = buildPartIndex(runtimeParts);
const colorIndex = buildColorIndex(colorsFile.colors);

export const BRICK_CATALOG: BrickCatalog = {
  version: Math.max(partsFile.version, colorsFile.version),
  get parts() {
    return runtimeParts;
  },
  colors: colorsFile.colors,
};

/** Register / replace a part for the current session (catalog-lab → BC1 staging). */
export function registerPartRuntime(def: BrickPartDef): void {
  const i = runtimeParts.findIndex((p) => p.id === def.id);
  if (i >= 0) runtimeParts[i] = def;
  else runtimeParts.push(def);
  partIndex = buildPartIndex(runtimeParts);
}

/** How many parts are currently registered (seed + session). */
export function runtimePartCount(): number {
  return runtimeParts.length;
}

export function seedPartCount(): number {
  return SEED_PART_IDS.size;
}

/** Canonical part id, or undefined if unknown. */
export function resolvePartId(idOrAlias: string): string | undefined {
  return partIndex.resolve.get(idOrAlias);
}

/** Canonical color id, or undefined if unknown (slug, alias, or LDraw CODE as string). */
export function resolveColorId(idOrAlias: string): string | undefined {
  return colorIndex.resolve.get(idOrAlias);
}

export function getPart(idOrAlias: string): BrickPartDef | undefined {
  const id = resolvePartId(idOrAlias);
  return id ? partIndex.byId.get(id) : undefined;
}

export function getColor(idOrAlias: string): BrickColorDef | undefined {
  const id = resolveColorId(idOrAlias);
  return id ? colorIndex.byId.get(id) : undefined;
}

/** Colours flagged `common` (UI default palette). */
export function catalogCommonColors(): readonly BrickColorDef[] {
  return colorsFile.colors.filter((c) => c.common);
}

/** Colours for a given material kind. */
export function catalogColorsByMaterial(kind: BrickMaterialKind): readonly BrickColorDef[] {
  return colorsFile.colors.filter((c) => (c.material ?? 'plastic') === kind);
}

export function isCatalogPart(idOrAlias: string): boolean {
  return resolvePartId(idOrAlias) !== undefined;
}

export function isCatalogColor(idOrAlias: string): boolean {
  return resolveColorId(idOrAlias) !== undefined;
}

export function partFootprintFromCatalog(idOrAlias: string): BrickFootprint {
  const part = getPart(idOrAlias);
  if (!part) throw new Error(`unknown catalog part '${idOrAlias}'`);
  return part.footprint;
}

export function partMeshStatus(idOrAlias: string): BrickMeshStatus {
  const part = getPart(idOrAlias);
  if (!part) throw new Error(`unknown catalog part '${idOrAlias}'`);
  return part.mesh.status;
}

/** All accept keys (canonical + aliases) for validateManual. */
export function catalogPartAcceptIds(): readonly string[] {
  return [...partIndex.resolve.keys()].sort();
}

export function catalogColorAcceptIds(): readonly string[] {
  return [...colorIndex.resolve.keys()].sort();
}

export function catalogCanonicalPartIds(): readonly string[] {
  return [...partIndex.byId.keys()].sort();
}

export function catalogCanonicalColorIds(): readonly string[] {
  return [...colorIndex.byId.keys()].sort();
}

/** Colours flagged `common` (picker default / plastic pregen until MT2 lazy). */
export function catalogCommonColorIds(): readonly string[] {
  return colorsFile.colors.filter((c) => c.common).map((c) => c.id);
}

/**
 * Finish for a colour id or alias. Unknown → `plastic`.
 * Legacy colours without `material` fall back to translucent → transparent.
 */
export function materialOf(idOrAlias: string): BrickMaterialKind {
  const def = getColor(idOrAlias);
  if (!def) return 'plastic';
  if (def.material && (BRICK_MATERIAL_KINDS as readonly string[]).includes(def.material)) {
    return def.material;
  }
  if (def.translucent) return 'transparent';
  return 'plastic';
}

export function isBrickMaterialKind(value: string): value is BrickMaterialKind {
  return (BRICK_MATERIAL_KINDS as readonly string[]).includes(value);
}

/** Fountain BOM design ids that must exist (BC1 gate). */
export const FOUNTAIN_BOM_PART_IDS = [
  '41539', // 8x8 round plate (alias 3128)
  '3128',
  '85080',
  '3941',
  '3960',
  '3062',
  '3062b',
  '4740',
  '6141',
  '4589',
  '4589b',
] as const;
