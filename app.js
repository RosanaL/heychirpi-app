// Chirpi on the phone: a few questions, then practice. Everything is saved on this phone only.

import { CHEERS, DONE_LINE, HATCH_LINE, levelUpLine, spokenFeedback, START_LINE } from "./lines.js";
import { applyCap, birdKind, CAPS, createOnboarding } from "./onboarding.js";
import { Practice } from "./practice.js";
import { FEEDBACK_EVERY, levelOf } from "./swing.js";
import { askChirpi, audioUrl, canListen, listen, talkSettings } from "./talk.js";
import { isVoicePlaying, playLine, prepareVoice, queueClip, stopVoice, unlockVoice } from "./voice.js";
import { loadRealtime, realtimeAvailable, startRealtime } from "./realtime.js";

const LEVELS = [
  { value: "beginner", label: "刚入门", sub: "还没打过完整的一场" },
  { value: "high_handicap", label: "能下场", sub: "一场通常 100 杆以上" },
  { value: "mid_handicap", label: "有点水平", sub: "一场 85 到 100 杆" },
  { value: "low_handicap", label: "高手", sub: "一场 85 杆以内" },
];
const EXPERIENCE = [
  { value: "under_6_months", label: "不到半年" },
  { value: "6_months_to_2_years", label: "半年到两年" },
  { value: "2_to_5_years", label: "两到五年" },
  { value: "over_5_years", label: "五年以上" },
];
const GOAL_IDEAS = ["打得更远", "打得更稳定", "第一次破 100", "破 90", "改掉右曲球", "享受打球就好"];
const HANDEDNESS = [
  { value: "right", label: "右手打", sub: "左脚靠近目标" },
  { value: "left", label: "左手打", sub: "右脚靠近目标" },
];
const CAMERA_VIEWS = [
  {
    value: "face_on",
    label: "放在侧面",
    sub: "正对着你的胸口，看正面的挥杆动作",
    tips: ["手机靠在球包上竖着放，离你 3 到 5 米", "全身都要入镜，脚和双手都能看到"],
  },
  {
    value: "down_the_line",
    label: "放在后面",
    sub: "在你身后对着目标方向，录下球的轨迹",
    tips: ["放在你身后 3 米左右，对准目标线，别放在球飞的方向上", "这个角度只数杆和录像，不分析身体动作"],
  },
];
// How Chirpi talks during practice. 实时对话 is offered only when its agent is set up.
const VOICE_MODES = [
  { value: "recorded", label: "录好的声音", sub: "每 5 杆说一句建议，不能对话" },
  { value: "realtime", label: "实时对话", sub: "随时跟它聊，它知道你挥了几杆。每次最多 10 分钟，要用麦克风" },
];
// The first-visit chat: the same questions the profile screens edit later, each with its own comeback.
const CHAT_QUESTIONS = [
  {
    key: "level",
    ask: (name) => `${name}，你现在打得怎么样？`,
    items: LEVELS,
    replies: {
      beginner: "刚入门最好玩，每一杆都是新纪录。",
      high_handicap: "能下场就已经赢过好多人啦！",
      mid_handicap: "哦？有两把刷子嘛。",
      low_handicap: "高手！那我得抓紧长大了。",
    },
  },
  {
    key: "experience",
    ask: "打球多久了？",
    items: EXPERIENCE,
    replies: {
      under_6_months: "那我们正好一起从头长大。",
      "6_months_to_2_years": "正是最上瘾的时候，我懂。",
      "2_to_5_years": "这么久，球包里肯定有不少故事。",
      over_5_years: "老将了，以后多罩着我。",
    },
  },
  {
    key: "goal",
    ask: "现在最想达成什么？",
    free: true,
    ideas: GOAL_IDEAS,
    placeholder: "或者用自己的话说说",
    replies: {
      打得更远: "远！我喜欢。那我也要飞得很远。",
      打得更稳定: "稳稳的，那我就当一只靠谱的鸟。",
      "第一次破 100": "好，这个数字我记住了。",
      "破 90": "好，这个数字我记住了。",
      改掉右曲球: "右曲球！我先替你骂它两句。",
      享受打球就好: "这个目标最高级。",
    },
    otherReply: "记下了，这个目标我们一起盯着。",
  },
  {
    key: "handedness",
    ask: "最后一个：你是右手打还是左手打？",
    items: HANDEDNESS,
    replies: { right: "收到，这下我知道该盯哪只脚了。", left: "左手打！收到，我会盯对那只脚。" },
  },
];
const ONBOARDING_SCENES = new Set(["intro", "name", "chat", "match", "cap", "hatch", "card"]);
const MAX_CLIPS = 20; // each is several MB in memory
const FEEDBACK_SECONDS = 12;
const PROFILE_KEY = "chirpi.profile";
const PROGRESS_KEY = "chirpi.progress";
const MUTED_KEY = "chirpi.muted";
const TALK_HISTORY = 12; // earlier turns sent with each new thing the golfer says

