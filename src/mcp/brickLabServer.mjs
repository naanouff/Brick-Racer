#!/usr/bin/env node
/**
 * @file brickLabServer.mjs
 * @description Stdio MCP server → localhost brick-lab bus (LT5 + BA1–BA3).
 *
 * Requires `pnpm dev` (Electron bus on 127.0.0.1:3847) and brick-lab open.
 * Token: data/brick-lab-mcp.token (written by the bus on start).
 */

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TOKEN_FILE = path.join(ROOT, 'data', 'brick-lab-mcp.token');
const BUS_URL = 'http://127.0.0.1:3847/v1/command';

const RotSchema = z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]);
const Vec3Schema = z.tuple([z.number(), z.number(), z.number()]);
const ViewSchema = z.enum(['orbit', 'face', 'side', 'top']);

function readToken() {
  if (!existsSync(TOKEN_FILE)) {
    throw new Error(
      `Jeton manquant (${TOKEN_FILE}). Lancer pnpm dev (bus MCP) puis réessayer.`
    );
  }
  return readFileSync(TOKEN_FILE, 'utf8').trim();
}

async function busCommand(body) {
  const token = readToken();
  let res;
  try {
    res = await fetch(BUS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(
      `Bus injoignable (${BUS_URL}). pnpm dev tourne ? ${err instanceof Error ? err.message : String(err)}`
    );
  }
  const json = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
  if (!res.ok && json && typeof json === 'object' && !('ok' in json)) {
    return { ok: false, error: `HTTP ${res.status}` };
  }
  return json;
}

function toolResult(data) {
  const text = JSON.stringify(data, null, 2);
  return {
    content: [{ type: 'text', text }],
    isError: data?.ok === false,
  };
}

const server = new McpServer({
  name: 'brick-lab',
  version: '0.3.0',
});

server.registerTool(
  'status',
  {
    description:
      'Brick-lab MCP: connected? level, stem, tool, rot, part, color, ops count.',
    inputSchema: {},
  },
  async () => toolResult(await busCommand({ type: 'status' }))
);

server.registerTool(
  'list_parts',
  {
    description: 'List BC1 brick parts (id, footprint, category, ldrawId).',
    inputSchema: {},
  },
  async () => toolResult(await busCommand({ type: 'list_parts' }))
);

server.registerTool(
  'list_colors',
  {
    description: 'List brick colors (id, name, rgb).',
    inputSchema: {},
  },
  async () => toolResult(await busCommand({ type: 'list_colors' }))
);

server.registerTool(
  'get_assembly',
  {
    description: 'Current editor ops (part, color, at, rot, id).',
    inputSchema: {},
  },
  async () => toolResult(await busCommand({ type: 'get_assembly' }))
);

server.registerTool(
  'place_bricks',
  {
    description:
      'Place a batch of bricks. One undo. Partial OK — rejected[] has reasons (collision+cell/opId, unknown part/color). dryRun=true validates without mutating.',
    inputSchema: {
      bricks: z
        .array(
          z.object({
            part: z.string().describe('BC1 part id, e.g. 3001'),
            color: z.string().describe('Color id, e.g. gray'),
            at: Vec3Schema.describe('[sx, py, sz] stud grid min'),
            rot: RotSchema.optional().describe('Yaw 0|90|180|270'),
          })
        )
        .min(1),
      dryRun: z.boolean().optional().describe('If true, no mutation'),
    },
  },
  async ({ bricks, dryRun }) =>
    toolResult(await busCommand({ type: 'place_bricks', bricks, ...(dryRun ? { dryRun } : {}) }))
);

server.registerTool(
  'remove_brick',
  {
    description: 'Remove one brick by opId or exact cell at [sx,py,sz].',
    inputSchema: {
      opId: z.string().optional(),
      at: Vec3Schema.optional(),
    },
  },
  async ({ opId, at }) =>
    toolResult(await busCommand({ type: 'remove_brick', ...(opId ? { opId } : {}), ...(at ? { at } : {}) }))
);

server.registerTool(
  'remove_bricks',
  {
    description: 'Remove many bricks by opIds and/or AABB region. One undo.',
    inputSchema: {
      opIds: z.array(z.string()).optional(),
      min: Vec3Schema.optional(),
      max: Vec3Schema.optional(),
    },
  },
  async (args) => toolResult(await busCommand({ type: 'remove_bricks', ...args }))
);

server.registerTool(
  'query_region',
  {
    description: 'List occupied cells and ops overlapping inclusive AABB min..max.',
    inputSchema: {
      min: Vec3Schema,
      max: Vec3Schema,
    },
  },
  async ({ min, max }) => toolResult(await busCommand({ type: 'query_region', min, max }))
);

server.registerTool(
  'analyze',
  {
    description:
      'Assembly bbox (studs/plates), BOM, and floating ops (no support under footprint; py=0 never floating).',
    inputSchema: {},
  },
  async () => toolResult(await busCommand({ type: 'analyze' }))
);

server.registerTool(
  'set_brush',
  {
    description: 'Set brush part, color, and/or rot (0|90|180|270).',
    inputSchema: {
      part: z.string().optional(),
      color: z.string().optional(),
      rot: RotSchema.optional(),
    },
  },
  async (args) => toolResult(await busCommand({ type: 'set_brush', ...args }))
);

server.registerTool(
  'set_view',
  {
    description: 'Snap camera: orbit | face | side | top.',
    inputSchema: {
      view: ViewSchema,
    },
  },
  async ({ view }) => toolResult(await busCommand({ type: 'set_view', view }))
);

server.registerTool(
  'capture',
  {
    description:
      'Capture brick-lab viewport PNG. Optional view snap first. Returns absolute path under data/brick-lab-captures/.',
    inputSchema: {
      view: ViewSchema.optional(),
    },
  },
  async ({ view }) =>
    toolResult(await busCommand({ type: 'capture', ...(view ? { view } : {}) }))
);

server.registerTool(
  'capture_set',
  {
    description: 'Capture orbit+face+side+top PNGs. Returns { paths: { orbit, face, side, top } }.',
    inputSchema: {},
  },
  async () => toolResult(await busCommand({ type: 'capture_set' }))
);

server.registerTool(
  'undo',
  { description: 'Editor undo.', inputSchema: {} },
  async () => toolResult(await busCommand({ type: 'undo' }))
);

server.registerTool(
  'redo',
  { description: 'Editor redo.', inputSchema: {} },
  async () => toolResult(await busCommand({ type: 'redo' }))
);

server.registerTool(
  'new',
  {
    description: 'Clear editor to a new empty structure.',
    inputSchema: {
      stem: z.string().optional(),
      title: z.string().optional(),
    },
  },
  async (args) => toolResult(await busCommand({ type: 'new', ...args }))
);

server.registerTool(
  'save',
  {
    description: 'Save current structure to manuals/<stem>.manual.json via Electron IPC.',
    inputSchema: {
      stem: z.string().optional().describe('Defaults to current stem'),
    },
  },
  async ({ stem }) =>
    toolResult(await busCommand({ type: 'save', ...(stem ? { stem } : {}) }))
);

server.registerTool(
  'load',
  {
    description: 'Load manuals/<stem>.manual.json into the live editor.',
    inputSchema: {
      stem: z.string(),
    },
  },
  async ({ stem }) => toolResult(await busCommand({ type: 'load', stem }))
);

server.registerTool(
  'place_assembly',
  {
    description:
      'Merge a saved manuals/<stem>.manual.json into the current scene at world at=[sx,py,sz] (module local origin + offset). One undo. dryRun supported. Does not replace the scene (unlike load).',
    inputSchema: {
      stem: z.string().describe('Saved manual stem, e.g. 10359-fountain'),
      at: Vec3Schema.describe('World offset for the module local origin'),
      dryRun: z.boolean().optional(),
    },
  },
  async ({ stem, at, dryRun }) =>
    toolResult(
      await busCommand({
        type: 'place_assembly',
        stem,
        at,
        ...(dryRun ? { dryRun } : {}),
      })
    )
);

server.registerTool(
  'fill_rect',
  {
    description:
      'Macro: fill inclusive AABB with plates (greedy) or preferred part. dryRun supported.',
    inputSchema: {
      min: Vec3Schema,
      max: Vec3Schema,
      color: z.string(),
      part: z.string().optional(),
      dryRun: z.boolean().optional(),
    },
  },
  async (args) => toolResult(await busCommand({ type: 'fill_rect', ...args }))
);

server.registerTool(
  'wall',
  {
    description:
      'Macro: thickness-1 wall along X or Z (from/to share one axis), running bond. dryRun supported.',
    inputSchema: {
      from: Vec3Schema,
      to: Vec3Schema,
      color: z.string(),
      part: z.string().optional(),
      dryRun: z.boolean().optional(),
    },
  },
  async (args) => toolResult(await busCommand({ type: 'wall', ...args }))
);

server.registerTool(
  'ring',
  {
    description:
      'Macro: hollow stud ring (raster). Default part 6141. Note: 4×4 macaroni AABB is solid — prefer this thin ring. dryRun supported.',
    inputSchema: {
      center: z.tuple([z.number(), z.number()]).describe('[cx, cz] stud centers'),
      radius: z.number(),
      y: z.number(),
      height: z.number().optional(),
      color: z.string(),
      part: z.string().optional(),
      dryRun: z.boolean().optional(),
    },
  },
  async (args) => toolResult(await busCommand({ type: 'ring', ...args }))
);

server.registerTool(
  'disc',
  {
    description: 'Macro: filled stud disc (raster). Default part 6141. dryRun supported.',
    inputSchema: {
      center: z.tuple([z.number(), z.number()]),
      radius: z.number(),
      y: z.number(),
      height: z.number().optional(),
      color: z.string(),
      part: z.string().optional(),
      dryRun: z.boolean().optional(),
    },
  },
  async (args) => toolResult(await busCommand({ type: 'disc', ...args }))
);

server.registerTool(
  'column',
  {
    description: 'Macro: stack part count times upward by footprint Y. dryRun supported.',
    inputSchema: {
      part: z.string(),
      color: z.string(),
      at: Vec3Schema,
      count: z.number().int().positive(),
      rot: RotSchema.optional(),
      dryRun: z.boolean().optional(),
    },
  },
  async (args) => toolResult(await busCommand({ type: 'column', ...args }))
);

server.registerTool(
  'promote_parts',
  {
    description:
      'CF1c: resolve design ids against master-index → registerPartRuntime + staging. persist=true merges into parts.json via IPC. Prefer promote_bom after CLI catalog:promote-set.',
    inputSchema: {
      ids: z.array(z.string()).min(1),
      persist: z.boolean().optional(),
      setNum: z.string().optional().describe('Optional label for the report'),
    },
  },
  async ({ ids, persist, setNum }) =>
    toolResult(
      await busCommand({
        type: 'promote_parts',
        ids,
        ...(persist ? { persist } : {}),
        ...(setNum ? { setNum } : {}),
      })
    )
);

server.registerTool(
  'promote_status',
  {
    description: 'CF1c: seedCount / runtimeCount / stagingCount for the live catalog.',
    inputSchema: {},
  },
  async () => toolResult(await busCommand({ type: 'promote_status' }))
);

server.registerTool(
  'promote_bom',
  {
    description:
      'CF1c: load /catalog/bom/<setNum>.json (from pnpm catalog:promote-set) then promote_parts. persist optional.',
    inputSchema: {
      setNum: z.string().describe('e.g. 10359'),
      persist: z.boolean().optional(),
    },
  },
  async ({ setNum, persist }) =>
    toolResult(
      await busCommand({
        type: 'promote_bom',
        setNum,
        ...(persist ? { persist } : {}),
      })
    )
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[brick-lab-mcp] stdio server ready →', BUS_URL);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
