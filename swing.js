// Swing detection and rule-based analysis for the phone page: a port of
// core/{body,trigger,pipeline,events,features,faults,progress}.py. No DOM here.
// tests/test_mobile_port.py runs both versions on the same swings, so keep them in step.

const NOSE = 0;
const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_WRIST = 15;
const RIGHT_WRIST = 16;
const LEFT_HIP = 23;
const RIGHT_HIP = 24;
const LEFT_ANKLE = 27;
const RIGHT_ANKLE = 28;
const VISIBILITY_THRESHOLD = 0.3;

// Body measurements. A frame's kp is 33 [x, y, visibility], with x and y in image heights.

function point(kp, index) {
  const [x, y, visibility] = kp[index];
  return visibility < VISIBILITY_THRESHOLD ? [NaN, NaN] : [x, y];
}

function midpoint(kp, a, b) {
  const p = point(kp, a);
  const q = point(kp, b);
  return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
}

const hipCenter = (kp) => midpoint(kp, LEFT_HIP, RIGHT_HIP);
const shoulderCenter = (kp) => midpoint(kp, LEFT_SHOULDER, RIGHT_SHOULDER);

function handCenter(kp) {
  const wrists = [point(kp, LEFT_WRIST), point(kp, RIGHT_WRIST)].filter((wrist) => !Number.isNaN(wrist[0]));
  if (!wrists.length) return [NaN, NaN];
  return [0, 1].map((axis) => wrists.reduce((sum, wrist) => sum + wrist[axis], 0) / wrists.length);
}

function distance(p, q) {
  return Math.hypot(p[0] - q[0], p[1] - q[1]);
}

const torsoHeight = (kp) => distance(shoulderCenter(kp), hipCenter(kp));

function handLift(kp) {
  return (hipCenter(kp)[1] - handCenter(kp)[1]) / torsoHeight(kp);
}

function trackable(kp) {
  const torso = torsoHeight(kp);
  return !Number.isNaN(torso) && torso >= 0.05 && !Number.isNaN(handCenter(kp)[0]);
}

function nanmedian(values) {
  const valid = values.filter((value) => !Number.isNaN(value)).sort((a, b) => a - b);
  if (!valid.length) return NaN;
  const middle = valid.length >> 1;
  return valid.length % 2 ? valid[middle] : (valid[middle - 1] + valid[middle]) / 2;
}

function nanmax(values) {
  const valid = values.filter((value) => !Number.isNaN(value));
  return valid.length ? Math.max(...valid) : NaN;
}

function nanmin(values) {
  const valid = values.filter((value) => !Number.isNaN(value));
  return valid.length ? Math.min(...valid) : NaN;
}

const medianPoint = (points) => [0, 1].map((axis) => nanmedian(points.map((p) => p[axis])));

// Trigger: decides when a swing happened, from the hand path.

export const WAITING_FOR_BACKSWING = "waiting for backswing";
export const BACKSWING = "backswing";
export const DOWNSWING = "downswing";
export const FOLLOW_THROUGH = "follow-through";
export const WAITING_FOR_ADDRESS = "waiting for address";

class SwingTrigger {
  constructor() {
    this.reset();
  }

  get addressReady() {
    return this.addressLifts.length >= 10;
  }

  get addressLift() {
    return nanmedian(this.addressLifts);
  }

  reset() {
    this.state = WAITING_FOR_BACKSWING;
    this.addressLifts = [];
    this.startTime = 0;
    this.peakLift = 0;
    this.downswingMinLift = 0;
    this.motionAnchor = null;
    this.lastMotionTime = 0;
    this.handsLoweredTime = null;
  }

