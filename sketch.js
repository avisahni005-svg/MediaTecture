let video;
let faceMesh;
let faces = [];

const BOX_SIZE = 100; // fixed square size, never changes

function preload() {
  faceMesh = ml5.faceMesh({ maxFaces: 1 });
}

function setup() {
  createCanvas(800, 800);
  video = createCapture({ video: { width: 800, height: 800 }, audio: false });
  video.size(800, 800);
  video.hide();
  faceMesh.detectStart(video, (results) => (faces = results));
}

function draw() {
  background(0);

  // mirrored (selfie-style) webcam image
  push();
  translate(width, 0);
  scale(-1, 1);
  image(video, 0, 0, width, height);
  pop();

  if (faces.length > 0) {
    // track the person's right eye (appears on the left of the mirrored view)
    const eye = faces[0].rightEye;
    // scale from the camera's real pixel size to the canvas
    const vw = video.elt.videoWidth || video.width;
    const vh = video.elt.videoHeight || video.height;
    // mirror x so the box lines up with the flipped image
    const x = width - eye.centerX * (width / vw);
    const y = eye.centerY * (height / vh);

    noFill();
    stroke(255);
    strokeWeight(2);
    rectMode(CENTER);
    square(x, y, BOX_SIZE);
  }
}
