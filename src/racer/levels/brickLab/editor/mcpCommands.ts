/**
 * @file mcpCommands.ts
 * @description Pure command apply for brick-lab MCP bus (LT4 + BA1–BA2).
 */

import {
  BRICK_CATALOG,
  SEED_PART_IDS,
  indexMasterParts,
  loadMasterIndex,
  promotePartsFromMaster,
  readStaging,
  registerPartRuntime,
  runtimePartCount,
  seedPartCount,
  upsertStaging,
  type BrickPartDef,
  type MasterIndexEntry,
} from '../../../hub/brick/catalog';
import { isBrickColorId, isBrickPartId } from '../../../hub/brick/brickCatalog';
import { validateManual } from '../../../hub/brick/manual';
import {
  cellKey,
  isRotDeg,
  rotatedFootprint,
  type RotDeg,
} from '../../../hub/brick/manual/partFootprint';
import {
  BRICK_LAB_VIEWS,
  type BrickLabView,
} from '../brickLabCamera';
import {
  buildOccupancy,
  createEmptyEditorState,
  createEditorOpId,
  findOpAtCell,
  footprintCollides,
  pushUndo,
  redoEditor,
  removeEditorBrick,
  stackHeightUnder,
  undoEditor,
  type EditorBrickOp,
  type EditorState,
} from './editorState';
import { editorStateToManual, manualToEditorState, validateEditorManual } from './editorIo';
import {
  macroColumn,
  macroFillRect,
  macroRingOrDisc,
  macroWall,
  type MacroBrickSpec,
  type Vec3,
} from './mcpMacros';

export type McpBrickSpec = {
  part: string;
  color: string;
  at: [number, number, number];
  rot?: RotDeg;
};

export type McpCommand =
  | { type: 'status' }
  | { type: 'list_parts' }
  | { type: 'list_colors' }
  | { type: 'get_assembly' }
  | { type: 'place_bricks'; bricks: McpBrickSpec[]; dryRun?: boolean }
  | { type: 'remove_brick'; opId?: string; at?: [number, number, number] }
  | {
      type: 'remove_bricks';
      opIds?: string[];
      min?: [number, number, number];
      max?: [number, number, number];
    }
  | { type: 'query_region'; min: [number, number, number]; max: [number, number, number] }
  | { type: 'analyze' }
  | { type: 'set_brush'; part?: string; color?: string; rot?: RotDeg }
  | { type: 'set_view'; view: BrickLabView }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'new'; stem?: string; title?: string }
  | { type: 'save'; stem?: string }
  | { type: 'load'; stem: string }
  | {
      type: 'fill_rect';
      min: Vec3;
      max: Vec3;
      color: string;
      part?: string;
      dryRun?: boolean;
    }
  | {
      type: 'wall';
      from: Vec3;
      to: Vec3;
      color: string;
      part?: string;
      dryRun?: boolean;
    }
  | {
      type: 'ring';
      center: [number, number];
      radius: number;
      y: number;
      height?: number;
      color: string;
      part?: string;
      dryRun?: boolean;
    }
  | {
      type: 'disc';
      center: [number, number];
      radius: number;
      y: number;
      height?: number;
      color: string;
      part?: string;
      dryRun?: boolean;
    }
  | {
      type: 'column';
      part: string;
      color: string;
      at: Vec3;
      count: number;
      rot?: RotDeg;
      dryRun?: boolean;
    }
  /** Meta for main-process capture (stem + optional view already applied). */
  | { type: 'capture_meta' }
  | { type: 'promote_parts'; ids: string[]; persist?: boolean; setNum?: string }
  | { type: 'promote_status' }
  | { type: 'promote_bom'; setNum: string; persist?: boolean }
  | {
      type: 'place_assembly';
      stem: string;
      at: [number, number, number];
      dryRun?: boolean;
    };