  update({ handX, handY, hipX, hipY, torso, timestamp }) {
    if (torso <= 0) {
      this.reset();
      return null;
    }
    const hand = [(handX - hipX) / torso, (hipY - handY) / torso];
    const lift = hand[1];

    if (this.state === WAITING_FOR_BACKSWING) {
      if (!this.addressReady || lift < this.addressLift + 0.15) {
        this.addressLifts.push(lift);
        if (this.addressLifts.length > 30) this.addressLifts.shift();
      }
      if (this.addressReady && lift >= this.addressLift + 0.25) {
        this.state = BACKSWING;
        this.startTime = timestamp;
        this.peakLift = lift;
      }
      return null;
    }

    if (this.state === BACKSWING) {
      this.peakLift = Math.max(this.peakLift, lift);
      if (lift <= this.peakLift - 0.2) {
        this.state = DOWNSWING;
        this.downswingMinLift = lift;
      }
      return null;
    }

    if (this.state === DOWNSWING) {
      this.downswingMinLift = Math.min(this.downswingMinLift, lift);
      const handReversed = lift >= this.downswingMinLift + 0.08;
      const meaningfulDownswing = this.peakLift - this.downswingMinLift >= 0.2;
      if (handReversed && meaningfulDownswing) {
        this.state = FOLLOW_THROUGH;
        this.motionAnchor = hand;
        this.lastMotionTime = timestamp;
      }
      return null;
    }

    if (this.state === FOLLOW_THROUGH) {
      // Compare against an anchor rather than the previous frame so slow
      // follow-throughs at high frame rates still count as motion.
      if (this.motionAnchor === null || distance(this.motionAnchor, hand) >= 0.08) {
        this.motionAnchor = hand;
        this.lastMotionTime = timestamp;
      }
      const settled = timestamp - this.lastMotionTime >= 0.8;
      const longEnough = timestamp - this.startTime >= 1.2;
      if (settled && longEnough) {
        this.state = WAITING_FOR_ADDRESS;
        this.handsLoweredTime = lift < 0.4 ? timestamp : null;
        return { startTime: this.startTime, endTime: timestamp };
      }
      return null;
    }

    if (lift < 0.4) {
      if (this.handsLoweredTime === null) this.handsLoweredTime = timestamp;
      else if (timestamp - this.handsLoweredTime >= 0.4) this.reset();
    } else {
      this.handsLoweredTime = null;
    }
    return null;
  }
}

// Pipeline: turns a live stream of pose frames into recorded swings.

const PRE_ROLL_SECONDS = 1.5;
const BUFFER_SECONDS = 12;
const POSE_LOST_RESET_SECONDS = 1;

export class SwingPipeline {
  constructor({ handedness = "right" } = {}) {
    this.handedness = handedness;
    this.trigger = new SwingTrigger();
    this.buffer = [];
    this.poseLostSince = null;
    this.tracking = false;
  }

  get phase() {
    return this.trigger.state;
  }

  get addressReady() {
    return this.trigger.addressReady;
  }

  // frame: { t, kp }. Returns a recording when a swing has just finished.
  push(frame) {
    this.buffer.push(frame);
    while (this.buffer.length && frame.t - this.buffer[0].t > BUFFER_SECONDS) this.buffer.shift();

    this.tracking = trackable(frame.kp);
    if (!this.tracking) {
      if (this.poseLostSince === null) this.poseLostSince = frame.t;
      else if (frame.t - this.poseLostSince > POSE_LOST_RESET_SECONDS) this.trigger.reset();
      return null;
    }
    this.poseLostSince = null;

    const hand = handCenter(frame.kp);
    const hip = hipCenter(frame.kp);
    const window = this.trigger.update({
      handX: hand[0],
      handY: hand[1],
      hipX: hip[0],
      hipY: hip[1],
      torso: torsoHeight(frame.kp),
      timestamp: frame.t,
    });
    if (window === null) return null;

    const frames = this.buffer.filter((buffered) =>
      window.startTime - PRE_ROLL_SECONDS <= buffered.t && buffered.t <= window.endTime);
    return {
      t: frames.map((buffered) => buffered.t),
      kp: frames.map((buffered) => buffered.kp),
      triggerTime: window.startTime,
      handedness: this.handedness,
    };
  }
}

// Events: the key moments of a recorded swing, as frame indices.

const SMOOTHING_FRAMES = 5;
const ADDRESS_SECONDS = 0.5;

