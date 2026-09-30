let video;
let faceMesh;
let faces = [];

// Each feature is a fixed-size square region of the video that gets blown up to fill the canvas.
// "left"/"right" are the subject's own sides, which is also what the mirrored view shows.
// Nose uses a single face keypoint (1 = nose tip) since faceMesh has no nose region.
const FEATURES = [
  { label: 'Left Eye',      size: 100, center: (f) => f.leftEye },
  { label: 'Right Eye',     size: 100, center: (f) => f.rightEye },
  { label: 'Left Eyebrow',  size: 110, center: (f) => f.leftEyebrow },
  { label: 'Right Eyebrow', size: 110, center: (f) => f.rightEyebrow },
  { label: 'Nose',          size: 90,  center: (f) => f.keypoints[1] },
  { label: 'Mouth',         size: 130, center: (f) => f.lips },
];

const MIN_SIZE = 20;
const MAX_SIZE = 300;
const SMOOTHING = 0.35; // 0..1, higher = follows faster; smoothing keeps the zoomed image steady

let current = 0;
let slider, side;
let fullView = false; // true = main canvas shows the whole camera view instead of the zoomed feature
let fullBtn;
let fxMode = 'none'; // 'none' | 'mono' | 'duo': filter applied only to the footage inside the box
const fxBtns = {};
let fxBuf;
const buttons = [];

const BTN_COLOR = '#00ff00';
const MONO = 'monospace';
const PREVIEW = 300; // size of the small full-camera preview to the right of the canvas
let preview;

let smoothX = null;
let smoothY = null;

function preload() {
  faceMesh = ml5.faceMesh({ maxFaces: 1 });
}

function setup() {
  const cnv = createCanvas(800, 800);
  cnv.parent(select('main'));
  side = createDiv();
  side.parent(select('main'));
  side.style('display', 'flex');
  side.style('flex-direction', 'column');
  side.style('gap', '16px');
  side.style('width', PREVIEW + 'px');
  preview = createGraphics(PREVIEW, PREVIEW);
  preview.parent(side);
  preview.show();
  video = createCapture({ video: { width: 800, height: 800 }, audio: false });
  video.size(800, 800);
  video.hide();
  faceMesh.detectStart(video, (results) => (faces = results));
  const st = document.getElementById('status');
  if (st) st.remove();
  buildGui();
}