function readLocal(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeLocal(key, value) {
  try { localStorage.setItem(key, value); } catch { /* private mode: not remembered */ }
}
function readJson(key) {
  try { return JSON.parse(readLocal(key)); } catch { return null; }
}

// Points survive between visits; one point per swing.
class Progress {
  constructor(saved) {
    const count = (name) => Math.max(0, Math.floor(Number(saved && saved[name])) || 0);
    this.points = count("points");
    this.swings = count("swings");
    this.sessions = count("sessions");
  }

  addSwing() {
    const before = levelOf(this.points).level;
    this.swings += 1;
    this.points += 1;
    this.save();
    const after = levelOf(this.points);
    return after.level > before ? after.name : null;
  }

  save() {
    writeLocal(PROGRESS_KEY, JSON.stringify({ points: this.points, swings: this.swings, sessions: this.sessions }));
  }
}

const savedProfile = readJson(PROFILE_KEY);
const state = {
  profile: { name: "", level: null, experience: null, goal: "", handedness: "right", camera_view: "face_on", voice_mode: "recorded", cap: CAPS[0].value, ...savedProfile },
  step: savedProfile ? "home" : "intro",
  editing: false,
  chatIndex: 0,
  progress: new Progress(readJson(PROGRESS_KEY)),
  muted: readLocal(MUTED_KEY) === "1",
  session: { swings: 0, clips: [], error: "", lastFeedback: "" },
  talk: { settings: talkSettings(), history: [], status: "idle" }, // idle | listening | thinking
  live: { call: null, status: "off", micOpen: true }, // 实时对话: off | connecting | on
};

const bird = document.getElementById("bird");
const bubble = document.getElementById("bubble");
const panel = document.getElementById("panel");
const progressBar = document.querySelector(".progress");
const progressFill = document.getElementById("progress-fill");

let practice = null;
let view = null;
let feedbackUntil = 0;

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "onclick" || key === "oninput") node[key] = value;
    else if (key === "text") node.textContent = value;
    else if (value !== false && value != null) node.setAttribute(key, value === true ? "" : value);
  }
  for (const child of [].concat(children)) if (child) node.append(child);
  return node;
}

const ICONS = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  speaker: '<path d="M4 9.5v5h3.5L13 19V5L7.5 9.5H4z"/><path d="M16.5 9a4 4 0 0 1 0 6"/><path d="M19 6.5a8 8 0 0 1 0 11"/>',
  muted: '<path d="M4 9.5v5h3.5L13 19V5L7.5 9.5H4z"/><path d="M17 9.5l4.5 5"/><path d="M21.5 9.5l-4.5 5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="2.5" fill="currentColor" stroke="none"/>',
  flip: '<path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5"/><path d="M20 4v4.5h-4.5"/><path d="M20 12a8 8 0 0 1-13.7 5.6L4 15.5"/><path d="M4 20v-4.5h4.5"/>',
};