function fillGaps(values) {
  const known = [];
  values.forEach((value, index) => { if (!Number.isNaN(value)) known.push(index); });
  if (!known.length) return values;
  let next = 0;
  return values.map((value, index) => {
    if (!Number.isNaN(value)) return value;
    while (next < known.length && known[next] < index) next += 1;
    if (next === 0) return values[known[0]];
    if (next === known.length) return values[known[known.length - 1]];
    const [a, b] = [known[next - 1], known[next]];
    return values[a] + ((values[b] - values[a]) * (index - a)) / (b - a);
  });
}

function smooth(values) {
  const pad = SMOOTHING_FRAMES >> 1;
  return values.map((_, index) => {
    let sum = 0;
    for (let offset = -pad; offset <= pad; offset += 1) {
      sum += values[Math.min(values.length - 1, Math.max(0, index + offset))];
    }
    return sum / SMOOTHING_FRAMES;
  });
}

function firstIndexAtLeast(sorted, value) {
  const index = sorted.findIndex((item) => item >= value);
  return index < 0 ? sorted.length : index;
}

function indexOfExtreme(values, better) {
  let best = 0;
  values.forEach((value, index) => { if (better(value, values[best])) best = index; });
  return best;
}

const indexOfMax = (values) => indexOfExtreme(values, (a, b) => a > b);
const indexOfMin = (values) => indexOfExtreme(values, (a, b) => a < b);

function refine(values, index, pick) {
  const start = Math.max(0, index - (SMOOTHING_FRAMES >> 1) - 1);
  return start + pick(values.slice(start, index + (SMOOTHING_FRAMES >> 1) + 2));
}

export function findEvents(recording) {
  const { t } = recording;
  const rawLift = recording.kp.map(handLift);
  if (rawLift.filter((value) => !Number.isNaN(value)).length < 10) return null;
  const filled = fillGaps(rawLift);
  const lift = smooth(filled);

  const addressLift = nanmedian(rawLift.filter((_, index) => t[index] <= t[0] + ADDRESS_SECONDS));
  if (Number.isNaN(addressLift)) return null;

  // Top: the first peak the hands fall at least 0.2 torso lengths from, so
  // a high finish is never mistaken for the top of the backswing.
  const searchStart = firstIndexAtLeast(t, recording.triggerTime);
  let top = null;
  let runningPeak = searchStart;
  for (let index = searchStart; index < lift.length; index += 1) {
    if (lift[index] > lift[runningPeak]) runningPeak = index;
    if (lift[index] <= lift[runningPeak] - 0.2) {
      top = runningPeak;
      break;
    }
  }
  if (top === null) return null;

  // Impact: the trough before the hands reverse upward into the follow-through.
  let impact = null;
  let runningTrough = top;
  for (let index = top; index < lift.length; index += 1) {
    if (lift[index] < lift[runningTrough]) runningTrough = index;
    if (lift[index] >= lift[runningTrough] + 0.08) {
      impact = runningTrough;
      break;
    }
  }
  if (impact === null) impact = top + indexOfMin(lift.slice(top));

  // Smoothing pulls an asymmetric peak early, which would skew tempo;
  // re-centre top and impact on the unsmoothed path.
  top = refine(filled, top, indexOfMax);
  impact = refine(filled, impact, indexOfMin);
  if (impact <= top) return null;

  let takeaway = top;
  while (takeaway > 0 && lift[takeaway - 1] > addressLift + 0.05) takeaway -= 1;
  if (takeaway >= top) return null;

  const addressStart = firstIndexAtLeast(t, t[takeaway] - ADDRESS_SECONDS);
  return {
    addressStart: Math.min(addressStart, takeaway),
    takeaway,
    top,
    impact,
    finish: t.length - 1,
  };
}

// Features: what the rules look at. All 2D, from a face-on camera.

const FINISH_WINDOW_SECONDS = 0.5;
const TRACKED_JOINTS = [
  NOSE, LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_WRIST, RIGHT_WRIST, LEFT_HIP, RIGHT_HIP, LEFT_ANKLE, RIGHT_ANKLE,
];

// Median over a 3-frame window, to damp single-frame keypoint jitter.
const around = (series, index) => series.slice(Math.max(0, index - 1), index + 2);