function buildGui() {
  // single column of feature buttons, under the preview on the right
  const row = createDiv();
  row.parent(side);
  row.style('display', 'flex');
  row.style('gap', '8px');
  row.style('align-items', 'flex-start');

  const col = createDiv();
  col.parent(row);
  col.style('display', 'flex');
  col.style('flex-direction', 'column');
  col.style('gap', '8px');
  col.style('flex', '1');

  // effect buttons in a second column on the right
  const fxCol = createDiv();
  fxCol.parent(row);
  fxCol.style('display', 'flex');
  fxCol.style('flex-direction', 'column');
  fxCol.style('gap', '8px');
  fxCol.style('flex', '1');
  [['mono', 'Monochrome'], ['duo', 'Duotone']].forEach(([mode, label]) => {
    const b = createButton(label);
    b.parent(fxCol);
    b.style('padding', '10px');
    b.style('border', 'none');
    b.style('border-radius', '6px');
    b.style('background-color', BTN_COLOR);
    b.style('color', 'black');
    b.style('font-family', MONO);
    b.style('font-size', '14px');
    b.style('cursor', 'pointer');
    b.mousePressed(() => {
      fxMode = fxMode === mode ? 'none' : mode; // press again to turn it off
      updateGui();
    });
    fxBtns[mode] = b;
  });

  FEATURES.forEach((f, idx) => {
    const btn = createButton(f.label);
    btn.parent(col);
    btn.style('padding', '10px');
    btn.style('border', 'none');
    btn.style('border-radius', '6px');
    btn.style('background-color', BTN_COLOR);
    btn.style('color', 'black');
    btn.style('font-family', MONO);
    btn.style('font-size', '14px');
    btn.style('cursor', 'pointer');
    btn.mousePressed(() => select_feature(idx));
    buttons[idx] = btn;
  });

  // full view: project the whole camera view (what the small preview shows) onto the main canvas
  fullBtn = createButton('Full View');
  fullBtn.parent(col);
  fullBtn.style('padding', '10px');
  fullBtn.style('border', 'none');
  fullBtn.style('border-radius', '6px');
  fullBtn.style('background-color', BTN_COLOR);
  fullBtn.style('color', 'black');
  fullBtn.style('font-family', MONO);
  fullBtn.style('font-size', '14px');
  fullBtn.style('cursor', 'pointer');
  fullBtn.mousePressed(() => {
    fullView = !fullView; // independent toggle: features can still be switched while it's on
    updateGui();
  });

  // size slider (flipped): higher value = smaller box = more zoomed in
  const sliderBox = createDiv();
  sliderBox.parent(side);
  sliderBox.style('display', 'flex');
  sliderBox.style('flex-direction', 'column');
  sliderBox.style('gap', '4px');
  sliderBox.style('color', BTN_COLOR);
  sliderBox.style('font-family', MONO);
  sliderBox.style('font-size', '12px');
  createDiv('BOX SIZE').parent(sliderBox);
  slider = createSlider(MIN_SIZE, MAX_SIZE, sizeToSlider(FEATURES[0].size), 1);
  slider.parent(sliderBox);
  slider.style('width', '100%');
  slider.input(() => (FEATURES[current].size = sliderToSize(slider.value())));
  const ends = createDiv();
  ends.parent(sliderBox);
  ends.style('display', 'flex');
  ends.style('justify-content', 'space-between');
  createSpan('LARGE').parent(ends);
  createSpan('SMALL').parent(ends);

  updateGui();
}

// the slider is flipped: box size = MIN + MAX - slider value
function sliderToSize(v) {
  return MIN_SIZE + MAX_SIZE - v;
}
const sizeToSlider = sliderToSize; // the flip is its own inverse

function select_feature(idx) {
  current = idx;
  smoothX = null; // jump straight to the new feature instead of gliding across the face
  updateGui();
}

function cycle(dir) {
  select_feature((current + dir + FEATURES.length) % FEATURES.length);
}

function updateGui() {
  // active feature is full green, the others are dimmed
  buttons.forEach((btn, i) => btn.style('opacity', i === current ? '1' : '0.35'));
  fullBtn.style('opacity', fullView ? '1' : '0.35');
  for (const m in fxBtns) fxBtns[m].style('opacity', fxMode === m ? '1' : '0.35');
  slider.value(sizeToSlider(FEATURES[current].size));
}

function keyPressed() {
  if (keyCode === RIGHT_ARROW || key === ' ') cycle(1);
  if (keyCode === LEFT_ARROW) cycle(-1);
}

function draw() {
  background(0);

  const vw = video.elt.videoWidth || video.width;
  const vh = video.elt.videoHeight || video.height;

  const f = FEATURES[current];
  const face = faces[0];
  const p = face && f.center(face);

  if (p) {
    const px = p.centerX !== undefined ? p.centerX : p.x;
    const py = p.centerY !== undefined ? p.centerY : p.y;
    smoothX = smoothX === null ? px : lerp(smoothX, px, SMOOTHING);
    smoothY = smoothY === null ? py : lerp(smoothY, py, SMOOTHING);
  }

  if (fullView) {
    // whole camera view on the main canvas, mirrored, with the current square outlined in green
    push();
    translate(width, 0);
    scale(-1, 1);
    image(video, 0, 0, width, height);
    pop();
    if (smoothX === null) {
      drawPreview(vw, vh, null);
      return;
    }
    const b = currentBox(vw, vh, f);
    const bx = width - (b.sx + b.sw) * (width / vw);
    const by = b.sy * (height / vh);
    const bw = b.sw * (width / vw);
    const bh = b.sh * (height / vh);
    drawFiltered(drawingContext, b, bx, by, bw, bh);
    noFill();
    stroke(BTN_COLOR);
    strokeWeight(2);
    rect(bx, by, bw, bh);
    drawPreview(vw, vh, b);
    return;
  }

  if (smoothX === null) {
    // no face yet: show the plain mirrored camera so it's clear the sketch is alive
    push();
    translate(width, 0);
    scale(-1, 1);
    image(video, 0, 0, width, height);
    pop();
    fill(0, 160);
    noStroke();
    rect(0, height / 2 - 30, width, 60);
    fill(255);
    textSize(24);
    textAlign(CENTER, CENTER);
    text(faces.length === 0 ? 'Looking for a face...' : 'Face found, tracking...', width / 2, height / 2);
    drawPreview(vw, vh, null);
    return;
  }

  const { sx, sy, sw, sh } = currentBox(vw, vh, f);

  // project what's inside the square across the whole canvas, mirrored like a selfie view.
  // Uses the canvas API directly so the crop is taken in the camera's true pixel coordinates.
  const ctx = drawingContext;
  if (fxMode === 'none') {
    ctx.save();
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video.elt, sx, sy, sw, sh, 0, 0, width, height);
    ctx.restore();
  } else {
    drawFiltered(ctx, { sx, sy, sw, sh }, 0, 0, width, height);
  }

  drawPreview(vw, vh, { sx, sy, sw, sh });
}

