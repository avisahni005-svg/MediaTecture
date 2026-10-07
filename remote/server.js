// Relay for the face projection sketch.
//   laptop:  http://localhost:3000/sketch      (webcam + canvas, no controls)
//   iPad:    http://<laptop-ip>:3000/controller (all the buttons and sliders)
// The controller sends commands, the server forwards them to the sketch, and the sketch
// sends its state back so every controller shows what is really happening.

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT) || 3000;

// only these files are ever served
const PAGES = {
  '/': 'index.html',
  '/sketch': 'sketch.html',
  '/controller': 'controller.html',
};

function lanUrls() {
  const urls = [];
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) urls.push(`http://${a.address}:${PORT}`);
    }
  }
  return urls;
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/info') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ urls: lanUrls() }));
    return;
  }
  const file = PAGES[url];
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }
  fs.readFile(path.join(__dirname, file), (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Could not read ' + file);
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });

const sketches = new Set();
const controllers = new Set();
let lastState = null;  // newest state the sketch reported
let lastStatus = null; // newest status (people count, cameras) the sketch reported

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(set, msg) {
  for (const ws of set) send(ws, msg);
}

function presence() {
  const msg = { type: 'presence', sketch: sketches.size > 0, controllers: controllers.size };
  broadcast(controllers, msg);
  broadcast(sketches, msg);
}

wss.on('connection', (ws) => {
  let role = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      return; // ignore anything that isn't JSON
    }
    if (!msg || typeof msg.type !== 'string') return;

    if (msg.type === 'hello') {
      if (role) return;
      if (msg.role === 'sketch') {
        role = 'sketch';
        sketches.add(ws);
      } else if (msg.role === 'controller') {
        role = 'controller';
        controllers.add(ws);
        // catch the new controller up with whatever the sketch last said
        if (lastState) send(ws, { type: 'state', state: lastState });
        if (lastStatus) send(ws, { type: 'status', status: lastStatus });
      } else {
        return;
      }
      presence();
      return;
    }

    if (role === 'controller' && msg.type === 'cmd') {
      broadcast(sketches, { type: 'cmd', cmd: msg.cmd });
    } else if (role === 'sketch' && msg.type === 'state') {
      lastState = msg.state;
      broadcast(controllers, { type: 'state', state: msg.state });
    } else if (role === 'sketch' && msg.type === 'status') {
      lastStatus = msg.status;
      broadcast(controllers, { type: 'status', status: msg.status });
    }
  });

  ws.on('close', () => {
    sketches.delete(ws);
    controllers.delete(ws);
    if (role) presence();
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('\nFace projection remote is running.\n');
  console.log('  On the laptop (the sketch):');
  console.log(`    http://localhost:${PORT}/sketch\n`);
  console.log('  On the iPad (the controller), same Wi-Fi:');
  const urls = lanUrls();
  if (urls.length === 0) console.log('    (no network address found - connect to Wi-Fi first)');
  for (const u of urls) console.log(`    ${u}/controller`);
  console.log('\nPress Ctrl+C to stop.\n');
});