function icon(name) {
  const holder = document.createElement("template");
  holder.innerHTML = `<svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
  return holder.content.firstChild;
}

// Bird reactions: hop (new question), cheer (+1), celebrate (level up), talk (feedback).
function react(mood) {
  bird.classList.remove("hop", "cheer", "celebrate", "talk");
  void bird.getBoundingClientRect();
  bird.classList.add(mood);
}

function say(text, sub, mood = "hop") {
  bubble.replaceChildren(text, sub ? el("small", { text: sub }) : "");
  react(mood);
}

function pickChineseVoice() {
  const voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
  return voices.find((v) => v.lang === "zh-CN" && v.localService) || voices.find((v) => v.lang.startsWith("zh")) || null;
}

// Cheers are skipped while Chirpi is already talking; tips cut in.
function speak(text, { important = true } = {}) {
  if (state.muted || !text || state.talk.status !== "idle") return; // never talk over the golfer
  if (state.live.status !== "off") return; // in 实时对话 Chirpi speaks for itself
  const talking = isVoicePlaying() || (window.speechSynthesis && speechSynthesis.speaking);
  if (talking && !important) return;
  if (window.speechSynthesis) speechSynthesis.cancel();
  if (!playLine(text, () => speakWithSystemVoice(text))) speakWithSystemVoice(text);
}

// For a line with no recording yet, or if the browser won't play the recording.
function speakWithSystemVoice(text) {
  if (!window.speechSynthesis) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  const chosen = pickChineseVoice();
  if (chosen) utterance.voice = chosen;
  utterance.rate = 1.05;
  speechSynthesis.speak(utterance);
}

// Only for lines that are recorded: a robot voice would spoil the moment, so otherwise stay quiet.
function speakRecorded(text) {
  if (!state.muted) playLine(text, () => {});
}

function go(step) {
  state.step = step;
  render();
}

// The keyboard only opens when the golfer taps a field. Once it has slid up, if the field
// (and the button right after it) ended up underneath, scroll them back into sight.
document.addEventListener("focusin", (event) => {
  const field = event.target;
  if (!field.matches("input, textarea") || !window.visualViewport) return;
  setTimeout(() => {
    const view = window.visualViewport;
    const group = field.closest(".ask, .chat-send") || field;
    const hidden = group.getBoundingClientRect().bottom + 16 - (view.offsetTop + view.height);
    if (hidden > 0) window.scrollBy({ top: hidden, behavior: "smooth" });
  }, 350);
});

function optionList(items, selected, onPick) {
  return items.map((item) =>
    el("button", {
      class: "option",
      type: "button",
      "aria-pressed": String(item.value === selected),
      onclick: () => onPick(item.value),
    }, [
      el("strong", { text: item.label }),
      item.sub ? el("span", { class: "sub", text: item.sub }) : null,
    ]),
  );
}

function backButton(step) {
  return el("button", { class: "back", type: "button", "aria-label": "上一步", onclick: () => go(step) }, [icon("back")]);
}

// The small level bar across the top of the camera.
function labelOf(items, value) {
  return (items.find((item) => item.value === value) || {}).label || "";
}

function saveProfile() {
  writeLocal(PROFILE_KEY, JSON.stringify(state.profile));
}

function levelCard() {
  const { points } = state.progress;
  const { level, name, start, next } = levelOf(points);
  const percent = next ? Math.round(((points - start) / (next - start)) * 100) : 100;
  const hint = next ? `再挥 ${next - points} 杆升级` : "已经是最高级啦";
  return el("div", { class: "level-card" }, [
    el("div", { class: "level-head" }, [
      el("strong", { text: `Lv.${level} ${name}` }),
      el("span", { text: `${points} 分 · ${hint}` }),
    ]),
    el("div", { class: "level-bar" }, [el("span", { style: `width: ${percent}%` })]),
  ]);
}

// iPhones only offer "Save Video" (to Photos) through the share sheet; a plain download goes to Files.
async function shareClip(file, link) {
  try {
    await navigator.share({ files: [file] });
  } catch (problem) {
    if (problem.name === "AbortError") return; // they closed the share sheet
    link.onclick = null;
    link.click();
  }
}

function clipFigure(clip) {
  const video = el("video", {
    src: `${clip.url}#t=${clip.offset}`, controls: true, playsinline: true, muted: true, preload: "metadata", // the #t gives iPhones a thumbnail
    class: clip.mirrored ? "mirror" : null,
  });
  // Each video starts a little before the swing; open it at the swing.
  video.addEventListener("loadedmetadata", () => { video.currentTime = clip.offset; });
  // Playing again rewinds to the very start of the file, so go back to the swing instead.
  video.addEventListener("play", () => { if (video.currentTime < clip.offset) video.currentTime = clip.offset; });
  const name = `chirpi-swing-${clip.swing}.${clip.blob.type.includes("mp4") ? "mp4" : "webm"}`;
  const file = new File([clip.blob], name, { type: clip.blob.type });
  const save = el("a", { href: clip.url, download: name, text: "保存" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    save.onclick = (click) => {
      click.preventDefault();
      shareClip(file, save);
    };
  }
  return el("figure", { class: "clip" }, [video, el("figcaption", {}, [el("span", { text: `第 ${clip.swing} 杆` }), save])]);
}

