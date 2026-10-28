// Face Projection desktop app (Mac).
//   - up to TWO output windows (display A and display B). Each is its own sketch with its own controls, its own
//     camera and its own MadMapper (Syphon) source, and each can sit on a different screen.
//   - a CONTROL window picks the screen / MadMapper output for each display and shows codes (QR) to connect other devices:
//       any device can be the control panel (controller.html: one panel per display, open both to control both at once)
//       and any device can be the camera (camera.html, it feeds every open display)
const { app, BrowserWindow, Menu, screen, ipcMain, session, systemPreferences } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const QRCode = require('qrcode');

const LABELS = ['A', 'B'];
const SYPHON_NAMES = ['Face Projection', 'Face Projection 2']; // A keeps the original name so existing MadMapper projects still find it
const DEFAULT_PAGES_BASE = 'https://avisahni005-svg.github.io/MediaTecture/simple/';

// ---- settings (remembered between launches) ----
let settingsFile;
let settings;
const randomCode = () => 'FP-' + crypto.randomBytes(5).toString('hex').toUpperCase();
const newOutput = (enabled) => ({
  enabled,            // is this display running
  displayId: null,    // which screen it opens on (null = pick automatically)
  fullscreen: false,  // true = macOS full screen on that screen (Esc leaves it); false = an ordinary window
  windowBounds: null, // where the window was last left, and how big
  syphon: false,      // send this display's picture to MadMapper
});

