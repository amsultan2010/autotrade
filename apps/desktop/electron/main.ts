/**
 * Electron main process. Creates the window and provides an OS-encrypted store
 * for the ONE secret the desktop holds: the refresh token. Market-data and
 * Stripe keys never live here — those stay on the backend (req #15).
 *
 * Security: contextIsolation on, nodeIntegration off, a narrow preload bridge.
 */
import { app, BrowserWindow, ipcMain, safeStorage, shell } from 'electron';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, rmSync, openSync } from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';

const isDev = process.env.AUTOTRADE_DEV === '1';
const tokenFile = () => join(app.getPath('userData'), 'refresh.bin');

// Where the backend lives on this machine (overridable). The packaged app runs
// it as its own database-backed server process.
const BACKEND_DIR = process.env.AUTOTRADE_BACKEND_DIR ?? 'C:\\Users\\peak\\autotrade\\apps\\backend';
const API_HEALTH = 'http://localhost:4000/health';
let backendProc: ChildProcess | null = null;

async function isBackendUp(timeoutMs = 1500): Promise<boolean> {
  try {
    const ctrl = AbortSignal.timeout(timeoutMs);
    const res = await fetch(API_HEALTH, { signal: ctrl });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForBackend(maxMs = 60_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (await isBackendUp()) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

/** Start the backend (with its own embedded DB) if it isn't already running. */
async function ensureBackend(): Promise<void> {
  if (await isBackendUp()) return; // dev backend already running — reuse it
  const entry = join(BACKEND_DIR, 'dist', 'index.js');
  if (!existsSync(entry)) return; // not built; the window will show a connection error

  const logFile = join(app.getPath('userData'), 'backend.log');
  const out = openSync(logFile, 'a');
  backendProc = spawn(process.execPath, [entry], {
    cwd: BACKEND_DIR,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', EMBEDDED_DB: 'true' },
    stdio: ['ignore', out, out],
    windowsHide: true,
  });
  await waitForBackend(60_000);
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#0b1120',
    title: 'Autotrade',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Open external links in the system browser, never in-app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    void win.loadURL('http://localhost:5173');
    // DevTools off by default for a clean window (open with Ctrl+Shift+I if needed).
  } else {
    void win.loadFile(join(__dirname, '../dist/index.html'));
  }
}

// ── Secure token storage (IPC) ──
ipcMain.handle('token:get', () => {
  try {
    const file = tokenFile();
    if (!existsSync(file)) return null;
    if (!safeStorage.isEncryptionAvailable()) return null;
    return safeStorage.decryptString(readFileSync(file));
  } catch {
    return null;
  }
});

ipcMain.handle('token:set', (_evt, token: string) => {
  if (!safeStorage.isEncryptionAvailable()) return false;
  writeFileSync(tokenFile(), safeStorage.encryptString(token));
  return true;
});

ipcMain.handle('token:clear', () => {
  try {
    rmSync(tokenFile(), { force: true });
  } catch {
    /* ignore */
  }
  return true;
});

ipcMain.handle('open-external', (_evt, url: string) => shell.openExternal(url));

/**
 * Dev-only convenience: if launched with DEV_AUTOLOGIN_EMAIL/PASSWORD, log in
 * against the backend and store the refresh token before the window opens, so
 * the app lands straight on the dashboard. Credentials come from the launch
 * environment — never hardcoded — and this is gated to dev mode.
 */
async function maybeDevAutoLogin(): Promise<void> {
  if (!isDev) return;
  const email = process.env.DEV_AUTOLOGIN_EMAIL;
  const password = process.env.DEV_AUTOLOGIN_PASSWORD;
  if (!email || !password) return;
  if (existsSync(tokenFile())) return; // already have a session
  if (!safeStorage.isEncryptionAvailable()) return;
  try {
    const api = process.env.AUTOTRADE_API_URL ?? 'http://localhost:4000/api/v1';
    const res = await fetch(`${api}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { refreshToken?: string };
    if (data.refreshToken) writeFileSync(tokenFile(), safeStorage.encryptString(data.refreshToken));
  } catch {
    /* ignore — fall back to the normal login screen */
  }
}

app.whenReady().then(async () => {
  app.setName('Autotrade');
  if (process.platform === 'win32') app.setAppUserModelId('ai.autotrade.desktop');
  // Packaged app: boot our own backend (+ embedded DB) before showing the UI.
  if (!isDev) await ensureBackend();
  await maybeDevAutoLogin();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  // Stop the backend we started so it doesn't linger.
  if (backendProc && !backendProc.killed) backendProc.kill();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