export type McpHandlerContext = {
  levelId: string;
  state: EditorState;
  writeManual?: (
    stem: string,
    manual: unknown
  ) => Promise<{ ok: boolean; path?: string; error?: string }>;
  readManual?: (stem: string) => Promise<
    { ok: true; stem: string; manual: unknown } | { ok: false; error: string }
  >;
  setView?: (view: BrickLabView) => void | Promise<void>;
  /** CF1c — inject master map in tests; default loadMasterIndex(). */
  loadMasterParts?: () => Promise<readonly MasterIndexEntry[]>;
  /** CF1c — merge staging → parts.json via Electron IPC. */
  mergeBc1Parts?: (
    staging: readonly BrickPartDef[]
  ) => Promise<{ ok: boolean; added?: number; total?: number; error?: string }>;
  /** CF1c — load `/catalog/bom/<setNum>.json` ids (tests / custom). */
  loadBomIds?: (setNum: string) => Promise<string[] | null>;
};

export type McpResult = {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
};

type RejectedBrick = {
  index: number;
  reason: string;
  cell?: [number, number, number];
  opId?: string;
};

/** Commands that change scene geometry (need syncBrickLabManual). */
export function mcpCommandNeedsSceneSync(type: string): boolean {
  return (
    type === 'place_bricks' ||
    type === 'remove_brick' ||
    type === 'remove_bricks' ||
    type === 'undo' ||
    type === 'redo' ||
    type === 'new' ||
    type === 'load' ||
    type === 'fill_rect' ||
    type === 'wall' ||
    type === 'ring' ||
    type === 'disc' ||
    type === 'column' ||
    type === 'place_assembly'
  );
}

/**
 * Map a saved manual's brick ops into place_bricks specs, translated by world `at`.
 * Local coords in the manual stay relative to the module origin; `at` is the world min corner offset.
 */
export function bricksFromManualOffset(
  manual: { steps: readonly { ops: readonly { op?: string; part?: string; color?: string; at?: number[]; rot?: number }[] }[] },
  at: readonly [number, number, number]
): McpBrickSpec[] {
  const [ox, oy, oz] = at;
  const out: McpBrickSpec[] = [];
  for (const step of manual.steps) {
    for (const op of step.ops) {
      if (op.op !== 'brick' || typeof op.part !== 'string' || typeof op.color !== 'string') continue;
      if (!Array.isArray(op.at) || op.at.length !== 3) continue;
      const spec: McpBrickSpec = {
        part: op.part,
        color: op.color,
        at: [op.at[0]! + ox, op.at[1]! + oy, op.at[2]! + oz],
      };
      if (op.rot === 90 || op.rot === 180 || op.rot === 270) spec.rot = op.rot;
      out.push(spec);
    }
  }
  return out;
}

function asCommand(raw: unknown): McpCommand | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = (raw as { type?: unknown }).type;
  if (typeof t !== 'string') return null;
  return raw as McpCommand;
}

function isBrickLabView(v: unknown): v is BrickLabView {
  return typeof v === 'string' && (BRICK_LAB_VIEWS as readonly string[]).includes(v);
}

function occAddBrick(
  occ: Set<string>,
  part: string,
  sx: number,
  py: number,
  sz: number,
  rot: RotDeg
): void {
  const [fx, fy, fz] = rotatedFootprint(part, rot);
  for (let x = 0; x < fx; x++) {
    for (let y = 0; y < fy; y++) {
      for (let z = 0; z < fz; z++) {
        occ.add(cellKey(sx + x, py + y, sz + z));
      }
    }
  }
}

function collisionDetail(
  ops: readonly EditorBrickOp[],
  part: string,
  sx: number,
  py: number,
  sz: number,
  rot: RotDeg
): { cell: [number, number, number]; opId?: string } | null {
  const [fx, fy, fz] = rotatedFootprint(part, rot);
  for (let x = 0; x < fx; x++) {
    for (let y = 0; y < fy; y++) {
      for (let z = 0; z < fz; z++) {
        const cx = sx + x;
        const cy = py + y;
        const cz = sz + z;
        const hit = findOpAtCell(ops, cx, cy, cz);
        if (hit) return { cell: [cx, cy, cz], opId: hit.id };
      }
    }
  }
  return null;
}