function cameraError(problem) {
  if (problem && problem.name === "NotAllowedError") {
    return "没有摄像头权限。在 iPhone 上：设置 › Safari › 摄像头 选“允许”，再回来重新开始。";
  }
  if (problem && problem.name === "NotFoundError") return "这台设备上没有找到摄像头。";
  return (problem && problem.message) || "摄像头打不开，换 Safari 试试。";
}

const screens = {
  level() {
    say("你现在打得怎么样？");
    return [
      backButton("summary"),
      ...optionList(LEVELS, state.profile.level, (value) => { state.profile.level = value; go("summary"); }),
    ];
  },

  experience() {
    say("打球多久了？");
    return [
      backButton("summary"),
      ...optionList(EXPERIENCE, state.profile.experience, (value) => { state.profile.experience = value; go("summary"); }),
    ];
  },

  goal() {
    say("现在最想达成的目标是什么？", "选一个，或者用自己的话说说。");
    const textarea = el("textarea", {
      maxlength: "200",
      placeholder: "比如：这个月想把一号木打直",
      "aria-label": "你的目标",
      oninput: () => { state.profile.goal = textarea.value; next.disabled = !textarea.value.trim(); },
    });
    textarea.value = state.profile.goal;
    const next = el("button", {
      class: "fab", type: "button", "aria-label": "下一步",
      disabled: !state.profile.goal.trim(),
      onclick: () => go("summary"),
    }, [icon("next")]);
    const chips = el("div", { class: "chips" }, GOAL_IDEAS.map((idea) =>
      el("button", {
        class: "chip", type: "button", text: idea,
        "aria-pressed": String(state.profile.goal === idea),
        onclick: () => { state.profile.goal = idea; render(); },
      }),
    ));
    return [backButton("summary"), chips, textarea, next];
  },

  handedness() {
    say("你是右手打还是左手打？", "分析动作时要分清哪只脚靠近目标。");
    return [
      backButton("summary"),
      ...optionList(HANDEDNESS, state.profile.handedness, (value) => { state.profile.handedness = value; go("summary"); }),
    ];
  },

  summary() {
    say("好嘞，我记住了！", "有不对的点一下就能改。");
    state.editing = true;
    const rows = [
      ["名字", state.profile.name, "name"],
      ["水平", labelOf(LEVELS, state.profile.level), "level"],
      ["球龄", labelOf(EXPERIENCE, state.profile.experience), "experience"],
      ["目标", state.profile.goal, "goal"],
      ["打法", labelOf(HANDEDNESS, state.profile.handedness), "handedness"],
      ["帽子", labelOf(CAPS, state.profile.cap), "cap"],
    ];
    return [
      el("dl", { class: "summary" }, rows.map(([name, value, step]) =>
        el("div", {}, [
          el("dt", { text: name }),
          el("dd", {}, [value, " ", el("button", { class: "link", type: "button", text: "改", "aria-label": `修改${name}`, onclick: () => go(step) })]),
        ]),
      )),
      el("div", { class: "actions" }, [
        el("button", {
          class: "primary", type: "button", text: "保存",
          onclick: () => { saveProfile(); state.editing = false; go("home"); },
        }),
      ]),
    ];
  },

  home() {
    say(state.profile.name ? `${state.profile.name}，今天想练点什么？` : "今天想练点什么？", state.profile.goal ? `你的目标：${state.profile.goal}` : "");
    return [
      levelCard(),
      el("p", { class: "note", text: "早期测试版，判断还在校准，建议仅供参考。哪里疼就先停下休息。" }),
      el("p", { class: "note", text: "想像 App 一样打开：在 Safari 点分享按钮，选“添加到主屏幕”。" }),
      el("div", { class: "actions" }, [
        el("button", { class: "primary", type: "button", text: "开始一次练球", onclick: () => go("camera") }),
      ]),
      el("button", { class: "link quiet-link", type: "button", text: "修改我的资料", onclick: () => { state.editing = true; go("summary"); } }),
    ];
  },

  camera() {
    say("手机放哪儿？", "两种都可以，看你今天想练什么。");
    const chosen = CAMERA_VIEWS.find((item) => item.value === state.profile.camera_view);
    return [
      backButton("home"),
      ...optionList(CAMERA_VIEWS, state.profile.camera_view, (value) => { state.profile.camera_view = value; saveProfile(); render(); }),
      chosen ? el("ul", { class: "tips" }, [...chosen.tips, "练球时屏幕要一直亮着。如果手机自己锁屏了，把 设置 › 显示与亮度 › 自动锁定 调成“永不”。"].map((tip) => el("li", { text: tip }))) : null,
      ...voiceChoice(),
      state.session.error ? el("p", { class: "note error", text: state.session.error }) : null,
      el("div", { class: "actions" }, [
        el("button", { class: "primary", type: "button", text: "就这样，开始", onclick: startPractice }),
      ]),
    ];
  },

  practice() {
    say("准备好了就挥吧！", realtimeChosen()
      ? `每挥一杆加一分，想聊随时说，每 ${FEEDBACK_EVERY} 杆我给你一个小建议。`
      : `每挥一杆加一分，每 ${FEEDBACK_EVERY} 杆我给你一个小建议。`);
    const stop = el("button", {
      class: "finish", type: "button",
      onclick: async () => { stop.disabled = true; await stopPractice(); },
    }, [icon("stop"), "练完了"]);
    view = {
      set: el("span", { class: "session-chip" }),
      timer: el("span", { class: "session-chip", "aria-label": "练了多久" }),
      levelName: el("span"),
      levelHint: el("span"),
      levelFill: el("span"),
      setHint: el("p", { class: "set-hint" }),
      video: el("video", { class: "live", playsinline: true, muted: true, autoplay: true }),
      canvas: el("canvas", { class: "live overlay", "aria-hidden": "true" }),
      guidance: el("p", { class: "guidance", text: "小鸟正在热身…" }),
      score: el("span", { class: "score-value", text: "0" }),
      pop: el("span", { class: "pop", "aria-hidden": "true", text: "+1" }),
      dots: el("div", { class: "dots", "aria-label": "这一组的进度" }),
      error: el("p", { class: "note error", hidden: true }),
      mute: el("button", { class: "control", type: "button", onclick: toggleMute }),
      flip: el("button", {
        class: "control", type: "button", "aria-label": "换前后摄像头",
        onclick: async () => {
          view.flip.disabled = true;
          try {
            await practice.flipCamera();
          } catch (problem) {
            showPracticeError(cameraError(problem));
          }
          if (view) view.flip.disabled = false;
        },
      }, [icon("flip")]),
      talk: realtimeChosen()
        ? el("button", { class: "control talk", type: "button", onclick: toggleLiveMic })
        : state.talk.settings && canListen() ? el("button", { class: "control talk", type: "button", onclick: talkToChirpi }) : null,
    };
    view.wrap = el("div", { class: "live-wrap" }, [view.video, view.canvas, view.guidance]);
    updatePracticeView();
    tickTimer();
    return [
      view.wrap,
      el("div", { class: "session-top" }, [view.set, view.timer]),
      el("div", { class: "practice-bottom" }, [
        view.error,
        el("div", { class: "hud" }, [
          el("div", { class: "score" }, [view.score, el("span", { class: "score-label", text: "杆" }), view.pop]),
          view.dots,
          view.setHint,
        ]),
        el("div", { class: "session-level" }, [
          el("div", { class: "level-bar" }, [view.levelFill]),
          el("p", { class: "level-line" }, [view.levelName, view.levelHint]),
        ]),
        el("div", { class: "controls" }, [stop, view.talk, view.mute, view.flip]),
      ]),
    ];
  },

  practice_summary() {
    const { swings, clips } = state.session;
    if (swings) {
      say(`今天挥了 ${swings} 杆，太棒了！`, `拿到 ${swings} 分。`, "celebrate");
      speak(DONE_LINE);
    } else {
      say("这次没有数到挥杆", "下次站到画面里，双脚和双手都要看得到。");
    }
    return [
      levelCard(),
      clips.length ? el("p", { class: "section-title", text: "这次的挥杆" }) : null,
      clips.length ? el("div", { class: "clips" }, clips.map(clipFigure)) : null,
      clips.length ? el("p", { class: "note", text: "视频只留到关闭页面。想留着就点“保存”，再选“存储视频”，就会进相册。" }) : null,
      el("div", { class: "actions" }, [
        el("button", { class: "primary", type: "button", text: "回主页", onclick: () => go("home") }),
      ]),
    ];
  },
};

