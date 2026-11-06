// A practice session: camera -> pose -> swings, with a short clip of every swing.
// Clips stay in memory on the phone and are gone when the page closes, unless saved.

import { backend, drawPose, toFrame } from "./pose.js";
import {
  analyzeSwing, FEEDBACK_EVERY, guidance, setFeedback, SwingPipeline, WAITING_FOR_BACKSWING,
} from "./swing.js";

const MAX_IDLE_SEGMENT_SECONDS = 25; // start a fresh video while waiting, to bound memory
const VIDEO_BITS_PER_SECOND = 2_000_000;
const CLIP_TYPES = ["video/mp4", "video/webm;codecs=vp9", "video/webm"]; // mp4 is the one iPhones and seeking both like

const now = () => performance.now() / 1000;

class ClipRecorder {
  constructor(stream) {
    this.stream = stream;
    this.type = window.MediaRecorder ? CLIP_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) : null;
    this.recorder = null;
  }

  begin() {
    if (!this.type) return;
    const chunks = [];
    const recorder = new MediaRecorder(this.stream, { mimeType: this.type, videoBitsPerSecond: VIDEO_BITS_PER_SECOND });
    recorder.ondataavailable = (dataEvent) => { if (dataEvent.data.size) chunks.push(dataEvent.data); };
    recorder.chunks = chunks;
    recorder.start();
    this.recorder = recorder;
    this.startedAt = now();
  }

  // Finish the current video and start the next one right away. Resolves to { blob, startedAt } or null.
  cut() {
    const { recorder, startedAt, type } = this;
    if (!recorder || recorder.state === "inactive") return Promise.resolve(null);
    const done = new Promise((resolve) => {
      recorder.onstop = () => resolve(recorder.chunks.length ? { blob: new Blob(recorder.chunks, { type }), startedAt } : null);
    });
    recorder.stop();
    this.begin();
    return done;
  }

  dropIfLong(idle) {
    if (idle && this.recorder && now() - this.startedAt > MAX_IDLE_SEGMENT_SECONDS) this.cut();
  }

  stop() {
    if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
    this.recorder = null;
  }
}

export class Practice {
  // handlers: onSwing({ swing, levelUp }), onClip({ url, swing, offset, mirrored }), onFeedback(text), onGuidance(text), onError(text)
  constructor({ video, canvas, analyze, handedness, facing, progress, handlers }) {
    Object.assign(this, { video, canvas, analyze, handedness, facing, progress, handlers });
    this.swings = 0;
    this.reports = [];
    this.running = false;
    this.pipeline = new SwingPipeline({ handedness });
  }

  async start() {
    this.handlers.onGuidance("小鸟正在热身，第一次要下载约 20 MB…");
    await backend.load();
    await this.openCamera();
    this.running = true;
    this.keepAwake();
    this.visibility = () => this.onVisibility();
    document.addEventListener("visibilitychange", this.visibility);
    this.scheduleFrame();
  }

  async openCamera() {
    this.handlers.onGuidance("正在打开摄像头…");
    this.stream = await backend.openCamera(this.facing);
    this.video.srcObject = this.stream;
    this.video.classList.toggle("mirror", this.facing === "user");
    this.canvas.classList.toggle("mirror", this.facing === "user");
    await this.video.play();
    this.handlers.onCameraReady?.(this.video.videoWidth, this.video.videoHeight);
    this.clips = new ClipRecorder(this.stream);
    this.clips.begin();
  }

  closeCamera() {
    if (this.clips) this.clips.stop();
    if (this.stream) for (const track of this.stream.getTracks()) track.stop();
    this.stream = null;
    this.video.srcObject = null;
  }

  async flipCamera() {
    this.facing = this.facing === "user" ? "environment" : "user";
    this.running = false;
    await this.frameInFlight;
    this.closeCamera();
    this.pipeline = new SwingPipeline({ handedness: this.handedness });
    await this.openCamera();
    this.running = true;
    this.scheduleFrame();
  }

  async stop() {
    this.running = false;
    await this.frameInFlight;
    document.removeEventListener("visibilitychange", this.visibility);
    this.closeCamera();
    if (this.wakeLock) this.wakeLock.release().catch(() => {});
    this.wakeLock = null;
    if (this.swings) this.progress.sessions += 1;
    this.handlers.onGuidance("");
  }

  // The screen must stay on or the phone locks and the camera stops mid-practice.
  async keepAwake() {
    try {
      if (navigator.wakeLock) this.wakeLock = await navigator.wakeLock.request("screen");
    } catch {
      /* not allowed right now; the page explains how to keep the screen on */
    }
  }

  onVisibility() {
    if (document.visibilityState !== "visible" || !this.running) return;
    this.keepAwake();
    this.video.play().catch(() => {});
  }

  scheduleFrame() {
    if (!this.running) return;
    const next = () => { this.frameInFlight = this.onFrame(); };
    if (this.video.requestVideoFrameCallback) this.video.requestVideoFrameCallback(next);
    else requestAnimationFrame(next);
  }

  async onFrame() {
    if (!this.running) return;
    try {
      const { videoWidth: width, videoHeight: height } = this.video;
      if (width && height) {
        const result = await backend.detect(this.video, performance.now());
        if (this.canvas.width !== width || this.canvas.height !== height) {
          this.canvas.width = width;
          this.canvas.height = height;
        }
        drawPose(this.canvas, result);
        const recording = this.pipeline.push(toFrame(result, width, height, now()));
        if (recording) this.onSwing(recording);
        this.handlers.onGuidance(guidance(this.pipeline));
        this.clips.dropIfLong(this.pipeline.phase === WAITING_FOR_BACKSWING);
      }
      this.scheduleFrame();
    } catch (problem) {
      console.error(problem);
      this.running = false;
      this.handlers.onError("摄像头或识别出错了，点“练完了”再重新开始一次。");
    }
  }

  onSwing(recording) {
    this.swings += 1;
    const swing = this.swings;
    const report = this.analyze ? analyzeSwing(recording) : null;
    this.reports.push(report);
    const levelUp = this.progress.addSwing();
    this.handlers.onSwing({ swing, levelUp });

    const from = recording.t[0];
    const mirrored = this.facing === "user";
    this.clips.cut().then((clip) => {
      if (!clip) return;
      const offset = Math.max(0, from - clip.startedAt);
      this.handlers.onClip({ url: URL.createObjectURL(clip.blob), type: clip.blob.type, swing, offset, mirrored });
    });

    if (swing % FEEDBACK_EVERY === 0) {
      const text = setFeedback(this.reports.slice(-FEEDBACK_EVERY), swing / FEEDBACK_EVERY, { analyzed: this.analyze });
      this.handlers.onFeedback(text);
    }
  }
}
