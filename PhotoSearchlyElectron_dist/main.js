'use strict';

const { app, BrowserWindow, shell, ipcMain, dialog, Menu, nativeTheme } = require('electron');
const path = require('path');
const net = require('net');
const fs = require('fs');
const { spawn } = require('child_process');

// ─── Keep a reference so window isn't garbage collected ───────────────────────
let mainWindow = null;
let expressServer = null;
const EXPRESS_PORT = 5500;

// ─── Python backend ────────────────────────────────────────────────────────────
let pyProcess = null;
const PY_PORT = 5501;

// Determine which Python executable to use:
//   - Packaged app  → bundled searchly_server.exe (no Python needed on user machine)
//   - Dev (npm start) → python server.py  (requires Python + deps installed)
const IS_PACKAGED = app.isPackaged;
const PY_SERVER_EXE = IS_PACKAGED
  ? path.join(process.resourcesPath, 'python_server', 'searchly_server.exe')
  : null;
const PY_SCRIPT = path.join(__dirname, 'python_backend', 'server.py');

async function startPythonBackend() {
  return new Promise((resolve) => {

    // ── PACKAGED: use bundled .exe ─────────────────────────────────────────
    if (IS_PACKAGED && PY_SERVER_EXE && require('fs').existsSync(PY_SERVER_EXE)) {
      console.log('[Python] Using bundled searchly_server.exe');
      launchProcess(PY_SERVER_EXE, [], path.dirname(PY_SERVER_EXE));
      return;
    }

    // ── DEV: use system Python + server.py ────────────────────────────────
    const pyDir = path.join(__dirname, 'python_backend');
    const candidates = ['py', 'python', 'python3'];
    let tried = 0;

    function tryNext() {
      if (tried >= candidates.length) {
        console.warn('[Python] Python not found — fast indexing unavailable. Run setup.bat to install.');
        resolve(false);
        return;
      }
      const cmd = candidates[tried++];
      const check = spawn(cmd, ['--version'], { shell: true, windowsHide: true });
      check.on('close', (code) => {
        if (code === 0) launchProcess(cmd, [PY_SCRIPT], pyDir);
        else tryNext();
      });
      check.on('error', () => tryNext());
    }
    tryNext();

    function launchProcess(cmd, args, cwd) {
      console.log(`[Python] Launching: ${cmd} ${args.join(' ')}`);
      try {
        pyProcess = spawn(cmd, args, {
          env: { ...process.env, SEARCHLY_PY_PORT: String(PY_PORT) },
          cwd,
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: !IS_PACKAGED,
          windowsHide: true,
        });

        pyProcess.on('error', (err) => {
          console.warn('[Python] Spawn error (non-fatal):', err.message);
          pyProcess = null;
          resolve(false);
        });

        pyProcess.stdout.on('data', d => console.log('[PY]', d.toString().trim()));
        pyProcess.stderr.on('data', d => console.log('[PY-err]', d.toString().trim()));
        pyProcess.on('close', (code) => {
          console.log(`[Python] Process exited with code ${code}`);
          pyProcess = null;
        });

        // Poll until Flask is up (max 30s)
        const start = Date.now();
        const poll = setInterval(async () => {
          try {
            const http = require('http');
            const req = http.get(`http://127.0.0.1:${PY_PORT}/health`, (res) => {
              if (res.statusCode === 200) {
                clearInterval(poll);
                console.log('[Python] Backend ready ✓');
                resolve(true);
              }
            });
            req.on('error', () => {});
            req.end();
          } catch(e) {}
          if (Date.now() - start > 30000) {
            clearInterval(poll);
            console.warn('[Python] Timed out waiting for backend');
            resolve(false);
          }
        }, 500);

      } catch(err) {
        console.warn('[Python] Launch error (non-fatal):', err.message);
        pyProcess = null;
        resolve(false);
      }
    }

    tryNext();
  });
}

function stopPythonBackend() {
  if (pyProcess) {
    try { pyProcess.kill('SIGTERM'); } catch(e) {}
    pyProcess = null;
  }
}

// ─── Check if a port is already in use ────────────────────────────────────────
function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => { server.close(); resolve(true); });
    server.listen(port);
  });
}

// ─── Start the embedded Express server ────────────────────────────────────────
async function startExpressServer() {
  const free = await isPortFree(EXPRESS_PORT);
  if (!free) {
    // Port already in use — likely a second instance or leftover process
    throw new Error(
      `Port ${EXPRESS_PORT} is already in use.\n\nClose any other running instances of Photo Searchly AI and try again.`
    );
  }

  return new Promise((resolve, reject) => {
    try {
      expressServer = require('./server.js');
      setTimeout(() => {
        console.log(`[Electron] Express server running on port ${EXPRESS_PORT}`);
        resolve();
      }, 800);
    } catch (err) {
      console.error('[Electron] Failed to start Express server:', err);
      reject(err);
    }
  });
}