function toggleMute() {
  state.muted = !state.muted;
  writeLocal(MUTED_KEY, state.muted ? "1" : "0");
  if (state.muted) {
    stopVoice();
    if (window.speechSynthesis) speechSynthesis.cancel();
  }
  if (state.live.call) state.live.call.setMuted(state.muted);
  updatePracticeView();
}

function updatePracticeView() {
  if (!view) return;
  const { swings } = state.session;
  view.score.textContent = String(swings);
  const inSet = swings % FEEDBACK_EVERY || (swings ? FEEDBACK_EVERY : 0);
  view.dots.replaceChildren(...Array.from({ length: FEEDBACK_EVERY }, (_, index) =>
    el("span", { class: index < inSet ? "dot on" : "dot" }),
  ));
  const left = FEEDBACK_EVERY - (swings % FEEDBACK_EVERY);
  view.set.textContent = `第 ${Math.floor(swings / FEEDBACK_EVERY) + 1} 组`;
  view.setHint.textContent = `再 ${left} 杆，它给你这组的话。`;
  const { level, name, start, next } = levelOf(state.progress.points);
  view.levelName.textContent = `Lv.${level} ${name}`;
  view.levelHint.textContent = next ? `再 ${next - state.progress.points} 杆升级` : "最高级了";
  view.levelFill.style.width = `${next ? Math.round(((state.progress.points - start) / (next - start)) * 100) : 100}%`;
  view.mute.replaceChildren(icon(state.muted ? "muted" : "speaker"));
  view.mute.classList.toggle("off", state.muted);
  view.mute.setAttribute("aria-label", state.muted ? "Chirpi 静音中，点一下打开" : "Chirpi 会说话，点一下静音");
  if (view.talk && realtimeChosen()) {
    const { status, micOpen } = state.live;
    view.talk.replaceChildren(icon("mic"));
    view.talk.classList.toggle("listening", status === "on" && micOpen);
    view.talk.classList.toggle("off", status === "on" && !micOpen);
    view.talk.disabled = status !== "on";
    view.talk.setAttribute("aria-label", status === "connecting" ? "实时对话连接中" : status === "off" ? "实时对话已结束"
      : micOpen ? "Chirpi 在听，点一下关麦克风" : "麦克风关着，点一下打开");
  } else if (view.talk) {
    const { status } = state.talk;
    view.talk.replaceChildren(icon("mic"));
    view.talk.classList.toggle("listening", status === "listening");
    view.talk.disabled = status === "thinking";
    view.talk.setAttribute("aria-label", status === "listening" ? "说完了" : "跟 Chirpi 说话");
  }
}

