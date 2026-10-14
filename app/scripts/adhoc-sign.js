// Runs after the Mac app is packed. Apple Silicon Macs refuse to run an app that has no signature at all and show
// "Face Projection is damaged and can't be opened". An "ad-hoc" signature (no Apple developer account needed) fixes that,
// so the app only needs the usual "open anyway" step.
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  console.log('  • ad-hoc signing', app);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' });
};