// small mirrored preview of the full camera (beside the canvas) with the current square outlined
function drawPreview(vw, vh, box) {
  preview.background(0);
  preview.push();
  preview.translate(PREVIEW, 0);
  preview.scale(-1, 1);
  preview.image(video, 0, 0, PREVIEW, PREVIEW);
  preview.pop();

  if (!box) return;
  const bk = PREVIEW / vw;
  const bkh = PREVIEW / vh;
  drawFiltered(preview.drawingContext, box, PREVIEW - (box.sx + box.sw) * bk, box.sy * bkh, box.sw * bk, box.sh * bkh);
  preview.noFill();
  preview.stroke(BTN_COLOR);
  preview.strokeWeight(2);
  const k = PREVIEW / vw;
  const kh = PREVIEW / vh;
  // mirror x to match the flipped preview
  preview.rect(PREVIEW - (box.sx + box.sw) * k, box.sy * kh, box.sw * k, box.sh * kh);
}

// the current feature's square in raw video pixels (canvas size -> video size), kept fully inside the frame
function currentBox(vw, vh, f) {
  const sw = f.size * (vw / width);
  const sh = f.size * (vh / height);
  return {
    sx: constrain(smoothX - sw / 2, 0, vw - sw),
    sy: constrain(smoothY - sh / 2, 0, vh - sh),
    sw,
    sh,
  };
}

// Draw the boxed region of the camera (raw pixel rect `box`) into the destination rect (dx, dy, dw, dh)
// of `ctx`, mirrored like the rest of the view, with the current filter applied to just that region.
function drawFiltered(ctx, box, dx, dy, dw, dh) {
  if (fxMode === 'none') return;
  const w = max(1, round(dw));
  const h = max(1, round(dh));
  if (!fxBuf) {
    fxBuf = createGraphics(w, h);
    fxBuf.pixelDensity(1);
    fxBuf.hide();
  }
  if (fxBuf.width !== w || fxBuf.height !== h) fxBuf.resizeCanvas(w, h);

  fxBuf.drawingContext.drawImage(video.elt, box.sx, box.sy, box.sw, box.sh, 0, 0, w, h);
  fxBuf.loadPixels();
  const px = fxBuf.pixels;
  for (let i = 0; i < px.length; i += 4) {
    const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    if (fxMode === 'mono') {
      px[i] = px[i + 1] = px[i + 2] = lum;
    } else {
      // duotone: black (shadows) -> #00ff00 (highlights)
      px[i] = 0;
      px[i + 1] = lum;
      px[i + 2] = 0;
    }
  }
  fxBuf.updatePixels();

  ctx.save();
  ctx.translate(dx + dw, dy);
  ctx.scale(-1, 1);
  ctx.drawImage(fxBuf.elt, 0, 0, dw, dh);
  ctx.restore();
}
