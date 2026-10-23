/**
 * @file index.ts
 * @project brick-racer
 * @author Cyril TARRIET
 * @description Electron main process: window, app:// protocol, version IPC.
 */

import { app, BrowserWindow, Menu, ipcMain, net, protocol, screen } from 'electron';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadWindowBounds, saveWindowBounds, type WindowBounds } from './windowBounds';

const APP_SCHEME = 'app';

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

function rendererRoot(): string {
  return path.join(__dirname, '../renderer');
}

function registerAppProtocol(): void {
  const root = path.resolve(rendererRoot());
  protocol.handle(APP_SCHEME, (request) => {
    const url = new URL(request.url);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/' || pathname === '') pathname = '/index.html';
    const resolved = path.resolve(root, pathname.replace(/^[/\\]+/, ''));
    const relative = path.relative(root, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return new Response('forbidden', { status: 403 });
    }
    return net.fetch(pathToFileURL(resolved).toString());
  });
}

async function loadApp(win: BrowserWindow): Promise<void> {
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) {
    await win.loadURL(devUrl);
    return;
  }
  await win.loadURL(`${APP_SCHEME}://localhost/index.html`);
}

function windowIcon(): string {
  const packed = path.join(process.resourcesPath, 'icon.ico');
  if (existsSync(packed)) return packed;
  return path.join(__dirname, '../../resources/icon.ico');
}

function boundsFile(): string {
  return path.join(app.getPath('userData'), 'window-bounds.json');
}

function rememberWindow(win: BrowserWindow): void {
  if (win.isDestroyed()) return;
  const maximized = win.isMaximized();
  const box = maximized ? win.getNormalBounds() : win.getBounds();
  const bounds: WindowBounds = {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    maximized,
  };
  saveWindowBounds(boundsFile(), bounds);
}

function createWindow(): BrowserWindow {
  const stored = loadWindowBounds(boundsFile(), screen.getPrimaryDisplay().workArea);
  const win = new BrowserWindow({
    x: stored.x,
    y: stored.y,
    width: stored.width,
    height: stored.height,
    title: 'Brick Racer',
    icon: windowIcon(),
    backgroundColor: '#12151c',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  if (stored.maximized) win.maximize();
  win.setMenu(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => rememberWindow(win), 300);
  };
  win.on('resize', schedule);
  win.on('move', schedule);
  win.on('close', () => {
    if (timer) clearTimeout(timer);
    rememberWindow(win);
  });
  void loadApp(win);
  return win;
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  if (!process.env.ELECTRON_RENDERER_URL) registerAppProtocol();
  ipcMain.handle('app-version', () => app.getVersion());
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
