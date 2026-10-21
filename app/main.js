// Face Projection desktop app.
//   - an OUTPUT window shows the sketch full screen on whichever display you choose
//   - optionally it also sends the picture to MadMapper (or any Syphon app) on macOS
//   - a CONTROL window picks the display / MadMapper output and shows codes (QR) to connect other devices:
//       any device can be the control panel (controller.html) and any device can be the camera (camera.html)
const { app, BrowserWindow, Menu, screen, ipcMain, session, systemPreferences, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const QRCode = require('qrcode');

const SYPHON_NAME = 'Face Projection';
const DEFAULT_PAGES_BASE = 'https://avisahni005-svg.github.io/MediaTecture/simple/';

// ---- settings (remembered between launches) ----
let settingsFile;
let settings;
const randomCode = () => 'FP-' + crypto.randomBytes(5).toString('hex').toUpperCase();

function loadSettings() {
  settingsFile = path.join(app.getPath('userData'), 'settings.json');
  const defaults = {
    displayId: null,       // which display the output goes to (null = pick automatically)
    fullscreen: false,     // true = macOS full screen on that display (Esc leaves it); false = an ordinary window
    windowBounds: null,    // where the output window was last left, and how big
    syphon: false,         // send the picture to MadMapper
    swapRB: false,         // fix for MadMapper showing red and blue swapped
    flipV: true,           // fix for MadMapper showing the picture upside down
    version: 2,
    pairingCode: randomCode(),
    pagesBase: DEFAULT_PAGES_BASE, // where the control panel / camera pages for other devices are hosted
  };
  try {
    const saved = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    // the first version forced a full-screen window that could not be minimized: start everyone in a normal window
    if (!saved.version || saved.version < 2) {
      saved.fullscreen = false;
      saved.windowBounds = null;
    }
    settings = { ...defaults, ...saved, version: 2 };
  } catch (e) {
    settings = defaults;
  }
  saveSettings();
}
function saveSettings() {
  try {
    fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
  } catch (e) {
    console.warn('could not save settings', e.message);
  }
}

// ---- windows ----
let displayWin = null;
let controlWin = null;
let bridge = { controllers: 0, remoteCameras: 0, people: 0 }; // what the output page reports
const rendererErrors = [];

function allDisplays() {
  return screen.getAllDisplays();
}
// the chosen display, or the first external one, or the main one
function currentDisplay() {
  const all = allDisplays();
  return all.find((d) => d.id === settings.displayId) || all.find((d) => d.id !== screen.getPrimaryDisplay().id) || screen.getPrimaryDisplay();
}

function createDisplayWindow() {
  if (displayWin && !displayWin.isDestroyed()) displayWin.destroy();
  const d = currentDisplay();
  // a normal window: move it, resize it, minimize it. It opens where you left it, or centered on the chosen display.
  const saved = settings.windowBounds;
  const w = saved ? saved.width : 1280;
  const h = saved ? saved.height : 720;
  const onDisplay = (b) => b.x >= d.bounds.x - 50 && b.y >= d.bounds.y - 50 && b.x < d.bounds.x + d.bounds.width && b.y < d.bounds.y + d.bounds.height;
  const x = saved && onDisplay(saved) ? saved.x : d.bounds.x + Math.round((d.bounds.width - w) / 2);
  const y = saved && onDisplay(saved) ? saved.y : d.bounds.y + Math.round((d.bounds.height - h) / 2);
  const win = new BrowserWindow({
    x, y, width: w, height: h,
    minWidth: 320,
    minHeight: 200,
    show: false,
    backgroundColor: '#000000',
    title: 'Face Projection Output',
    resizable: true,
    minimizable: true,
    maximizable: true,
    fullscreenable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false, // keep drawing at full speed even when it is behind other windows
      autoplayPolicy: 'no-user-gesture-required',
    },
  });
  displayWin = win;
  win.loadFile(path.join(__dirname, 'renderer', 'sketch.html'), { hash: settings.pairingCode });
  win.once('ready-to-show', () => {
    win.show();
    if (settings.fullscreen) win.setFullScreen(true);
  });
  win.webContents.on('did-finish-load', () => {
    if (settings.syphon) attachSyphon();
  });
  win.webContents.on('console-message', (_e, level, message) => {
    if (level >= 3) rendererErrors.push(message);
  });

  // hide the mouse arrow only while in full screen
  let hideCursorKey = null;
  win.on('enter-full-screen', async () => {
    hideCursorKey = await win.webContents.insertCSS('* { cursor: none !important; }');
    if (!settings.fullscreen) {
      settings.fullscreen = true;
      saveSettings();
      pushState();
    }
  });
  win.on('leave-full-screen', () => {
    if (hideCursorKey) win.webContents.removeInsertedCSS(hideCursorKey).catch(() => {});
    hideCursorKey = null;
    if (settings.fullscreen) {
      settings.fullscreen = false;
      saveSettings();
      pushState();
    }
  });

  // remember the size and place, so it opens the same next time
  let saveTimer = null;
  const rememberBounds = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (win.isDestroyed() || win.isFullScreen() || win.isMinimized()) return;
      settings.windowBounds = win.getBounds();
      saveSettings();
    }, 500);
  };
  win.on('resize', rememberBounds);
  win.on('move', rememberBounds);

  // Esc leaves full screen; Cmd+F toggles it
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'Escape' && win.isFullScreen()) {
      event.preventDefault();
      win.setFullScreen(false);
    } else if (input.key.toLowerCase() === 'f' && input.meta) {
      event.preventDefault();
      win.setFullScreen(!win.isFullScreen());
    }
  });
  win.on('closed', () => {
    detachSyphon();
    if (displayWin === win) displayWin = null;
  });
}

