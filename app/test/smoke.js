// Automated check: starts the real app (headless), turns on the second display, and writes screenshots and a report.
// Run:  xvfb-run -a npx electron --no-sandbox test/smoke.js /some/output/folder
process.env.FP_TEST = '1';
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const out = process.argv[process.argv.length - 1];
const main = require('../main.js');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  await wait(7000);
  const report = {};
  let { outputs, controlWin } = main.getWindows();
  report.atStart = { A: !!outputs[0] && !outputs[0].isDestroyed(), B: !!outputs[1] && !outputs[1].isDestroyed(), control: !!controlWin };

  main.applyOutput(1, { enabled: true }); // switch the second display on
  await wait(7000);
  ({ outputs, controlWin } = main.getWindows());
  report.afterEnablingB = { A: !!outputs[0] && !outputs[0].isDestroyed(), B: !!outputs[1] && !outputs[1].isDestroyed() };

  const probe = (w) =>
    w.webContents.executeJavaScript(
      `({ title: document.title, pairing: PAIRING_CODE, display: DISPLAY_LABEL, canvas: [document.querySelector('canvas').width, document.querySelector('canvas').height], video: video.elt.videoWidth + 'x' + video.elt.videoHeight })`
    );
  report.windowTitles = outputs.map((w) => w && w.getTitle());
  report.windowBounds = outputs.map((w) => w && w.getBounds());
  report.sketchA = await probe(outputs[0]);
  report.sketchB = await probe(outputs[1]);
  report.controlText = await controlWin.webContents.executeJavaScript(`[...document.querySelectorAll('.card h3')].map((h) => h.textContent.trim()).join(' | ') + ' || selects: ' + document.querySelectorAll('.card select').length`);
  fs.writeFileSync(path.join(out, 'displayA.png'), (await outputs[0].webContents.capturePage()).toPNG());
  fs.writeFileSync(path.join(out, 'displayB.png'), (await outputs[1].webContents.capturePage()).toPNG());
  fs.writeFileSync(path.join(out, 'control.png'), (await controlWin.webContents.capturePage()).toPNG());

  main.applyOutput(1, { enabled: false }); // and off again
  await wait(1500);
  report.afterDisablingB = { B: !!main.getWindows().outputs[1] && !main.getWindows().outputs[1].isDestroyed() };
  report.settings = main.getSettings();
  report.rendererErrors = main.rendererErrors;
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  app.exit(0);
});
