/**
 * @file brickLabMcpBus.ts
 * @description Dev-only localhost HTTP bus for brick-lab MCP (LT4 + BA3 capture).
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { BrowserWindow, ipcMain } from 'electron';

export const BRICK_LAB_MCP_PORT = 3847;
export const BRICK_LAB_MCP_HOST = '127.0.0.1';

type Pending = {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

let server: Server | null = null;
let token = '';
let nextId = 1;
const pending = new Map<number, Pending>();

const CAPTURE_VIEWS = ['orbit', 'face', 'side', 'top'] as const;
type CaptureView = (typeof CAPTURE_VIEWS)[number];

function projectRoot(): string {
  return path.join(__dirname, '../..');
}

function tokenPath(): string {
  return path.join(projectRoot(), 'data', 'brick-lab-mcp.token');
}

function capturesDir(): string {
  return path.join(projectRoot(), 'data', 'brick-lab-captures');
}

function ensureToken(): string {
  const dir = path.join(projectRoot(), 'data');
  mkdirSync(dir, { recursive: true });
  const file = tokenPath();
  token = randomBytes(24).toString('hex');
  writeFileSync(file, `${token}\n`, 'utf8');
  return token;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const raw = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(raw),
  });
  res.end(raw);
}

function authOk(req: IncomingMessage): boolean {
  const h = req.headers.authorization ?? '';
  return h === `Bearer ${token}`;
}

function targetWindow(): BrowserWindow | null {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && !focused.isDestroyed()) return focused;
  const all = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
  return all[0] ?? null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function dispatchToRenderer(cmd: unknown, timeoutMs = 8000): Promise<unknown> {
  const win = targetWindow();
  if (!win) return Promise.reject(new Error('aucune fenêtre Electron'));
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`timeout renderer (${timeoutMs}ms) — brick-lab ouvert ?`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    win.webContents.send('brick-lab-mcp-cmd', id, cmd);
  });
}

function isCaptureView(v: unknown): v is CaptureView {
  return typeof v === 'string' && (CAPTURE_VIEWS as readonly string[]).includes(v);
}

async function captureOne(view?: CaptureView): Promise<{ ok: boolean; path?: string; error?: string; view?: string }> {
  const win = targetWindow();
  if (!win) return { ok: false, error: 'aucune fenêtre Electron' };

  if (view) {
    const setRes = (await dispatchToRenderer({ type: 'set_view', view }, 10000)) as {
      ok?: boolean;
      error?: string;
    };
    if (!setRes?.ok) {
      return { ok: false, error: setRes?.error ?? 'set_view échoué' };
    }
    await sleep(120);
  }

  const meta = (await dispatchToRenderer({ type: 'capture_meta' }, 8000)) as {
    ok?: boolean;
    stem?: string;
    error?: string;
  };
  if (!meta?.ok) {
    return { ok: false, error: meta?.error ?? 'capture_meta échoué' };
  }

  const stem = String(meta.stem ?? 'untitled').replace(/[^\w.-]+/g, '_');
  const viewLabel = view ?? 'current';
  const ts = Date.now();
  mkdirSync(capturesDir(), { recursive: true });
  const fileName = `${stem}-${viewLabel}-${ts}.png`;
  const outPath = path.join(capturesDir(), fileName);

  const image = await win.webContents.capturePage();
  writeFileSync(outPath, image.toPNG());
  return { ok: true, path: outPath, view: viewLabel };
}

async function handleCapture(body: { type: string; view?: unknown }): Promise<unknown> {
  if (body.type === 'capture') {
    const view = body.view != null ? (isCaptureView(body.view) ? body.view : null) : undefined;
    if (body.view != null && view === null) {
      return { ok: false, error: 'view invalide' };
    }
    return captureOne(view === null ? undefined : view);
  }

  if (body.type === 'capture_set') {
    const paths: Record<string, string> = {};
    for (const view of CAPTURE_VIEWS) {
      const one = await captureOne(view);
      if (!one.ok || !one.path) {
        return { ok: false, error: one.error ?? `capture ${view} échouée`, paths };
      }
      paths[view] = one.path;
    }
    return { ok: true, paths };
  }

  return { ok: false, error: 'type capture inconnu' };
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', `http://${BRICK_LAB_MCP_HOST}:${BRICK_LAB_MCP_PORT}`);
  if (req.method === 'GET' && url.pathname === '/v1/health') {
    json(res, 200, { ok: true, service: 'brick-lab-mcp-bus', port: BRICK_LAB_MCP_PORT });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/v1/command') {
    if (!authOk(req)) {
      json(res, 401, { ok: false, error: 'unauthorized' });
      return;
    }
    let body: unknown;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      json(res, 400, { ok: false, error: 'invalid json' });
      return;
    }
    try {
      const type =
        body && typeof body === 'object' && 'type' in body
          ? String((body as { type: unknown }).type)
          : '';
      if (type === 'capture' || type === 'capture_set') {
        const result = await handleCapture(body as { type: string; view?: unknown });
        json(res, 200, result);
        return;
      }
      const result = await dispatchToRenderer(body);
      json(res, 200, result);
    } catch (err) {
      json(res, 503, {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }
  json(res, 404, { ok: false, error: 'not found' });
}

/** Start only under electron-vite dev (`ELECTRON_RENDERER_URL`). */
export function startBrickLabMcpBus(): void {
  if (!process.env.ELECTRON_RENDERER_URL) return;
  if (server) return;
  ensureToken();
  ipcMain.on('brick-lab-mcp-reply', (_evt, id: unknown, result: unknown) => {
    const n = Number(id);
    const p = pending.get(n);
    if (!p) return;
    clearTimeout(p.timer);
    pending.delete(n);
    p.resolve(result);
  });
  server = createServer((req, res) => {
    void handleRequest(req, res);
  });
  server.listen(BRICK_LAB_MCP_PORT, BRICK_LAB_MCP_HOST, () => {
    console.log(
      `[brick-lab-mcp] bus http://${BRICK_LAB_MCP_HOST}:${BRICK_LAB_MCP_PORT} · token ${tokenPath()}`
    );
  });
  server.on('error', (err) => {
    console.warn('[brick-lab-mcp] bus error', err);
  });
}

export function stopBrickLabMcpBus(): void {
  for (const p of pending.values()) {
    clearTimeout(p.timer);
    p.reject(new Error('bus stopped'));
  }
  pending.clear();
  server?.close();
  server = null;
}

export function brickLabMcpTokenFileExists(): boolean {
  return existsSync(tokenPath());
}
