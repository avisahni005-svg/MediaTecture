let video;
let faceMesh;
let faces = [];

// Each feature gets a fixed-size square (sizes never change).
// "left"/"right" are the subject's own sides, which is also what the mirrored view shows.
// Ears aren't a faceMesh part, so they use the face-edge keypoints (234 = right, 454 = left).
const FEATURES = {
  leftEye:     { label: 'Left Eye',     size: 100, on: true, center: (f) => f.leftEye },
  rightEye:    { label: 'Right Eye',    size: 100, on: true, center: (f) => f.rightEye },
  leftBrow:    { label: 'Left Eyebrow', size: 110, on: true, center: (f) => f.leftEyebrow },
  rightBrow:   { label: 'Right Eyebrow', size: 110, on: true, center: (f) => f.rightEyebrow },
  leftEar:     { label: 'Left Ear',     size: 90,  on: true, center: (f) => f.keypoints[454] },
  rightEar:    { label: 'Right Ear',    size: 90,  on: true, center: (f) => f.keypoints[234] },
  nose:        { label: 'Nose',         size: 90,  on: true, center: (f) => f.keypoints[1] },
  mouth:       { label: 'Mouth',        size: 130, on: true, center: (f) => f.lips },
};

// GUI layout: three columns
const COLUMNS = [
  { title: 'Left',   keys: ['leftEye', 'leftBrow', 'leftEar'] },
  { title: 'Center', keys: ['nose', 'mouth'] },
  { title: 'Right',  keys: ['rightEye', 'rightBrow', 'rightEar'] },
];

const ON_COLOR = '#2ecc71';
const OFF_COLOR = '#555555';

function preload() {
  faceMesh = ml5.faceMesh({ maxFaces: 1 });
}

function setup() {
  const cnv = createCanvas(800, 800);
  cnv.parent(select('main'));
  video = createCapture({ video: { width: 800, height: 800 }, audio: false });
  video.size(800, 800);
  video.hide();
  faceMesh.detectStart(video, (results) => (faces = results));
  buildGui();
}

function buildGui() {
  const gui = createDiv();
  gui.parent(select('main'));
  gui.style('display', 'grid');
  gui.style('grid-template-columns', '1fr 1fr 1fr');
  gui.style('gap', '12px');
  gui.style('width', '800px');
  gui.style('margin-top', '12px');

  for (const col of COLUMNS) {
    const colDiv = createDiv();
    colDiv.parent(gui);
    colDiv.style('display', 'flex');
    colDiv.style('flex-direction', 'column');
    colDiv.style('gap', '8px');

    const title = createDiv(col.title);
    title.parent(colDiv);
    title.style('color', '#ccc');
    title.style('font-family', 'sans-serif');
    title.style('text-align', 'center');
    title.style('text-transform', 'uppercase');
    title.style('letter-spacing', '2px');
    title.style('font-size', '12px');

    for (const key of col.keys) {
      const f = FEATURES[key];
      const btn = createButton(f.label);
      btn.parent(colDiv);
      btn.style('padding', '10px');
      btn.style('border', 'none');
      btn.style('border-radius', '6px');
      btn.style('color', 'white');
      btn.style('font-family', 'sans-serif');
      btn.style('font-size', '14px');
      btn.style('cursor', 'pointer');
      const refresh = () => btn.style('background-color', f.on ? ON_COLOR : OFF_COLOR);
      btn.mousePressed(() => {
        f.on = !f.on;
        refresh();
      });
      refresh();
    }
  }
}

function draw() {
  background(0);

  // mirrored (selfie-style) webcam image
  push();
  translate(width, 0);
  scale(-1, 1);
  image(video, 0, 0, width, height);
  pop();

  if (faces.length === 0) return;
  const face = faces[0];

  // scale from the camera's real pixel size to the canvas
  const vw = video.elt.videoWidth || video.width;
  const vh = video.elt.videoHeight || video.height;

  noFill();
  stroke(255);
  strokeWeight(2);
  rectMode(CENTER);

  for (const key in FEATURES) {
    const f = FEATURES[key];
    if (!f.on) continue;
    const p = f.center(face);
    if (!p) continue;
    // parts report centerX/centerY; single keypoints report x/y
    const px = p.centerX !== undefined ? p.centerX : p.x;
    const py = p.centerY !== undefined ? p.centerY : p.y;
    // mirror x so the box lines up with the flipped image
    square(width - px * (width / vw), py * (height / vh), f.size);
  }
}
