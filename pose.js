// Camera and pose model. Everything runs on the phone; no frame leaves the device.

import { tr } from "./i18n.js";

const VISION_MODULE = new URL("./vendor/tasks-vision/vision_bundle.mjs", import.meta.url).href;
const WASM_ROOT = new URL("./vendor/tasks-vision/wasm", import.meta.url).href;
const MODEL_URL = new URL("./models/pose_landmarker_lite.task", import.meta.url).href;

let landmarker = null;
let delegate = "GPU";
let lastTimestamp = 0;

async function createLandmarker(chosen) {
  const { FilesetResolver, PoseLandmarker } = await import(VISION_MODULE);
  const fileset = await FilesetResolver.forVisionTasks(WASM_ROOT);
  return PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: chosen },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

// The pieces that touch the hardware, on one object so a test can stand in for them.
export const backend = {
  async load() {
    if (landmarker) return;
    try {
      landmarker = await createLandmarker("GPU");
    } catch {
      delegate = "CPU";
      landmarker = await createLandmarker("CPU");
    }
  },

  async detect(video, milliseconds) {
    lastTimestamp = Math.max(lastTimestamp + 1, Math.round(milliseconds)); // must keep increasing
    try {
      return landmarker.detectForVideo(video, lastTimestamp);
    } catch (problem) {
      if (delegate !== "GPU") throw problem;
      // Some phones list a GPU that then fails on the first frame.
      delegate = "CPU";
      landmarker.close();
      landmarker = await createLandmarker("CPU");
      lastTimestamp += 1;
      return landmarker.detectForVideo(video, lastTimestamp);
    }
  },

  openCamera(facing) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(tr("这个浏览器打不开摄像头，请用 iPhone 的 Safari 打开。", "This browser can't open the camera. Please use Safari on an iPhone."));
    }
    return navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
    });
  },
};

const EMPTY_KP = Array.from({ length: 33 }, () => [0, 0, 0]);

// x and y both in image heights, like core/pose.py, so distances keep their shape.
export function toFrame(result, width, height, t) {
  const landmarks = result && result.landmarks && result.landmarks[0];
  if (!landmarks) return { t, kp: EMPTY_KP };
  return { t, kp: landmarks.map((p) => [(p.x * width) / height, p.y, p.visibility ?? 0]) };
}

const BONES = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28],
];
const VISIBLE = 0.3;

export function drawPose(canvas, result) {
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  const landmarks = result && result.landmarks && result.landmarks[0];
  if (!landmarks) return;
  const at = (p) => [p.x * canvas.width, p.y * canvas.height];
  const seen = (p) => (p.visibility ?? 0) >= VISIBLE;
  context.lineWidth = Math.max(3, canvas.height / 200);
  context.strokeStyle = "#5cc48a";
  context.lineCap = "round";
  for (const [a, b] of BONES) {
    if (!seen(landmarks[a]) || !seen(landmarks[b])) continue;
    context.beginPath();
    context.moveTo(...at(landmarks[a]));
    context.lineTo(...at(landmarks[b]));
    context.stroke();
  }
  context.fillStyle = "#ffcb47";
  for (const index of new Set(BONES.flat())) {
    if (!seen(landmarks[index])) continue;
    const [x, y] = at(landmarks[index]);
    context.beginPath();
    context.arc(x, y, context.lineWidth, 0, Math.PI * 2);
    context.fill();
  }
}