function loadSettings() {
  settingsFile = path.join(app.getPath('userData'), 'settings.json');
  const defaults = {
    version: 3,
    pairingCode: randomCode(),
    pagesBase: DEFAULT_PAGES_BASE, // where the control panel / camera pages for other devices are hosted
    swapRB: false,                 // fix for MadMapper showing red and blue swapped
    flipV: true,                   // fix for MadMapper showing the picture upside down
    outputs: [newOutput(true), newOutput(false)],
  };
  try {
    const saved = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    if (!saved.outputs) {
      // settings from the one-display versions: that single display becomes display A
      saved.outputs = [
        { ...newOutput(true), displayId: saved.displayId ?? null, fullscreen: !!saved.fullscreen, windowBounds: saved.windowBounds || null, syphon: !!saved.syphon },
        newOutput(false),
      ];
      // the very first version forced a full-screen window that could not be minimized: start in a normal window
      if (!saved.version || saved.version < 2) {
        saved.outputs[0].fullscreen = false;
        saved.outputs[0].windowBounds = null;
      }
    }
    settings = { ...defaults, ...saved, version: 3 };
    settings.outputs = [0, 1].map((i) => ({ ...newOutput(i === 0), ...(saved.outputs[i] || {}) }));
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

// ---- the two outputs ----
const newRuntime = () => ({ win: null, syphonServer: null, syphonMessage: '', syphonSize: null, bridge: { controllers: 0, remoteCameras: 0, people: 0 } });
const outs = [newRuntime(), newRuntime()];
let controlWin = null;
const rendererErrors = [];

const codeFor = (i) => settings.pairingCode + (i === 1 ? '-B' : '');
const allDisplays = () => screen.getAllDisplays();
const alive = (i) => outs[i].win && !outs[i].win.isDestroyed();

// the chosen screen; otherwise display A prefers an external screen, and display B prefers a different one from A
function currentDisplay(i) {
  const all = allDisplays();
  const chosen = all.find((d) => d.id === settings.outputs[i].displayId);
  if (chosen) return chosen;
  const primary = screen.getPrimaryDisplay();
  const external = all.filter((d) => d.id !== primary.id);
  if (i === 0) return external[0] || primary;
  const a = currentDisplay(0);
  return external.find((d) => d.id !== a.id) || all.find((d) => d.id !== a.id) || a;
}

function createOutputWindow(i) {
  const o = settings.outputs[i];
  const out = outs[i];
  if (alive(i)) out.win.destroy();
  const d = currentDisplay(i);
  // a normal window: move it, resize it, minimize it. It opens where you left it, or centered on the chosen screen.
  const saved = o.windowBounds;
  const w = saved ? saved.width : 1280;
  const h = saved ? saved.height : 720;
  const onDisplay = (b) => b.x >= d.bounds.x - 50 && b.y >= d.bounds.y - 50 && b.x < d.bounds.x + d.bounds.width && b.y < d.bounds.y + d.bounds.height;
  const shift = i === 1 && currentDisplay(0).id === d.id ? 60 : 0; // two windows on one screen: do not stack them exactly
  const x = (saved && onDisplay(saved) ? saved.x : d.bounds.x + Math.round((d.bounds.width - w) / 2)) + shift;
  const y = (saved && onDisplay(saved) ? saved.y : d.bounds.y + Math.round((d.bounds.height - h) / 2)) + shift;
  const win = new BrowserWindow({
    x, y, width: w, height: h,
    minWidth: 320,
    minHeight: 200,
    show: false,
    backgroundColor: '#000000',
    title: `Face Projection Output ${LABELS[i]}`,
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
  out.win = win;
  win.loadFile(path.join(__dirname, 'renderer', 'sketch.html'), { hash: codeFor(i) });
  win.once('ready-to-show', () => {
    win.show();
    if (o.fullscreen) win.setFullScreen(true);
  });
  win.webContents.on('did-finish-load', () => {
    win.setTitle(`Face Projection Output ${LABELS[i]}`); // the page sets its own title: keep ours so the two windows are easy to tell apart
    if (o.syphon) attachSyphon(i);
  });
  win.webContents.on('page-title-updated', (e) => e.preventDefault());
  win.webContents.on('console-message', (_e, level, message) => {
    if (level >= 3) rendererErrors.push(`[${LABELS[i]}] ${message}`);
  });

  // hide the mouse arrow only while in full screen
  let hideCursorKey = null;
  win.on('enter-full-screen', async () => {
    hideCursorKey = await win.webContents.insertCSS('* { cursor: none !important; }');
    if (!o.fullscreen) {
      o.fullscreen = true;
      saveSettings();
      pushState();
    }
  });
  win.on('leave-full-screen', () => {
    if (hideCursorKey) win.webContents.removeInsertedCSS(hideCursorKey).catch(() => {});
    hideCursorKey = null;
    if (o.fullscreen) {
      o.fullscreen = false;
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
      o.windowBounds = win.getBounds();
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
    detachSyphon(i);
    if (out.win === win) out.win = null;
    out.bridge = { controllers: 0, remoteCameras: 0, people: 0 };
    pushState();
  });
}

function destroyOutputWindow(i) {
  detachSyphon(i);
  if (alive(i)) outs[i].win.destroy();
  outs[i].win = null;
  outs[i].bridge = { controllers: 0, remoteCameras: 0, people: 0 };
}

function showOutput(i) {
  if (!settings.outputs[i].enabled) return;
  const out = outs[i];
  if (!alive(i)) createOutputWindow(i);
  else {
    if (out.win.isMinimized()) out.win.restore();
    out.win.show();
    out.win.focus();
  }
}

function createControlWindow() {
  if (controlWin && !controlWin.isDestroyed()) {
    controlWin.show();
    controlWin.focus();
    return;
  }
  controlWin = new BrowserWindow({
    width: 560,
    height: 900,
    title: 'Face Projection',
    backgroundColor: '#0b0b0b',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  controlWin.loadFile(path.join(__dirname, 'ui', 'control.html'));
  controlWin.on('closed', () => (controlWin = null));
}

// a control panel for ONE display, in its own window (open both to control both displays at once)
const panelWins = [null, null];
function openControlPanelHere(i = 0) {
  if (panelWins[i] && !panelWins[i].isDestroyed()) {
    panelWins[i].show();
    panelWins[i].focus();
    return;
  }
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    x: 60 + i * 80,
    y: 60 + i * 60,
    title: `Face Projection Control Panel: Display ${LABELS[i]}`,
    backgroundColor: '#111111',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  win.on('page-title-updated', (e) => e.preventDefault()); // keep the title that says which display it controls
  win.on('closed', () => (panelWins[i] = null));
  panelWins[i] = win;
  win.loadFile(path.join(__dirname, 'renderer', 'controller.html'), { hash: codeFor(i) });
}

// ---- MadMapper output through Syphon (macOS only): one source per display ----
const syphonAvailable = () => process.platform === 'darwin';

function attachSyphon(i) {
  detachSyphon(i);
  const out = outs[i];
  if (!syphonAvailable()) {
    out.syphonMessage = 'Syphon only exists on macOS.';
    return;
  }
  if (!alive(i)) {
    out.syphonMessage = 'This display is not running.';
    return;
  }
  try {
    const { SyphonMetalServer } = require('node-syphon');
    out.syphonServer = new SyphonMetalServer(SYPHON_NAMES[i]);
  } catch (e) {
    out.syphonServer = null;
    out.syphonMessage = 'Could not start Syphon: ' + e.message;
    return;
  }
  out.syphonMessage = `Publishing "${SYPHON_NAMES[i]}". In MadMapper pick it as a Syphon input.`;
  // Sending the picture to Syphon is expensive (a full-size copy of every frame), so it is kept cheap:
  //  - at most ~30 pictures a second, and never queue up behind a slow one
  //  - the picture is sent at the window's normal size, not the doubled size of a Retina screen (a quarter of the data)
  //  - red/blue swapping is done four bytes at a time, in place
  let lastSent = 0;
  out.win.webContents.beginFrameSubscription(true, (image) => {
    if (!out.syphonServer) return;
    const now = Date.now();
    if (now - lastSent < 33) return;
    lastSent = now;
    try {
      const scale = screen.getDisplayMatching(out.win.getBounds()).scaleFactor || 1;
      const size = image.getSize();
      if (!size.width || !size.height) return;
      if (scale > 1) image = image.resize({ width: Math.round(size.width / scale), height: Math.round(size.height / scale), quality: 'good' });
      const { width, height } = image.getSize();
      out.syphonSize = { width, height };
      const bmp = image.toBitmap(); // BGRA, top row first (a fresh copy, so it can be changed in place)
      if (settings.swapRB && bmp.byteOffset % 4 === 0) {
        const px = new Uint32Array(bmp.buffer, bmp.byteOffset, bmp.length >> 2);
        for (let p = 0; p < px.length; p++) {
          const v = px[p];
          px[p] = (v & 0xff00ff00) | ((v & 0xff) << 16) | ((v >>> 16) & 0xff); // little-endian: swap the first and third byte
        }
      } else if (settings.swapRB) {
        for (let p = 0; p + 3 < bmp.length; p += 4) {
          const t = bmp[p];
          bmp[p] = bmp[p + 2];
          bmp[p + 2] = t;
        }
      }
      const data = new Uint8ClampedArray(bmp.buffer, bmp.byteOffset, bmp.byteLength);
      out.syphonServer.publishImageData(data, { x: 0, y: 0, width, height }, { width, height }, settings.flipV);
    } catch (e) {
      out.syphonMessage = 'Syphon error: ' + e.message;
    }
  });
}

function detachSyphon(i) {
  const out = outs[i];
  if (alive(i)) {
    try { out.win.webContents.endFrameSubscription(); } catch (e) {}
  }
  if (out.syphonServer) {
    try { out.syphonServer.dispose(); } catch (e) {}
    out.syphonServer = null;
  }
  out.syphonSize = null;
}

// ---- changes from the control window / menu ----
function applyOutput(i, patch) {
  const o = settings.outputs[i];
  const before = { ...o };
  Object.assign(o, patch);
  saveSettings();

  if (patch.enabled !== undefined && patch.enabled !== before.enabled) {
    if (o.enabled) createOutputWindow(i);
    else destroyOutputWindow(i);
  }
  if (alive(i)) {
    if (patch.fullscreen !== undefined && patch.fullscreen !== before.fullscreen) outs[i].win.setFullScreen(!!o.fullscreen);
    if (patch.displayId !== undefined && patch.displayId !== before.displayId) moveOutputToDisplay(i);
  }
  if (patch.syphon !== undefined && patch.syphon !== before.syphon) {
    if (o.syphon) attachSyphon(i);
    else {
      detachSyphon(i);
      outs[i].syphonMessage = '';
    }
  }
  buildMenu();
  pushState();
}

function applyShared(patch) {
  const before = { ...settings };
  Object.assign(settings, patch);
  saveSettings();
  if (patch.pairingCode !== undefined && patch.pairingCode !== before.pairingCode) {
    [0, 1].forEach((i) => settings.outputs[i].enabled && createOutputWindow(i)); // new code: reload both displays
  }
  pushState();
}

// move a window onto its chosen screen (keeping its size), leaving and re-entering full screen if needed
function moveOutputToDisplay(i) {
  if (!alive(i)) return;
  const win = outs[i].win;
  const d = currentDisplay(i);
  const wasFull = win.isFullScreen();
  const move = () => {
    if (win.isDestroyed()) return;
    const b = win.getBounds();
    const w = Math.min(b.width, d.bounds.width);
    const h = Math.min(b.height, d.bounds.height);
    win.setBounds({ x: d.bounds.x + Math.round((d.bounds.width - w) / 2), y: d.bounds.y + Math.round((d.bounds.height - h) / 2), width: w, height: h });
    if (wasFull) setTimeout(() => !win.isDestroyed() && win.setFullScreen(true), 300);
  };
  if (wasFull) {
    win.once('leave-full-screen', () => setTimeout(move, 300));
    win.setFullScreen(false);
  } else {
    move();
  }
}

async function buildState() {
  const pages = settings.pagesBase.endsWith('/') ? settings.pagesBase : settings.pagesBase + '/';
  const urls = {
    controllerA: `${pages}controller.html#${codeFor(0)}`,
    controllerB: `${pages}controller.html#${codeFor(1)}`,
    camera: `${pages}camera.html#${settings.pairingCode}`,
  };
  const qr = {
    controllerA: await QRCode.toDataURL(urls.controllerA, { margin: 1, width: 240 }),
    controllerB: await QRCode.toDataURL(urls.controllerB, { margin: 1, width: 240 }),
    camera: await QRCode.toDataURL(urls.camera, { margin: 1, width: 240 }),
  };
  const primary = screen.getPrimaryDisplay().id;
  return {
    shared: { pairingCode: settings.pairingCode, pagesBase: settings.pagesBase, swapRB: settings.swapRB, flipV: settings.flipV },
    urls,
    qr,
    syphonAvailable: syphonAvailable(),
    outputs: [0, 1].map((i) => {
      const current = currentDisplay(i).id;
      return {
        index: i,
        label: LABELS[i],
        settings: settings.outputs[i],
        displays: allDisplays().map((d, n) => ({
          id: d.id,
          label: `${d.label || 'Display ' + (n + 1)}  ${d.bounds.width}x${d.bounds.height}${d.id === primary ? '  (main)' : ''}`,
          current: d.id === current,
        })),
        syphon: { running: !!outs[i].syphonServer, message: outs[i].syphonMessage, size: outs[i].syphonSize, name: SYPHON_NAMES[i] },
        bridge: outs[i].bridge,
        open: alive(i),
      };
    }),
  };
}

async function pushState() {
  if (controlWin && !controlWin.isDestroyed()) controlWin.webContents.send('state', await buildState());
}

ipcMain.handle('control:get', () => buildState());
ipcMain.handle('control:setShared', async (_e, patch) => {
  applyShared(patch);
  return buildState();
});
ipcMain.handle('control:setOutput', async (_e, index, patch) => {
  applyOutput(index, patch);
  return buildState();
});
ipcMain.handle('control:action', async (_e, name, index) => {
  if (name === 'newCode') applyShared({ pairingCode: randomCode() });
  if (name === 'openController') openControlPanelHere(index || 0);
  if (name === 'reloadOutput' && settings.outputs[index].enabled) createOutputWindow(index);
  if (name === 'showOutput') showOutput(index);
  return buildState();
});
ipcMain.on('show-output', (_e, index) => showOutput(index));
ipcMain.on('from-sketch', (e, channel, data) => {
  const i = outs.findIndex((o) => o.win && !o.win.isDestroyed() && o.win.webContents === e.sender);
  if (i >= 0 && channel === 'status') {
    outs[i].bridge = data;
    pushState();
  }
});

// ---- menu ----
function buildMenu() {
  const outputMenu = (i) => ({
    label: `Display ${LABELS[i]}`,
    submenu: [
      { label: 'Running', type: 'checkbox', checked: settings.outputs[i].enabled, click: (item) => applyOutput(i, { enabled: item.checked }) },
      { label: 'Show Window', accelerator: `CmdOrCtrl+${i + 2}`, click: () => showOutput(i) },
      {
        label: 'Screen',
        submenu: allDisplays().map((d, n) => ({
          label: `${d.label || 'Display ' + (n + 1)} (${d.bounds.width}x${d.bounds.height})`,
          type: 'radio',
          checked: d.id === currentDisplay(i).id,
          click: () => applyOutput(i, { displayId: d.id }),
        })),
      },
      { label: 'Full Screen', type: 'checkbox', checked: settings.outputs[i].fullscreen, click: (item) => applyOutput(i, { fullscreen: item.checked }) },
      { label: 'Send to MadMapper (Syphon)', type: 'checkbox', checked: settings.outputs[i].syphon, enabled: syphonAvailable(), click: (item) => applyOutput(i, { syphon: item.checked }) },
      { label: 'Reload', click: () => settings.outputs[i].enabled && createOutputWindow(i) },
    ],
  });
  const template = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    {
      label: 'Output',
      submenu: [
        { label: 'Show Control Window', accelerator: 'CmdOrCtrl+1', click: createControlWindow },
        { type: 'separator' },
        outputMenu(0),
        outputMenu(1),
        { type: 'separator' },
        { label: 'Open Control Panel for Display A', click: () => openControlPanelHere(0) },
        { label: 'Open Control Panel for Display B', click: () => openControlPanelHere(1) },
      ],
    },
    { role: 'editMenu' },
    { role: 'windowMenu' },
    {
      label: 'Help',
      submenu: [
        { label: 'Developer Tools (display A)', click: () => alive(0) && outs[0].win.webContents.openDevTools({ mode: 'detach' }) },
        { label: 'Developer Tools (display B)', click: () => alive(1) && outs[1].win.webContents.openDevTools({ mode: 'detach' }) },
      ],
    },
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
  [0, 1].forEach((i) => settings.outputs[i].enabled && createOutputWindow(i));
  createControlWindow();

  screen.on('display-added', () => { buildMenu(); pushState(); });
  screen.on('display-removed', () => { buildMenu(); pushState(); });
  screen.on('display-metrics-changed', () => pushState());
  app.on('activate', () => {
    [0, 1].forEach((i) => settings.outputs[i].enabled && !alive(i) && createOutputWindow(i));
    if (!controlWin) createControlWindow();
  });
});

app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => [0, 1].forEach(detachSyphon));

// for the automated check in test/smoke.js
module.exports = {
  getWindows: () => ({ outputs: outs.map((o) => o.win), controlWin }),
  rendererErrors,
  getSettings: () => settings,
  applyOutput,
};
