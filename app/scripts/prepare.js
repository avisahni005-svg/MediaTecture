// Builds the pieces the app loads from the shared web pages in ../simple:
//   vendor/   the libraries (p5, ml5, PeerJS) copied from node_modules, so the app does not load them from the internet
//   renderer/ copies of the sketch and controller pages that point at those local libraries
// The pages in ../simple are the single source of truth: the same files run in a browser and inside the app.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const simple = path.join(root, '..', 'simple');

const libs = [
  { from: 'node_modules/p5/lib/p5.min.js', to: 'vendor/p5.min.js', cdn: 'https://cdn.jsdelivr.net/npm/p5@1.9.4/lib/p5.min.js' },
  { from: null, to: 'vendor/ml5.min.js', cdn: 'https://unpkg.com/ml5@1/dist/ml5.min.js' }, // fetched below (see fetchMl5)
  { from: 'node_modules/peerjs/dist/peerjs.min.js', to: 'vendor/peerjs.min.js', cdn: 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js' },
];

fs.mkdirSync(path.join(root, 'vendor'), { recursive: true });
fs.mkdirSync(path.join(root, 'renderer'), { recursive: true });

// ml5 is not installed with npm because its install step breaks when it is used as a dependency (it runs a
// developer-only tool). Download the single built file instead, once.
async function fetchMl5() {
  const target = path.join(root, 'vendor/ml5.min.js');
  if (fs.existsSync(target) && fs.statSync(target).size > 1e6) return;
  const VERSION = '1.4.0';
  try {
    const res = await fetch(`https://unpkg.com/ml5@${VERSION}/dist/ml5.min.js`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    fs.writeFileSync(target, Buffer.from(await res.arrayBuffer()));
  } catch (e) {
    // fall back to the npm registry: download the package archive and take the built file out of it
    console.log('unpkg failed (' + e.message + '), trying the npm registry');
    const { execSync } = require('child_process');
    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'ml5-'));
    execSync(`npm pack ml5@${VERSION} --silent`, { cwd: tmp, stdio: 'ignore' });
    execSync(`tar -xzf ml5-${VERSION}.tgz package/dist/ml5.min.js`, { cwd: tmp });
    fs.copyFileSync(path.join(tmp, 'package/dist/ml5.min.js'), target);
  }
}

async function main() {
  await fetchMl5();
  for (const lib of libs) if (lib.from) fs.copyFileSync(path.join(root, lib.from), path.join(root, lib.to));

  for (const page of ['sketch.html', 'controller.html']) {
    let html = fs.readFileSync(path.join(simple, page), 'utf8');
    for (const lib of libs) {
      if (html.includes(lib.cdn)) html = html.split(lib.cdn).join('../' + lib.to);
    }
    const left = html.match(/src="https?:\/\/[^"]+"/g);
    if (left) throw new Error(`${page} still loads from the internet: ${left.join(', ')}`);
    fs.writeFileSync(path.join(root, 'renderer', page), html);
  }
  console.log('prepared vendor/ and renderer/');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