function placeBricksBatch(
  state: EditorState,
  bricks: McpBrickSpec[],
  dryRun: boolean
): McpResult {
  if (!Array.isArray(bricks) || bricks.length === 0) {
    return { ok: false, error: 'bricks[] requis' };
  }

  const simOps: EditorBrickOp[] = dryRun
    ? state.ops.map((o) => ({ ...o, at: [...o.at] as [number, number, number] }))
    : [];
  const occ = buildOccupancy(dryRun ? simOps : state.ops);
  if (!dryRun) pushUndo(state);

  const placed: { index: number; id: string }[] = [];
  const rejected: RejectedBrick[] = [];

  for (let i = 0; i < bricks.length; i++) {
    const b = bricks[i]!;
    if (!isBrickPartId(b.part)) {
      rejected.push({ index: i, reason: `pièce inconnue: ${b.part}` });
      continue;
    }
    if (!isBrickColorId(b.color)) {
      rejected.push({ index: i, reason: `couleur inconnue: ${b.color}` });
      continue;
    }
    const rot = (b.rot ?? 0) as RotDeg;
    if (!isRotDeg(rot)) {
      rejected.push({ index: i, reason: `rot invalide: ${String(b.rot)}` });
      continue;
    }
    const [sx, py, sz] = b.at;
    if (footprintCollides(occ, b.part, sx, py, sz, rot)) {
      const detail = collisionDetail(dryRun ? simOps : state.ops, b.part, sx, py, sz, rot);
      rejected.push({
        index: i,
        reason: 'collision',
        ...(detail?.cell ? { cell: detail.cell } : {}),
        ...(detail?.opId ? { opId: detail.opId } : {}),
      });
      continue;
    }

    if (dryRun) {
      const id = `dry${i}`;
      const op: EditorBrickOp = {
        id,
        op: 'brick',
        part: b.part as EditorBrickOp['part'],
        color: b.color as EditorBrickOp['color'],
        at: [sx, py, sz],
        ...(rot !== 0 ? { rot } : {}),
      };
      simOps.push(op);
      occAddBrick(occ, b.part, sx, py, sz, rot);
      placed.push({ index: i, id });
    } else {
      state.partId = b.part;
      state.colorId = b.color;
      state.rot = rot;
      const op: EditorBrickOp = {
        id: createEditorOpId(),
        op: 'brick',
        part: b.part as EditorBrickOp['part'],
        color: b.color as EditorBrickOp['color'],
        at: [sx, py, sz],
        ...(rot !== 0 ? { rot } : {}),
      };
      state.ops.push(op);
      occAddBrick(occ, b.part, sx, py, sz, rot);
      placed.push({ index: i, id: op.id });
    }
  }

  if (placed.length === 0) {
    if (!dryRun) state.undo.pop();
    return { ok: false, error: 'aucune brique placée', placed, rejected, dryRun };
  }
  return { ok: true, placed, rejected, dryRun };
}

function isFloating(ops: readonly EditorBrickOp[], op: EditorBrickOp): boolean {
  const py = op.at[1];
  if (py === 0) return false;
  const rot = (op.rot ?? 0) as RotDeg;
  const others = ops.filter((o) => o.id !== op.id);
  const below = others.filter((o) => {
    const orot = (o.rot ?? 0) as RotDeg;
    const [, ofy] = rotatedFootprint(o.part, orot);
    return o.at[1] + ofy <= py;
  });
  const support = stackHeightUnder(below, op.part, op.at[0], op.at[2], rot);
  return support < py;
}