export function extractFeatures(recording, events) {
  const { kp, t } = recording;
  const [leadIndex, trailIndex] = recording.handedness === "left"
    ? [RIGHT_ANKLE, LEFT_ANKLE]
    : [LEFT_ANKLE, RIGHT_ANKLE];
  const address = [events.addressStart, events.takeaway + 1];
  const inAddress = (series) => series.slice(...address);

  const leadAnkle = medianPoint(inAddress(kp).map((frame) => point(frame, leadIndex)));
  const trailAnkle = medianPoint(inAddress(kp).map((frame) => point(frame, trailIndex)));
  const stance = leadAnkle[0] - trailAnkle[0];
  if (Number.isNaN(stance) || Math.abs(stance) < 0.03) return null;
  const targetSign = stance > 0 ? 1 : -1;

  const hips = kp.map(hipCenter);
  const shoulders = kp.map(shoulderCenter);
  const nose = kp.map((frame) => point(frame, NOSE));
  const hipPosition = hips.map((hip) => (hip[0] - trailAnkle[0]) / stance);
  const torso = nanmedian(inAddress(shoulders.map((shoulder, index) => distance(shoulder, hips[index]))));
  if (Number.isNaN(torso) || torso <= 0) return null;

  const spineTilt = hips.map((hip, index) => {
    const shoulder = shoulders[index];
    return (Math.atan2(targetSign * (shoulder[0] - hip[0]), hip[1] - shoulder[1]) * 180) / Math.PI;
  });
  const addressHip = nanmedian(inAddress(hipPosition));
  const addressNose = medianPoint(inAddress(nose));
  const lift = kp.map(handLift);

  const finishHips = hipPosition.filter((_, index) => t[index] >= t[events.finish] - FINISH_WINDOW_SECONDS);
  const backswingSeconds = t[events.top] - t[events.takeaway];
  const downswingSeconds = t[events.impact] - t[events.top];
  const swingFrames = kp.slice(events.takeaway, events.impact + 1);
  const visibilities = swingFrames.flatMap((frame) => TRACKED_JOINTS.map((joint) => frame[joint][2]));

  return {
    backswingSeconds,
    downswingSeconds,
    tempoRatio: downswingSeconds > 0 ? backswingSeconds / downswingSeconds : NaN,
    addressHipPosition: addressHip,
    topHipShift: nanmin(hipPosition.slice(events.takeaway, events.top + 1)) - addressHip,
    impactHipPosition: nanmedian(around(hipPosition, events.impact)),
    finishHipPosition: nanmedian(finishHips),
    finishHipSway: nanmax(finishHips) - nanmin(finishHips),
    topSpineTiltChangeDegrees: nanmedian(around(spineTilt, events.top)) - nanmedian(inAddress(spineTilt)),
    headLateralMovement:
      nanmax(nose.slice(events.takeaway, events.impact + 1).map((p) => Math.abs(p[0] - addressNose[0]))) / torso,
    headRiseAtImpact: (addressNose[1] - medianPoint(around(nose, events.impact))[1]) / torso,
    handLiftAtTop: nanmedian(around(lift, events.top)) - nanmedian(inAddress(lift)),
    trackingQuality: visibilities.reduce((sum, value) => sum + value, 0) / visibilities.length,
  };
}

// Faults: starting heuristics, ordered roughly by teaching priority.

const RULES = [
  { code: "sway", priority: 1.0, value: (f) => f.topHipShift, threshold: -0.15, scale: 0.15, above: false },
  { code: "hanging_back", priority: 0.9, value: (f) => f.finishHipPosition, threshold: 0.65, scale: 0.2, above: false },
  { code: "slide", priority: 0.9, value: (f) => f.impactHipPosition, threshold: 0.95, scale: 0.15, above: true },
  { code: "reverse_spine", priority: 0.8, value: (f) => f.topSpineTiltChangeDegrees, threshold: 8, scale: 8, above: true },
  { code: "head_sway", priority: 0.7, value: (f) => f.headLateralMovement, threshold: 0.3, scale: 0.3, above: true },
  { code: "standing_up", priority: 0.7, value: (f) => f.headRiseAtImpact, threshold: 0.2, scale: 0.2, above: true },
  { code: "rushed_tempo", priority: 0.6, value: (f) => f.tempoRatio, threshold: 2.2, scale: 0.8, above: false },
  { code: "unstable_finish", priority: 0.5, value: (f) => f.finishHipSway, threshold: 0.1, scale: 0.1, above: true },
];

