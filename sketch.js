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

  // webcam image, drawn unflipped so it lines up with the tracked points
  image(video, 0, 0, width, height);

  if (faces.length > 0) {
    // track the person's right eye (the eye on the left side of the image)
    const eye = faces[0].rightEye;
    // scale from the camera's real pixel size to the canvas
    const vw = video.elt.videoWidth || video.width;
    const vh = video.elt.videoHeight || video.height;
    const x = eye.centerX * (width / vw);
    const y = eye.centerY * (height / vh);

    noFill();
    stroke(255);
    strokeWeight(2);
    rectMode(CENTER);
    square(x, y, BOX_SIZE);
  }
}