function opOverlapsRegion(
  op: EditorBrickOp,
  min: [number, number, number],
  max: [number, number, number]
): boolean {
  const rot = (op.rot ?? 0) as RotDeg;
  const [fx, fy, fz] = rotatedFootprint(op.part, rot);
  const [ox, oy, oz] = op.at;
  return (
    ox < max[0] + 1 &&
    ox + fx > min[0] &&
    oy < max[1] + 1 &&
    oy + fy > min[1] &&
    oz < max[2] + 1 &&
    oz + fz > min[2]
  );
}

function runMacro(
  state: EditorState,
  bricks: MacroBrickSpec[],
  dryRun: boolean
): McpResult {
  if (bricks.length === 0) return { ok: false, error: 'macro vide' };
  return placeBricksBatch(state, bricks as McpBrickSpec[], dryRun);
}

/**
 * Apply one MCP command. Mutates `ctx.state` in place when editing.
 * Caller syncs React state / scene after mutations.
 */
export async function applyMcpCommand(
  raw: unknown,
  ctx: McpHandlerContext
): Promise<McpResult> {
  const cmd = asCommand(raw);
  if (!cmd) return { ok: false, error: 'commande invalide' };

  if (ctx.levelId !== 'brick-lab' && cmd.type !== 'status') {
    return { ok: false, error: 'non connecté — ouvrir brick-lab' };
  }

  switch (cmd.type) {
    case 'status':
      return {
        ok: true,
        connected: ctx.levelId === 'brick-lab',
        levelId: ctx.levelId,
        stem: ctx.state.stem,
        tool: ctx.state.tool,
        rot: ctx.state.rot,
        partId: ctx.state.partId,
        colorId: ctx.state.colorId,
        ops: ctx.state.ops.length,
      };
    case 'list_parts':
      return {
        ok: true,
        parts: BRICK_CATALOG.parts.map((p) => ({
          id: p.id,
          name: p.name,
          footprint: p.footprint,
          category: p.category,
          ldrawId: p.ldrawId ?? null,
          source: SEED_PART_IDS.has(p.id) ? 'seed' : 'staging',
        })),
      };
    case 'list_colors':
      return {
        ok: true,
        colors: BRICK_CATALOG.colors.map((c) => ({
          id: c.id,
          name: c.name,
          rgb: c.rgb,
        })),
      };
    case 'get_assembly':
      return {
        ok: true,
        stem: ctx.state.stem,
        title: ctx.state.title,
        ops: ctx.state.ops.map((o) => ({
          id: o.id,
          part: o.part,
          color: o.color,
          at: o.at,
          rot: o.rot ?? 0,
        })),
      };
    case 'place_bricks':
      return placeBricksBatch(ctx.state, cmd.bricks, Boolean(cmd.dryRun));
    case 'remove_brick': {
      let id = cmd.opId;
      if (!id && cmd.at) {
        const [sx, py, sz] = cmd.at;
        const hit = ctx.state.ops.find(
          (o) => o.at[0] === sx && o.at[1] === py && o.at[2] === sz
        );
        id = hit?.id;
      }
      if (!id) return { ok: false, error: 'opId ou at requis' };
      if (!removeEditorBrick(ctx.state, id)) return { ok: false, error: 'introuvable' };
      return { ok: true, removed: id };
    }
    case 'remove_bricks': {
      const ids = new Set<string>();
      if (Array.isArray(cmd.opIds)) {
        for (const id of cmd.opIds) ids.add(id);
      }
      if (cmd.min && cmd.max) {
        for (const op of ctx.state.ops) {
          if (opOverlapsRegion(op, cmd.min, cmd.max)) ids.add(op.id);
        }
      }
      if (ids.size === 0) return { ok: false, error: 'opIds[] ou min/max requis' };
      const before = ctx.state.ops.length;
      pushUndo(ctx.state);
      ctx.state.ops = ctx.state.ops.filter((o) => !ids.has(o.id));
      if (ctx.state.selectedOpId && ids.has(ctx.state.selectedOpId)) {
        ctx.state.selectedOpId = null;
      }
      const removed = [...ids];
      if (ctx.state.ops.length === before) {
        ctx.state.undo.pop();
        return { ok: false, error: 'aucune op retirée', removed: [] };
      }
      return { ok: true, removed };
    }
    case 'query_region': {
      const { min, max } = cmd;
      if (!min || !max) return { ok: false, error: 'min/max requis' };
      const cells: [number, number, number][] = [];
      const opIds = new Set<string>();
      for (let x = min[0]; x <= max[0]; x++) {
        for (let y = min[1]; y <= max[1]; y++) {
          for (let z = min[2]; z <= max[2]; z++) {
            const hit = findOpAtCell(ctx.state.ops, x, y, z);
            if (hit) {
              cells.push([x, y, z]);
              opIds.add(hit.id);
            }
          }
        }
      }
      return {
        ok: true,
        cells,
        ops: ctx.state.ops
          .filter((o) => opIds.has(o.id))
          .map((o) => ({
            id: o.id,
            part: o.part,
            color: o.color,
            at: o.at,
            rot: o.rot ?? 0,
          })),
      };
    }
    case 'analyze': {
      const ops = ctx.state.ops;
      let minX = Infinity;
      let minY = Infinity;
      let minZ = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      let maxZ = -Infinity;
      const bomMap = new Map<string, { part: string; color: string; qty: number }>();
      const floating: { id: string; part: string; color: string; at: [number, number, number] }[] =
        [];

      for (const op of ops) {
        const rot = (op.rot ?? 0) as RotDeg;
        const [fx, fy, fz] = rotatedFootprint(op.part, rot);
        const [ox, oy, oz] = op.at;
        minX = Math.min(minX, ox);
        minY = Math.min(minY, oy);
        minZ = Math.min(minZ, oz);
        maxX = Math.max(maxX, ox + fx - 1);
        maxY = Math.max(maxY, oy + fy - 1);
        maxZ = Math.max(maxZ, oz + fz - 1);
        const key = `${op.part}|${op.color}`;
        const prev = bomMap.get(key);
        if (prev) prev.qty++;
        else bomMap.set(key, { part: op.part, color: op.color, qty: 1 });
        if (isFloating(ops, op)) {
          floating.push({
            id: op.id,
            part: op.part,
            color: op.color,
            at: [ox, oy, oz],
          });
        }
      }

      const empty = ops.length === 0;
      return {
        ok: true,
        ops: ops.length,
        bbox: empty
          ? null
          : {
              min: [minX, minY, minZ],
              max: [maxX, maxY, maxZ],
            },
        bom: [...bomMap.values()].sort(
          (a, b) => a.part.localeCompare(b.part) || a.color.localeCompare(b.color)
        ),
        floating,
      };
    }
    case 'set_brush': {
      if (cmd.part != null) {
        if (!isBrickPartId(cmd.part)) return { ok: false, error: `pièce inconnue: ${cmd.part}` };
        ctx.state.partId = cmd.part;
      }
      if (cmd.color != null) {
        if (!isBrickColorId(cmd.color)) {
          return { ok: false, error: `couleur inconnue: ${cmd.color}` };
        }
        ctx.state.colorId = cmd.color;
      }
      if (cmd.rot != null) {
        if (!isRotDeg(cmd.rot)) return { ok: false, error: 'rot invalide' };
        ctx.state.rot = cmd.rot;
      }
      return {
        ok: true,
        partId: ctx.state.partId,
        colorId: ctx.state.colorId,
        rot: ctx.state.rot,
      };
    }
    case 'set_view': {
      if (!isBrickLabView(cmd.view)) return { ok: false, error: 'view invalide' };
      if (!ctx.setView) return { ok: false, error: 'setView indisponible' };
      await ctx.setView(cmd.view);
      return { ok: true, view: cmd.view };
    }
    case 'capture_meta':
      return { ok: true, stem: ctx.state.stem, ops: ctx.state.ops.length };
    case 'undo':
      return { ok: undoEditor(ctx.state) };
    case 'redo':
      return { ok: redoEditor(ctx.state) };
    case 'new': {
      const next = createEmptyEditorState(
        cmd.stem ?? 'untitled',
        cmd.title ?? 'Nouvelle structure'
      );
      Object.assign(ctx.state, next);
      return { ok: true, stem: ctx.state.stem };
    }
    case 'save': {
      const stem = (cmd.stem ?? ctx.state.stem).trim();
      if (!ctx.writeManual) return { ok: false, error: 'writeManual indisponible' };
      const issues = validateEditorManual({ ...ctx.state, stem });
      if (issues.length) return { ok: false, error: issues[0] };
      const manual = editorStateToManual({ ...ctx.state, stem });
      const res = await ctx.writeManual(stem, manual);
      if (!res.ok) return { ok: false, error: res.error ?? 'écriture échouée' };
      ctx.state.stem = stem;
      return { ok: true, path: res.path, stem };
    }
    case 'load': {
      if (!ctx.readManual) return { ok: false, error: 'readManual indisponible' };
      const res = await ctx.readManual(cmd.stem);
      if (!res.ok) return { ok: false, error: res.error };
      const checked = validateManual(res.manual);
      if (!checked.ok) {
        return {
          ok: false,
          error: checked.issues[0]
            ? `${checked.issues[0].path}: ${checked.issues[0].message}`
            : 'manuel invalide',
        };
      }
      const next = manualToEditorState(checked.manual, cmd.stem);
      const issues = validateEditorManual(next);
      if (issues.length) return { ok: false, error: issues[0] };
      Object.assign(ctx.state, next);
      return { ok: true, stem: cmd.stem, ops: next.ops.length };
    }
    case 'fill_rect':
      return runMacro(
        ctx.state,
        macroFillRect({
          min: cmd.min,
          max: cmd.max,
          color: cmd.color,
          part: cmd.part,
        }),
        Boolean(cmd.dryRun)
      );
    case 'wall':
      return runMacro(
        ctx.state,
        macroWall({
          from: cmd.from,
          to: cmd.to,
          color: cmd.color,
          part: cmd.part,
        }),
        Boolean(cmd.dryRun)
      );
    case 'ring':
      return runMacro(
        ctx.state,
        macroRingOrDisc({
          kind: 'ring',
          center: cmd.center,
          radius: cmd.radius,
          y: cmd.y,
          height: cmd.height,
          color: cmd.color,
          part: cmd.part,
        }),
        Boolean(cmd.dryRun)
      );
    case 'disc':
      return runMacro(
        ctx.state,
        macroRingOrDisc({
          kind: 'disc',
          center: cmd.center,
          radius: cmd.radius,
          y: cmd.y,
          height: cmd.height,
          color: cmd.color,
          part: cmd.part,
        }),
        Boolean(cmd.dryRun)
      );
    case 'column':
      return runMacro(
        ctx.state,
        macroColumn({
          part: cmd.part,
          color: cmd.color,
          at: cmd.at,
          count: cmd.count,
          rot: cmd.rot,
        }),
        Boolean(cmd.dryRun)
      );
    case 'place_assembly': {
      const stem = String(cmd.stem ?? '').trim();
      if (!stem) return { ok: false, error: 'stem requis' };
      if (!Array.isArray(cmd.at) || cmd.at.length !== 3) {
        return { ok: false, error: 'at [sx,py,sz] requis' };
      }
      if (!ctx.readManual) return { ok: false, error: 'readManual indisponible' };
      const res = await ctx.readManual(stem);
      if (!res.ok) return { ok: false, error: res.error };
      const checked = validateManual(res.manual);
      if (!checked.ok) {
        return {
          ok: false,
          error: checked.issues[0]
            ? `${checked.issues[0].path}: ${checked.issues[0].message}`
            : 'manuel invalide',
        };
      }
      const bricks = bricksFromManualOffset(checked.manual, cmd.at);
      if (bricks.length === 0) return { ok: false, error: 'assemblage vide' };
      const placed = placeBricksBatch(ctx.state, bricks, Boolean(cmd.dryRun));
      return {
        ...placed,
        stem,
        at: cmd.at,
        placedCount: Array.isArray(placed.placed) ? placed.placed.length : 0,
      };
    }
    case 'promote_status':
      return {
        ok: true,
        seedCount: seedPartCount(),
        runtimeCount: runtimePartCount(),
        stagingCount: readStaging().length,
      };
    case 'promote_parts': {
      if (!Array.isArray(cmd.ids) || cmd.ids.length === 0) {
        return { ok: false, error: 'ids[] requis' };
      }
      return applyPromote(ctx, cmd.ids, Boolean(cmd.persist), cmd.setNum);
    }
    case 'promote_bom': {
      const setNum = String(cmd.setNum ?? '').trim().replace(/-1$/, '');
      if (!setNum) return { ok: false, error: 'setNum requis' };
      const ids = await resolveBomIds(ctx, setNum);
      if (!ids) {
        return {
          ok: false,
          error: `BOM introuvable — lancer pnpm catalog:promote-set -- ${setNum}`,
        };
      }
      return applyPromote(ctx, ids, Boolean(cmd.persist), setNum);
    }
    default:
      return { ok: false, error: `type inconnu: ${(cmd as { type: string }).type}` };
  }
}