// ─── Create the main browser window ───────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Searchly AI',
    backgroundColor: '#000000',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
    },
    show: false,
    icon: path.join(__dirname, 'assets', 'icon.png'),
  });

  mainWindow.loadURL(`http://localhost:${EXPRESS_PORT}`);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Handle window.open() calls from the renderer
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Google OAuth popup — open in a controlled child window
    if (url.includes('accounts.google.com') || url.includes('google.com/o/oauth')) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 680,
          title: 'Sign in with Google',
          parent: mainWindow,
          modal: false,
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
          },
        },
      };
    }
    // OAuth success/callback page — allow it inside app
    if (url.startsWith(`http://localhost:${EXPRESS_PORT}`)) {
      return { action: 'allow' };
    }
    // All other external links → system browser
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── Application menu ─────────────────────────────────────────────────────────
function buildMenu() {
  const isMac = process.platform === 'darwin';
  const isDev = process.env.NODE_ENV === 'development';

  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(isDev ? [
          { type: 'separator' },
          { role: 'toggleDevTools' },
        ] : []),
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
        ] : [
          { role: 'close' },
        ]),
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Privacy Policy',
          click: () => mainWindow?.loadURL(`http://localhost:${EXPRESS_PORT}/privacy`),
        },
        {
          label: 'Report an Issue',
          click: () => shell.openExternal('mailto:support@yourdomain.com'),
        },
        ...(isDev ? [{
          label: 'Open DevTools',
          accelerator: 'F12',
          click: () => mainWindow?.webContents.toggleDevTools(),
        }] : []),
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('app:platform', () => process.platform);

// Expose bundled model paths so renderer can load from disk (no download needed)
ipcMain.handle('models:getPaths', async (event) => {
  const path = require('path');
  // In production: models are in resources/models/ next to the app
  // In dev: they're in build/models/ relative to project root
  let modelsDir;
  if (app.isPackaged) {
    modelsDir = path.join(process.resourcesPath, 'models');
  } else {
    modelsDir = path.join(__dirname, 'build', 'models');
  }
  return {
    imageModel: path.join(modelsDir, 'clip-image-vit-32-float32.onnx'),
    textModel:  path.join(modelsDir, 'clip-text-vit-32-float32-int32.onnx'),
    modelsDir
  };
});

// Read a model file and return as base64 (renderer can't use fs directly)
ipcMain.handle('models:readFile', async (event, filePath) => {
  try {
    const data = fs.readFileSync(filePath);
    return { success: true, base64: data.toString('base64'), byteLength: data.length };
  } catch(err) {
    return { success: false, error: err.message };
  }
});

// Select folder via native dialog + scan files with absolute paths
ipcMain.handle('dialog:selectFolder', async (event) => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select Photo Folder'
  });
  if (result.canceled || !result.filePaths.length) return null;
  const folderPath = result.filePaths[0];

  // Scan folder recursively and return absolute paths
  const imageExtensions = /\.(png|jpg|jpeg|webp|gif|bmp)$/i;
  const files = [];

  function scanDir(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = require('path').join(dir, entry.name);
        if (entry.isDirectory()) {
          try { scanDir(fullPath); } catch(e) {}
        } else if (imageExtensions.test(entry.name)) {
          try {
            const stat = fs.statSync(fullPath);
            files.push({
              absolutePath: fullPath,
              filename: entry.name,
              size: stat.size,
              lastModified: stat.mtimeMs
            });
          } catch(e) {}
        }
      }
    } catch(e) {}
  }

  scanDir(folderPath);
  return { folderPath, files };
});

// Read file as base64 for renderer to process with CLIP
ipcMain.handle('file:readAsBase64', async (event, absolutePath) => {
  try {
    const data = fs.readFileSync(absolutePath);
    const ext  = require('path').extname(absolutePath).slice(1).toLowerCase();
    const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
    return { success: true, base64: data.toString('base64'), mime };
  } catch(err) {
    return { success: false, error: err.message };
  }
});

// Open file location in File Explorer
ipcMain.handle('shell:showItemInFolder', async (event, filePath) => {
  try {
    const { shell } = require('electron');
    shell.showItemInFolder(filePath);
    return { success: true };
  } catch(err) {
    return { success: false, error: err.message };
  }
});

// Open a path (file or folder)
ipcMain.handle('shell:openPath', async (event, folderPath) => {
  try {
    const { shell } = require('electron');
    await shell.openPath(folderPath);
    return { success: true };
  } catch(err) {
    return { success: false, error: err.message };
  }
});

// Local file deletion — called from renderer via electronAPI.deleteLocalFile()
ipcMain.handle('file:delete', async (event, filePath) => {
  try {
    // Security check — must be an absolute path and file must exist
    if (!filePath || typeof filePath !== 'string' || !require('path').isAbsolute(filePath)) {
      return { success: false, error: 'Invalid file path' };
    }
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File does not exist' };
    }
    fs.unlinkSync(filePath);
    console.log(`[Electron] Deleted local file: ${filePath}`);
    return { success: true };
  } catch (err) {
    console.error(`[Electron] Failed to delete file: ${filePath}`, err.message);
    return { success: false, error: err.message };
  }
});

// ─── Single instance lock (prevent multiple app windows) ──────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// ─── App lifecycle ─────────────────────────────────────────────────────────────
// ─── IPC: expose Python backend port + status to renderer ─────────────────────
ipcMain.handle('python:getPort', () => PY_PORT);
ipcMain.handle('python:isReady', () => pyProcess !== null);

app.whenReady().then(async () => {
  nativeTheme.themeSource = 'dark';

  try {
    const [, pyReady] = await Promise.all([
      startExpressServer(),
      startPythonBackend(),
    ]);
    if (pyReady) console.log('[App] Python fast-indexing backend is online');
    else console.log('[App] Python backend unavailable — JS fallback active');

    buildMenu();
    createWindow();
  } catch (err) {
    dialog.showErrorBox('Startup Error', `Photo Searchly AI failed to start:\n\n${err.message}`);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopPythonBackend();
    if (expressServer && expressServer.close) expressServer.close();
    app.quit();
  }
});

app.on('before-quit', () => {
  stopPythonBackend();
  if (expressServer && expressServer.close) expressServer.close();
});