export function assess(features) {
  const found = [];
  for (const rule of RULES) {
    const value = rule.value(features);
    if (Number.isNaN(value)) continue;
    const excess = rule.above ? value - rule.threshold : rule.threshold - value;
    if (excess <= 0) continue;
    const severity = Math.min(excess / rule.scale, 2);
    found.push({ code: rule.code, severity, score: rule.priority * (1 + severity) });
  }
  found.sort((a, b) => b.score - a.score);
  return { features, faults: found, primary: found[0] || null };
}

export function analyzeSwing(recording) {
  const events = findEvents(recording);
  if (events === null) return null;
  const features = extractFeatures(recording, events);
  return features === null ? null : assess(features);
}

// Points, levels and the short tip after each set of swings.

export const FEEDBACK_EVERY = 5;
const LEVELS = [
  [0, "蛋"],
  [10, "雏鸟"],
  [30, "小鸟"],
  [60, "会飞了"],
  [100, "老鹰"],
];
const FAULT_TEXT = {
  sway: ["髋部往后滑", "上杆时转髋，别让髋往后滑。"],
  hanging_back: ["重心留在了后脚", "收杆时把重心送到前脚，皮带扣对着目标。"],
  slide: ["髋部往目标方向冲", "下杆时让髋转开，而不是往前滑。"],
  reverse_spine: ["上杆顶点上身往目标倾", "上杆顶点让上身留在球后面，后肩稍低一点。"],
  head_sway: ["头部移动比较多", "头保持安静，绕着脊柱转。"],
  standing_up: ["击球时身体站起来了", "击球时胸口压住球，保持身体角度。"],
  rushed_tempo: ["节奏有点急", "上杆慢一点，让下杆去发力。"],
  unstable_finish: ["收杆不太稳", "收杆后站稳，保持一秒。"],
};

export function levelOf(points) {
  let index = 0;
  LEVELS.forEach(([needed], candidate) => { if (points >= needed) index = candidate; });
  return {
    level: index + 1,
    name: LEVELS[index][1],
    start: LEVELS[index][0],
    next: index + 1 < LEVELS.length ? LEVELS[index + 1][0] : null,
  };
}

export function setFeedback(reports, setNumber, { analyzed = true } = {}) {
  const opening = `第 ${setNumber} 组 ${reports.length} 杆完成！`;
  if (!analyzed) return `${opening}从后面我看不到身体动作，回看一下视频里的球路吧。`;
  const measured = reports.filter((report) => report !== null);
  if (measured.length * 2 < reports.length) return `${opening}有几杆我没看清全身，下一组让双脚和双手都留在画面里。`;
  const counts = new Map();
  for (const report of measured) {
    if (report.primary) counts.set(report.primary.code, (counts.get(report.primary.code) || 0) + 1);
  }
  let code = null;
  let count = 0;
  for (const [candidate, seen] of counts) {
    if (seen > count) [code, count] = [candidate, seen];
  }
  if (count >= 2 && FAULT_TEXT[code]) {
    const [title, cue] = FAULT_TEXT[code];
    return `${opening}这组有 ${count} 杆${title}。下一组试试：${cue}`;
  }
  return `${opening}这组很稳，没有反复出现的问题，保持住！`;
}

export function guidance(pipeline) {
  if (!pipeline.tracking) return "站到画面里，双脚和双手都要看得到";
  const { phase } = pipeline;
  if (phase === BACKSWING) return "上杆…";
  if (phase === DOWNSWING) return "下杆！";
  if (phase === FOLLOW_THROUGH) return "收杆，站稳";
  if (phase === WAITING_FOR_ADDRESS) return "放下球杆，准备下一杆";
  return pipeline.addressReady ? "准备好了，挥吧！" : "摆好准备姿势，停一下";
}