async function resolveBomIds(
  ctx: McpHandlerContext,
  setNum: string
): Promise<string[] | null> {
  if (ctx.loadBomIds) return ctx.loadBomIds(setNum);
  try {
    const res = await fetch(`/catalog/bom/${setNum}.json`);
    if (!res.ok) return null;
    const data = (await res.json()) as { ids?: unknown };
    if (!Array.isArray(data.ids)) return null;
    return data.ids.map((id) => String(id));
  } catch {
    return null;
  }
}

async function applyPromote(
  ctx: McpHandlerContext,
  ids: readonly string[],
  persist: boolean,
  setNum?: string
): Promise<McpResult> {
  let parts: readonly MasterIndexEntry[];
  try {
    parts = ctx.loadMasterParts
      ? await ctx.loadMasterParts()
      : (await loadMasterIndex()).parts;
  } catch (err) {
    return {
      ok: false,
      error: `master-index: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const report = promotePartsFromMaster(
    ids,
    indexMasterParts(parts),
    SEED_PART_IDS,
    setNum ? { setNum } : undefined
  );

  for (const def of report.defs) {
    if (SEED_PART_IDS.has(def.id)) continue;
    registerPartRuntime(def);
    upsertStaging(def);
  }

  let persistResult: { ok: boolean; added?: number; total?: number; error?: string } | null =
    null;
  if (persist) {
    const staging = readStaging();
    if (!ctx.mergeBc1Parts) {
      return {
        ok: false,
        error: 'mergeBc1Parts indisponible (hors Electron ?)',
        counts: report.counts,
        results: report.results,
      };
    }
    persistResult = await ctx.mergeBc1Parts(staging);
    if (!persistResult.ok) {
      return {
        ok: false,
        error: persistResult.error ?? 'persist échoué',
        counts: report.counts,
        results: report.results,
      };
    }
  }

  return {
    ok: true,
    ...(setNum ? { setNum } : {}),
    counts: report.counts,
    results: report.results,
    registered: report.defs.filter((d) => !SEED_PART_IDS.has(d.id)).map((d) => d.id),
    runtimeCount: runtimePartCount(),
    stagingCount: readStaging().length,
    ...(persistResult
      ? { persisted: true, added: persistResult.added, total: persistResult.total }
      : { persisted: false }),
  };
}
