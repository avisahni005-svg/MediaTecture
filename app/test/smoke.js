// Automated check: starts the real app (headless), waits, writes screenshots of both windows and prints what it sees.
// Run:  xvfb-run -a npx electron --no-sandbox test/smoke.js /some/output/folder
process.env.FP_TEST = '1';
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const out = process.argv[process.argv.length - 1];
const main = require('../main.js');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  await wait(9000);
  const { displayWin, controlWin } = main.getWindows();
  const report = {};
  report.windows = { display: !!displayWin && !displayWin.isDestroyed(), control: !!controlWin && !controlWin.isDestroyed() };
  report.displayBounds = displayWin && displayWin.getBounds();
  if (displayWin) {
    report.windowFeatures = { resizable: displayWin.isResizable(), minimizable: displayWin.isMinimizable(), maximizable: displayWin.isMaximizable(), fullScreenable: displayWin.isFullScreenable(), frame: !displayWin.isKiosk() };
    // try them: resize, minimize, restore
    displayWin.setBounds({ x: 50, y: 50, width: 900, height: 500 });
    await wait(500);
    report.afterResize = displayWin.getBounds();
    displayWin.minimize();
    await wait(800);
    report.minimized = displayWin.isMinimized();
    displayWin.restore();
    await wait(800);
    report.restored = !displayWin.isMinimized();
    // the sketch should now fill the new, smaller window
    report.canvasAfterResize = await displayWin.webContents.executeJavaScript('[document.querySelector("canvas").width, document.querySelector("canvas").height]');
  }
  report.displayTitle = displayWin && displayWin.getTitle();
  report.settings = main.getSettings();
  report.rendererErrors = main.rendererErrors;
  if (displayWin) {
    report.sketchState = await displayWin.webContents.executeJavaScript(
      `({ hasCanvas: !!document.querySelector('canvas'), canvas: document.querySelector('canvas') && [document.querySelector('canvas').width, document.querySelector('canvas').height], pairing: typeof PAIRING_CODE !== 'undefined' ? PAIRING_CODE : null, videoSize: typeof video !== 'undefined' && video && video.elt ? video.elt.videoWidth + 'x' + video.elt.videoHeight : null, bridge: typeof window.appBridge, bodyText: document.body.innerText.slice(0, 80) })`
    );
    fs.writeFileSync(path.join(out, 'display.png'), (await displayWin.webContents.capturePage()).toPNG());
  }
  if (controlWin) {
    report.controlText = await controlWin.webContents.executeJavaScript(`document.getElementById('code').textContent + ' | ' + document.getElementById('display').options.length + ' displays | syphon: ' + document.getElementById('syphon').textContent`);
    fs.writeFileSync(path.join(out, 'control.png'), (await controlWin.webContents.capturePage()).toPNG());
  }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  app.exit(0);
});