let timerId = 0;

function tickTimer() {
  clearTimeout(timerId);
  if (!view) return;
  const seconds = Math.floor((Date.now() - (state.session.startedAt || Date.now())) / 1000);
  const pad = (n) => String(n).padStart(2, "0");
  view.timer.textContent = `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
  timerId = setTimeout(tickTimer, 1000);
}

// What Chirpi knows when it answers: the profile and this practice, never the video.
function talkContext() {
  const { profile } = state;
  const kind = profile.archetype ? birdKind(profile.archetype) : null;
  return {
    name: profile.name,
    level: labelOf(LEVELS, profile.level),
    experience: labelOf(EXPERIENCE, profile.experience),
    goal: profile.goal,
    handedness: labelOf(HANDEDNESS, profile.handedness),
    bird: kind ? `${kind.name}（${kind.tags.join("、")}）` : "",
    swings: state.session.swings,
    camera: labelOf(CAMERA_VIEWS, profile.camera_view),
    last_feedback: state.session.lastFeedback,
  };
}

function setTalkStatus(status) {
  state.talk.status = status;
  updatePracticeView();
}

let listening = null;

async function talkToChirpi() {
  if (listening) { listening.stop(); return; }
  if (state.talk.status !== "idle") return;
  stopVoice();
  if (window.speechSynthesis) speechSynthesis.cancel();
  feedbackUntil = Infinity; // swings meanwhile still count, but don't cover the conversation with cheers
  say("我在听…", "说完停一下就好", "talk");
  setTalkStatus("listening");
  let text = "";
  try {
    listening = listen({ onHeard: (heard) => say(`“${heard}”`, "我在听…", "talk") });
    text = await listening.done;
  } catch (problem) {
    say(problem.message, "", "hop");
  }
  listening = null;
  if (!text) {
    if (state.talk.status === "listening") say("没听到你说话", "再点一下麦克风试试。", "hop");
    setTalkStatus("idle");
    return;
  }
  setTalkStatus("thinking");
  say(`“${text}”`, "Chirpi 在想…", "talk");
  let reply = "";
  try {
    await askChirpi({
      settings: state.talk.settings,
      text,
      history: state.talk.history,
      context: talkContext(),
      onLine: ({ text: line, audio }) => {
        reply += line;
        say(reply, "", "talk");
        if (audio && !state.muted) queueClip(audioUrl(audio));
      },
    });
  } catch (problem) {
    say(reply || problem.message, reply ? problem.message : "", "hop");
  }
  if (reply) {
    state.talk.history = [...state.talk.history, { role: "user", text }, { role: "assistant", text: reply }].slice(-TALK_HISTORY);
  }
  feedbackUntil = Date.now() + FEEDBACK_SECONDS * 1000; // let the reply stay up instead of the next cheer
  setTalkStatus("idle");
}

// 实时对话 ----------------------------------------------------------------------------------

function realtimeChosen() {
  return realtimeAvailable() && state.profile.voice_mode === "realtime";
}

function voiceChoice() {
  if (!realtimeAvailable()) return [];
  if (realtimeChosen()) loadRealtime().catch(() => {}); // ready before the tap that starts
  return [
    el("p", { class: "section-title", text: "Chirpi 怎么陪你" }),
    ...optionList(VOICE_MODES, state.profile.voice_mode, (value) => { state.profile.voice_mode = value; saveProfile(); render(); }),
  ];
}

// What Chirpi knows when the call starts, in plain words; the camera adds swings and tips as they come.
function liveContext() {
  const context = talkContext();
  const facts = [
    context.name && `名字：${context.name}`,
    context.level && `水平：${context.level}`,
    context.experience && `球龄：${context.experience}`,
    context.goal && `目标：${context.goal}`,
    context.handedness && `习惯：${context.handedness}`,
    context.bird && `Chirpi 是：${context.bird}`,
    context.camera && `手机：${context.camera}`,
  ].filter(Boolean);
  const analysis = state.profile.camera_view === "face_on" ? "" : "这个角度只数杆和录像，没有动作建议。";
  return `练球刚开始，还没有挥杆。球手资料：${facts.join("；")}。${analysis}`;
}

function setLive(next) {
  state.live = { ...state.live, ...next };
  updatePracticeView();
}

async function startLive() {
  setLive({ call: null, status: "connecting", micOpen: true });
  const name = state.profile.name;
  try {
    const call = await startRealtime({
      firstMessage: `${name ? `${name}，` : ""}我在旁边看着呢！准备好了就挥，想聊随时说。`,
      context: liveContext(),
      onMessage: (who, text) => {
        if (!view) return;
        if (who === "golfer") { say(`“${text}”`, "", "talk"); return; }
        say(text, "", "talk");
        feedbackUntil = Date.now() + FEEDBACK_SECONDS * 1000; // keep its words up instead of the next cheer
      },
      onMode: (mode) => { if (mode === "speaking" && view) react("talk"); },
      onEnd: () => liveEnded("实时对话到时间了", "接下来我用录好的声音陪你。"),
    });
    if (state.live.status !== "connecting") { await call.end(); return; } // practice ended meanwhile
    if (state.muted) call.setMuted(true);
    setLive({ call, status: "on" });
  } catch (problem) {
    console.error(problem);
    if (state.live.status === "connecting") liveEnded("实时对话没连上", "这次先用录好的声音陪你。");
  }
}

function liveEnded(text, sub) {
  setLive({ call: null, status: "off" });
  if (view) say(text, sub, "hop");
}

async function endLive() {
  const { call } = state.live;
  state.live = { call: null, status: "off", micOpen: true };
  if (call) {
    try { await call.end(); } catch (problem) { console.error(problem); }
  }
}

function toggleLiveMic() {
  const { call, micOpen } = state.live;
  if (!call) return;
  call.setMicMuted(micOpen);
  setLive({ micOpen: !micOpen });
}

function showPracticeError(text) {
  if (!view) return;
  view.error.textContent = text;
  view.error.hidden = false;
}

const practiceHandlers = {
  onGuidance(text) {
    if (!view || view.guidance.textContent === text) return;
    view.guidance.textContent = text;
    view.guidance.hidden = !text;
  },
  onSwing({ swing, levelUp }) {
    state.session.swings = swing;
    const { call } = state.live;
    if (call) {
      call.tell(`球手挥了第 ${swing} 杆。`);
      if (levelUp) call.ask(`球手刚升到「${levelUp}」这一级，开心地恭喜一句。`);
    }
    if (levelUp) {
      const text = levelUpLine(levelUp);
      say(text, "继续加油！", "celebrate");
      speak(text);
    } else if (Date.now() < feedbackUntil) {
      react("cheer");
    } else {
      const cheer = CHEERS[(swing - 1) % CHEERS.length];
      say(cheer, `第 ${swing} 杆 · +1 分`, "cheer");
      speak(cheer, { important: false });
    }
    updatePracticeView();
    if (view) {
      view.pop.classList.remove("show");
      void view.pop.offsetWidth;
      view.pop.classList.add("show");
    }
  },
  onClip(clip) {
    const { clips } = state.session;
    clips.push(clip);
    if (clips.length > MAX_CLIPS) URL.revokeObjectURL(clips.shift().url);
    if (view) updatePracticeView();
    else if (state.step === "practice_summary") render();
  },
  onFeedback(text) {
    state.session.lastFeedback = text;
    say(text, "", "talk");
    const { call } = state.live;
    if (call) call.ask(`球手挥完了第 ${state.session.swings} 杆。这一组的建议：${text}。用你的话跟球手说。`);
    else if (state.talk.status === "idle") speak(spokenFeedback(text));
    feedbackUntil = Date.now() + FEEDBACK_SECONDS * 1000;
  },
  onError: showPracticeError,
};

async function startPractice() {
  for (const clip of state.session.clips) URL.revokeObjectURL(clip.url);
  state.session = { swings: 0, clips: [], error: "", lastFeedback: "", startedAt: Date.now() };
  unlockVoice();
  if (realtimeChosen()) startLive(); // in the tap, so the phone lets the call use the mic and speaker
  else speak(START_LINE); // iPhones only allow speech after a tap; this tap unlocks the system voice too
  go("practice");
  practice = new Practice({
    video: view.video,
    canvas: view.canvas,
    analyze: state.profile.camera_view === "face_on",
    handedness: state.profile.handedness,
    facing: "user",
    progress: state.progress,
    handlers: practiceHandlers,
  });
  try {
    await practice.start();
  } catch (problem) {
    console.error(problem);
    practice.closeCamera();
    practice = null;
    await endLive();
    state.session.error = cameraError(problem);
    go("camera");
  }
}

async function stopPractice() {
  if (listening) listening.stop();
  await endLive();
  if (practice) await practice.stop();
  practice = null;
  state.progress.save();
  go("practice_summary");
}

const onboarding = createOnboarding({
  el, icon, state, go, say,
  setProgress: (fraction) => { progressFill.style.width = `${Math.round(fraction * 100)}%`; },
  saveProfile, speakRecorded, unlockVoice,
  questions: CHAT_QUESTIONS,
  hatchLine: HATCH_LINE,
});
Object.assign(screens, onboarding.screens);

function render() {
  onboarding.cancel();
  if (state.step !== "practice") view = null;
  document.body.classList.toggle("practicing", state.step === "practice");
  document.body.classList.toggle("onboarding", ONBOARDING_SCENES.has(state.step));
  document.body.classList.toggle("revealing", state.step === "reveal");
  progressBar.classList.toggle("hidden", state.step !== "chat");
  panel.replaceChildren(...screens[state.step]().filter(Boolean));
}

applyCap(state.profile.cap);
render();
prepareVoice();