function createControlWindow() {
  if (controlWin && !controlWin.isDestroyed()) {
    controlWin.show();
    controlWin.focus();
    return;
  }
  controlWin = new BrowserWindow({
    width: 520,
    height: 860,
    title: 'Face Projection',
    backgroundColor: '#0b0b0b',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  controlWin.loadFile(path.join(__dirname, 'ui', 'control.html'));
  controlWin.on('closed', () => (controlWin = null));
}

function openControlPanelHere() {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    title: 'Face Projection Control Panel',
    backgroundColor: '#111111',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'controller.html'), { hash: settings.pairingCode });
}

// ---- MadMapper output through Syphon (macOS only) ----
let syphonServer = null;
let syphonMessage = '';
let syphonSize = null;

function syphonAvailable() {
  return process.platform === 'darwin';
}

function attachSyphon() {
  detachSyphon();
  if (!syphonAvailable()) {
    syphonMessage = 'Syphon only exists on macOS.';
    return;
  }
  if (!displayWin || displayWin.isDestroyed()) {
    syphonMessage = 'No output window.';
    return;
  }
  try {
    const { SyphonMetalServer } = require('node-syphon');
    syphonServer = new SyphonMetalServer(SYPHON_NAME);
  } catch (e) {
    syphonServer = null;
    syphonMessage = 'Could not start Syphon: ' + e.message;
    return;
  }
  syphonMessage = `Publishing "${SYPHON_NAME}". In MadMapper pick it as a Syphon input.`;
  displayWin.webContents.beginFrameSubscription(false, (image) => {
    if (!syphonServer) return;
    const { width, height } = image.getSize();
    if (!width || !height) return;
    syphonSize = { width, height };
    const bmp = image.toBitmap(); // BGRA, top row first
    let data = new Uint8ClampedArray(bmp.buffer, bmp.byteOffset, bmp.byteLength);
    if (settings.swapRB) {
      data = Uint8ClampedArray.from(data);
      for (let i = 0; i < data.length; i += 4) {
        const t = data[i];
        data[i] = data[i + 2];
        data[i + 2] = t;
      }
    }
    try {
      syphonServer.publishImageData(data, { x: 0, y: 0, width, height }, { width, height }, settings.flipV);
    } catch (e) {
      syphonMessage = 'Syphon error: ' + e.message;
    }
  });
}

function detachSyphon() {
  if (displayWin && !displayWin.isDestroyed()) {
    try { displayWin.webContents.endFrameSubscription(); } catch (e) {}
  }
  if (syphonServer) {
    try { syphonServer.dispose(); } catch (e) {}
    syphonServer = null;
  }
  syphonSize = null;
}

// ---- settings changes from the control window / menu ----
function applySettings(patch) {
  const before = { ...settings };
  Object.assign(settings, patch);
  saveSettings();

  if (patch.fullscreen !== undefined && patch.fullscreen !== before.fullscreen) {
    if (displayWin && !displayWin.isDestroyed()) displayWin.setFullScreen(!!settings.fullscreen);
  }
  if (patch.displayId !== undefined && patch.displayId !== before.displayId) moveOutputToDisplay();
  if (patch.pairingCode !== undefined && patch.pairingCode !== before.pairingCode) createDisplayWindow();
  if (patch.syphon !== undefined && patch.syphon !== before.syphon) {
    if (settings.syphon) attachSyphon();
    else {
      detachSyphon();
      syphonMessage = '';
    }
  }
  buildMenu();
  pushState();
}

// move the output window onto the chosen display (keeping its size), leaving and re-entering full screen if needed
function moveOutputToDisplay() {
  if (!displayWin || displayWin.isDestroyed()) return;
  const d = currentDisplay();
  const wasFull = displayWin.isFullScreen();
  const move = () => {
    if (!displayWin || displayWin.isDestroyed()) return;
    const b = displayWin.getBounds();
    const w = Math.min(b.width, d.bounds.width);
    const h = Math.min(b.height, d.bounds.height);
    displayWin.setBounds({ x: d.bounds.x + Math.round((d.bounds.width - w) / 2), y: d.bounds.y + Math.round((d.bounds.height - h) / 2), width: w, height: h });
    if (wasFull) setTimeout(() => displayWin && !displayWin.isDestroyed() && displayWin.setFullScreen(true), 300);
  };
  if (wasFull) {
    displayWin.once('leave-full-screen', () => setTimeout(move, 300));
    displayWin.setFullScreen(false);
  } else {
    move();
  }
}

async function buildState() {
  const pages = settings.pagesBase.endsWith('/') ? settings.pagesBase : settings.pagesBase + '/';
  const urls = {
    controller: `${pages}controller.html#${settings.pairingCode}`,
    camera: `${pages}camera.html#${settings.pairingCode}`,
  };
  const qr = {
    controller: await QRCode.toDataURL(urls.controller, { margin: 1, width: 240 }),
    camera: await QRCode.toDataURL(urls.camera, { margin: 1, width: 240 }),
  };
  const primary = screen.getPrimaryDisplay().id;
  const current = currentDisplay().id;
  return {
    displays: allDisplays().map((d, i) => ({
      id: d.id,
      label: `${d.label || 'Display ' + (i + 1)}  ${d.bounds.width}x${d.bounds.height}${d.id === primary ? '  (main)' : ''}`,
      current: d.id === current,
    })),
    settings,
    urls,
    qr,
    syphon: { available: syphonAvailable(), running: !!syphonServer, message: syphonMessage, size: syphonSize, name: SYPHON_NAME },
    bridge,
  };
}

async function pushState() {
  if (controlWin && !controlWin.isDestroyed()) controlWin.webContents.send('state', await buildState());
}

ipcMain.handle('control:get', () => buildState());
ipcMain.handle('control:set', async (_e, patch) => {
  applySettings(patch);
  return buildState();
});
ipcMain.handle('control:action', async (_e, name) => {
  if (name === 'newCode') applySettings({ pairingCode: randomCode() });
  if (name === 'openController') openControlPanelHere();
  if (name === 'reloadOutput') createDisplayWindow();
  if (name === 'showOutput') {
    if (!displayWin || displayWin.isDestroyed()) createDisplayWindow();
    else {
      if (displayWin.isMinimized()) displayWin.restore();
      displayWin.show();
      displayWin.focus();
    }
  }
  return buildState();
});
ipcMain.on('show-output', () => {
  if (!displayWin || displayWin.isDestroyed()) createDisplayWindow();
  else {
    if (displayWin.isMinimized()) displayWin.restore();
    displayWin.show();
    displayWin.focus();
  }
});
ipcMain.on('from-sketch', (_e, channel, data) => {
  if (channel === 'status') {
    bridge = data;
    pushState();
  }
});

// ---- menu ----
function buildMenu() {
  const template = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    {
      label: 'Output',
      submenu: [
        { label: 'Show Control Window', accelerator: 'CmdOrCtrl+1', click: createControlWindow },
        { type: 'separator' },
        {
          label: 'Output Display',
          submenu: allDisplays().map((d, i) => ({
            label: `${d.label || 'Display ' + (i + 1)} (${d.bounds.width}x${d.bounds.height})`,
            type: 'radio',
            checked: d.id === currentDisplay().id,
            click: () => applySettings({ displayId: d.id }),
          })),
        },
        { label: 'Full Screen Output', type: 'checkbox', checked: settings.fullscreen, accelerator: 'CmdOrCtrl+F', click: (item) => applySettings({ fullscreen: item.checked }) },
        { label: 'Show Output Window', accelerator: 'CmdOrCtrl+2', click: () => ipcMain.emit('show-output') },
        { label: 'Send to MadMapper (Syphon)', type: 'checkbox', checked: settings.syphon, enabled: syphonAvailable(), click: (item) => applySettings({ syphon: item.checked }) },
        { type: 'separator' },
        { label: 'Reload Output', accelerator: 'CmdOrCtrl+R', click: createDisplayWindow },
        { label: 'Open Control Panel in This App', click: openControlPanelHere },
      ],
    },
    { role: 'editMenu' },
    { role: 'windowMenu' },
    { label: 'Help', submenu: [{ label: 'Developer Tools (output)', click: () => displayWin && displayWin.webContents.openDevTools({ mode: 'detach' }) }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---- start up ----
app.whenReady().then(async () => {
  loadSettings();

  if (process.env.FP_TEST) {
    app.commandLine.appendSwitch('use-fake-device-for-media-stream');
    app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
  }
  // the pages are our own: let them use the camera
  const allowMedia = (permission) => permission === 'media' || permission === 'mediaKeySystem';
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(allowMedia(permission)));
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowMedia(permission));
  if (process.platform === 'darwin') {
    try { await systemPreferences.askForMediaAccess('camera'); } catch (e) {}
  }

  buildMenu();
  createDisplayWindow();
  createControlWindow();

  screen.on('display-added', () => { buildMenu(); pushState(); });
  screen.on('display-removed', () => {
    buildMenu();
    pushState();
  });
  screen.on('display-metrics-changed', () => pushState());
  app.on('activate', () => {
    if (!displayWin) createDisplayWindow();
    if (!controlWin) createControlWindow();
  });
});

app.on('window-all-closed', () => app.quit());
app.on('before-quit', detachSyphon);

// for the automated check in test/smoke.js
module.exports = { getWindows: () => ({ displayWin, controlWin }), rendererErrors, getSettings: () => settings };
