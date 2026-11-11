// Chirpi on the phone: a few questions, then practice. Everything is saved on this phone only.

import { CHEERS, HATCH_LINE, levelUpLine, spokenFeedback } from "./lines.js";
import { applyCap, birdKind, CAPS, createOnboarding } from "./onboarding.js";
import { Practice } from "./practice.js";
import { FEEDBACK_EVERY, levelOf } from "./swing.js";
import { askChirpi, audioUrl, canListen, listen, talkSettings } from "./talk.js";
import { playLine, prepareVoice, queueClip, stopVoice, unlockVoice } from "./voice.js";
import { loadRealtime, realtimeAvailable, startRealtime } from "./realtime.js";
import { LANG, tr } from "./i18n.js";

const LEVELS = [
  { value: "beginner", label: tr("刚入门", "Just starting"), sub: tr("还没打过完整的一场", "Haven't played a full round yet") },
  { value: "high_handicap", label: tr("能下场", "On the course"), sub: tr("一场通常 100 杆以上", "Usually 100+ a round") },
  { value: "mid_handicap", label: tr("有点水平", "Getting good"), sub: tr("一场 85 到 100 杆", "85 to 100 a round") },
  { value: "low_handicap", label: tr("高手", "Low handicap"), sub: tr("一场 85 杆以内", "Under 85 a round") },
];
const EXPERIENCE = [
  { value: "under_6_months", label: tr("不到半年", "Under 6 months") },
  { value: "6_months_to_2_years", label: tr("半年到两年", "6 months to 2 years") },
  { value: "2_to_5_years", label: tr("两到五年", "2 to 5 years") },
  { value: "over_5_years", label: tr("五年以上", "Over 5 years") },
];
const GOAL_IDEAS = tr(
  ["打得更远", "打得更稳定", "第一次破 100", "破 90", "改掉右曲球", "享受打球就好"],
  ["Hit it farther", "Be more consistent", "Break 100", "Break 90", "Fix my slice", "Just enjoy the game"],
);
const HANDEDNESS = [
  { value: "right", label: tr("右手打", "Right-handed"), sub: tr("左脚靠近目标", "Left foot nearer the target") },
  { value: "left", label: tr("左手打", "Left-handed"), sub: tr("右脚靠近目标", "Right foot nearer the target") },
];
const CAMERA_VIEWS = [
  {
    value: "face_on",
    label: tr("放在侧面", "To your side"),
    sub: tr("正对着你的胸口，看正面的挥杆动作", "Facing your chest, to watch your swing from the front"),
    tips: tr(
      ["手机靠在球包上竖着放，离你 3 到 5 米", "全身都要入镜，脚和双手都能看到"],
      ["Stand the phone upright against your bag, 3 to 5 meters away", "Get your whole body in frame, feet and hands included"],
    ),
  },
  {
    value: "down_the_line",
    label: tr("放在后面", "Behind you"),
    sub: tr("在你身后对着目标方向，录下球的轨迹", "Behind you facing the target, to record the ball flight"),
    tips: tr(
      ["放在你身后 3 米左右，对准目标线，别放在球飞的方向上", "这个角度只数杆和录像，不分析身体动作"],
      ["About 3 meters behind you on the target line, never where the ball flies", "From here Chirpi counts and records swings but doesn't analyze your body"],
    ),
  },
];
// How Chirpi talks during practice. Real-time chat is offered only when its agent is set up.
const VOICE_MODES = [
  { value: "recorded", label: tr("录好的声音", "Recorded voice"), sub: tr("每 5 杆说一句建议，不能对话", "A tip every 5 swings, no conversation") },
  { value: "realtime", label: tr("实时对话", "Real-time chat"), sub: tr("随时跟它聊，它知道你挥了几杆。每次最多 10 分钟，要用麦克风", "Talk any time; it knows how many swings you've hit. Up to 10 minutes, uses the mic") },
];
// The first-visit chat: the same questions the profile screens edit later, each with its own comeback.
const CHAT_QUESTIONS = [
  {
    key: "level",
    ask: (name) => tr(`${name}，你现在打得怎么样？`, `${name}, how's your golf these days?`),
    items: LEVELS,
    replies: tr({
      beginner: "刚入门最好玩，每一杆都是新纪录。",
      high_handicap: "能下场就已经赢过好多人啦！",
      mid_handicap: "哦？有两把刷子嘛。",
      low_handicap: "高手！那我得抓紧长大了。",
    }, {
      beginner: "The beginning is the best part. Every swing is a new record.",
      high_handicap: "Getting out on the course already beats a lot of people!",
      mid_handicap: "Oh? Somebody knows what they're doing.",
      low_handicap: "A pro! I'd better grow up fast.",
    }),
  },
  {
    key: "experience",
    ask: tr("打球多久了？", "How long have you been playing?"),
    items: EXPERIENCE,
    replies: tr({
      under_6_months: "那我们正好一起从头长大。",
      "6_months_to_2_years": "正是最上瘾的时候，我懂。",
      "2_to_5_years": "这么久，球包里肯定有不少故事。",
      over_5_years: "老将了，以后多罩着我。",
    }, {
      under_6_months: "Then we get to grow up together from the start.",
      "6_months_to_2_years": "That's when it gets addictive. I get it.",
      "2_to_5_years": "That long? Your bag must be full of stories.",
      over_5_years: "A veteran! Please look out for me.",
    }),
  },
  {
    key: "goal",
    ask: tr("现在最想达成什么？", "What do you most want to achieve?"),
    free: true,
    ideas: GOAL_IDEAS,
    placeholder: tr("或者用自己的话说说", "Or say it in your own words"),
    replies: {
      打得更远: "远！我喜欢。那我也要飞得很远。",
      打得更稳定: "稳稳的，那我就当一只靠谱的鸟。",
      "第一次破 100": "好，这个数字我记住了。",
      "破 90": "好，这个数字我记住了。",
      改掉右曲球: "右曲球！我先替你骂它两句。",
      享受打球就好: "这个目标最高级。",
      "Hit it farther": "Far! I love it. Then I'll fly far too.",
      "Be more consistent": "Steady it is. I'll be one reliable bird.",
      "Break 100": "Got it. I'll remember that number.",
      "Break 90": "Got it. I'll remember that number.",
      "Fix my slice": "The slice! Let me boo it for you first.",
      "Just enjoy the game": "The best goal there is.",
    },
    otherReply: tr("记下了，这个目标我们一起盯着。", "Noted. We'll keep an eye on that goal together."),
  },
  {
    key: "handedness",
    ask: tr("最后一个：你是右手打还是左手打？", "Last one: do you swing right-handed or left-handed?"),
    items: HANDEDNESS,
    replies: tr(
      { right: "收到，这下我知道该盯哪只脚了。", left: "左手打！收到，我会盯对那只脚。" },
      { right: "Got it, now I know which foot to watch.", left: "A lefty! Got it, I'll watch the right foot." },
    ),
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
    const before = levelOf(this.points, LANG).level;
    this.swings += 1;
    this.points += 1;
    this.save();
    const after = levelOf(this.points, LANG);
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

const SPEECH_LANG = tr("zh-CN", "en-US");

function pickSystemVoice() {
  const voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
  const family = SPEECH_LANG.slice(0, 2);
  return voices.find((v) => v.lang === SPEECH_LANG && v.localService) || voices.find((v) => v.lang.startsWith(family)) || null;
}

// Chirpi only speaks the swing analysis (each set's tip); cheers, levels and the like are on screen only.
function speak(text) {
  if (state.muted || !text || state.talk.status !== "idle") return; // never talk over the golfer
  if (state.live.status !== "off") return; // in 实时对话 Chirpi speaks for itself
  if (window.speechSynthesis) speechSynthesis.cancel();
  if (!playLine(text, () => speakWithSystemVoice(text))) speakWithSystemVoice(text);
}

// For a line with no recording yet, or if the browser won't play the recording.
function speakWithSystemVoice(text) {
  if (!window.speechSynthesis) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = SPEECH_LANG;
  const chosen = pickSystemVoice();
  if (chosen) utterance.voice = chosen;
  utterance.rate = 1.05;
  speechSynthesis.speak(utterance);
}

// iPhones only allow speech after a tap. A silent utterance in the tap that starts practice
// unlocks the system voice for the tips that fall back to it.
function unlockSystemVoice() {
  if (!window.speechSynthesis) return;
  const silent = new SpeechSynthesisUtterance(" ");
  silent.volume = 0;
  speechSynthesis.speak(silent);
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
  return el("button", { class: "back", type: "button", "aria-label": tr("上一步", "Back"), onclick: () => go(step) }, [icon("back")]);
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
  const { level, name, start, next } = levelOf(points, LANG);
  const percent = next ? Math.round(((points - start) / (next - start)) * 100) : 100;
  const hint = next ? tr(`再挥 ${next - points} 杆升级`, `${next - points} swings to level up`) : tr("已经是最高级啦", "Top level reached");
  return el("div", { class: "level-card" }, [
    el("div", { class: "level-head" }, [
      el("strong", { text: `Lv.${level} ${name}` }),
      el("span", { text: tr(`${points} 分 · ${hint}`, `${points} pts · ${hint}`) }),
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
  const save = el("a", { href: clip.url, download: name, text: tr("保存", "Save") });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    save.onclick = (click) => {
      click.preventDefault();
      shareClip(file, save);
    };
  }
  return el("figure", { class: "clip" }, [video, el("figcaption", {}, [el("span", { text: tr(`第 ${clip.swing} 杆`, `Swing ${clip.swing}`) }), save])]);
}

function cameraError(problem) {
  if (problem && problem.name === "NotAllowedError") {
    return tr("没有摄像头权限。在 iPhone 上：设置 › Safari › 摄像头 选“允许”，再回来重新开始。",
      "No camera permission. On iPhone: Settings › Safari › Camera, choose Allow, then come back and start again.");
  }
  if (problem && problem.name === "NotFoundError") return tr("这台设备上没有找到摄像头。", "No camera found on this device.");
  return (problem && problem.message) || tr("摄像头打不开，换 Safari 试试。", "The camera won't open. Try Safari.");
}

const screens = {
  level() {
    say(tr("你现在打得怎么样？", "How's your golf these days?"));
    return [
      backButton("summary"),
      ...optionList(LEVELS, state.profile.level, (value) => { state.profile.level = value; go("summary"); }),
    ];
  },

  experience() {
    say(tr("打球多久了？", "How long have you been playing?"));
    return [
      backButton("summary"),
      ...optionList(EXPERIENCE, state.profile.experience, (value) => { state.profile.experience = value; go("summary"); }),
    ];
  },

  goal() {
    say(tr("现在最想达成的目标是什么？", "What's your goal right now?"), tr("选一个，或者用自己的话说说。", "Pick one, or say it in your own words."));
    const textarea = el("textarea", {
      maxlength: "200",
      placeholder: tr("比如：这个月想把一号木打直", "For example: hit my driver straight this month"),
      "aria-label": tr("你的目标", "Your goal"),
      oninput: () => { state.profile.goal = textarea.value; next.disabled = !textarea.value.trim(); },
    });
    textarea.value = state.profile.goal;
    const next = el("button", {
      class: "fab", type: "button", "aria-label": tr("下一步", "Next"),
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
    say(tr("你是右手打还是左手打？", "Right-handed or left-handed?"), tr("分析动作时要分清哪只脚靠近目标。", "I need to know which foot is nearer the target."));
    return [
      backButton("summary"),
      ...optionList(HANDEDNESS, state.profile.handedness, (value) => { state.profile.handedness = value; go("summary"); }),
    ];
  },

  summary() {
    say(tr("好嘞，我记住了！", "Got it, I'll remember!"), tr("有不对的点一下就能改。", "Tap anything that's wrong to change it."));
    state.editing = true;
    const rows = [
      [tr("名字", "Name"), state.profile.name, "name"],
      [tr("水平", "Level"), labelOf(LEVELS, state.profile.level), "level"],
      [tr("球龄", "Playing for"), labelOf(EXPERIENCE, state.profile.experience), "experience"],
      [tr("目标", "Goal"), state.profile.goal, "goal"],
      [tr("打法", "Swings"), labelOf(HANDEDNESS, state.profile.handedness), "handedness"],
      [tr("帽子", "Cap"), labelOf(CAPS, state.profile.cap), "cap"],
    ];
    return [
      el("dl", { class: "summary" }, rows.map(([name, value, step]) =>
        el("div", {}, [
          el("dt", { text: name }),
          el("dd", {}, [value, " ", el("button", { class: "link", type: "button", text: tr("改", "Edit"), "aria-label": tr(`修改${name}`, `Edit ${name}`), onclick: () => go(step) })]),
        ]),
      )),
      el("div", { class: "actions" }, [
        el("button", {
          class: "primary", type: "button", text: tr("保存", "Save"),
          onclick: () => { saveProfile(); state.editing = false; go("home"); },
        }),
      ]),
    ];
  },

  home() {
    say(
      state.profile.name ? tr(`${state.profile.name}，今天想练点什么？`, `${state.profile.name}, what are we working on today?`) : tr("今天想练点什么？", "What are we working on today?"),
      state.profile.goal ? tr(`你的目标：${state.profile.goal}`, `Your goal: ${state.profile.goal}`) : "",
    );
    return [
      levelCard(),
      el("p", { class: "note", text: tr("早期测试版，判断还在校准，建议仅供参考。哪里疼就先停下休息。", "Early beta: the swing checks are still being tuned, so treat tips as suggestions. If anything hurts, stop and rest.") }),
      el("p", { class: "note", text: tr("想像 App 一样打开：在 Safari 点分享按钮，选“添加到主屏幕”。", "To open it like an app: in Safari, tap Share, then Add to Home Screen.") }),
      el("div", { class: "actions" }, [
        el("button", { class: "primary", type: "button", text: tr("开始一次练球", "Start practice"), onclick: () => go("camera") }),
      ]),
      el("button", { class: "link quiet-link", type: "button", text: tr("修改我的资料", "Edit my profile"), onclick: () => { state.editing = true; go("summary"); } }),
    ];
  },

  camera() {
    say(tr("手机放哪儿？", "Where's your phone going?"), tr("两种都可以，看你今天想练什么。", "Either works, depending on what you're practicing today."));
    const chosen = CAMERA_VIEWS.find((item) => item.value === state.profile.camera_view);
    return [
      backButton("home"),
      ...optionList(CAMERA_VIEWS, state.profile.camera_view, (value) => { state.profile.camera_view = value; saveProfile(); render(); }),
      chosen ? el("ul", { class: "tips" }, [...chosen.tips, tr("练球时屏幕要一直亮着。如果手机自己锁屏了，把 设置 › 显示与亮度 › 自动锁定 调成“永不”。", "Keep the screen on while you practice. If the phone locks itself, set Settings › Display & Brightness › Auto-Lock to Never.")].map((tip) => el("li", { text: tip }))) : null,
      ...voiceChoice(),
      state.session.error ? el("p", { class: "note error", text: state.session.error }) : null,
      el("div", { class: "actions" }, [
        el("button", { class: "primary", type: "button", text: tr("就这样，开始", "Let's go"), onclick: startPractice }),
      ]),
    ];
  },

  practice() {
    say(tr("准备好了就挥吧！", "Swing when you're ready!"), realtimeChosen()
      ? tr(`每挥一杆加一分，想聊随时说，每 ${FEEDBACK_EVERY} 杆我给你一个小建议。`, `One point per swing. Talk to me any time, and every ${FEEDBACK_EVERY} swings I'll give you a tip.`)
      : tr(`每挥一杆加一分，每 ${FEEDBACK_EVERY} 杆我给你一个小建议。`, `One point per swing, and every ${FEEDBACK_EVERY} swings I'll give you a tip.`));
    const stop = el("button", {
      class: "finish", type: "button",
      onclick: async () => { stop.disabled = true; await stopPractice(); },
    }, [icon("stop"), tr("练完了", "Done")]);
    view = {
      set: el("span", { class: "session-chip" }),
      timer: el("span", { class: "session-chip", "aria-label": tr("练了多久", "Practice time") }),
      levelName: el("span"),
      levelHint: el("span"),
      levelFill: el("span"),
      setHint: el("p", { class: "set-hint" }),
      video: el("video", { class: "live", playsinline: true, muted: true, autoplay: true }),
      canvas: el("canvas", { class: "live overlay", "aria-hidden": "true" }),
      guidance: el("p", { class: "guidance", text: tr("小鸟正在热身…", "Chirpi is warming up…") }),
      score: el("span", { class: "score-value", text: "0" }),
      pop: el("span", { class: "pop", "aria-hidden": "true", text: "+1" }),
      dots: el("div", { class: "dots", "aria-label": tr("这一组的进度", "This set's progress") }),
      error: el("p", { class: "note error", hidden: true }),
      mute: el("button", { class: "control", type: "button", onclick: toggleMute }),
      flip: el("button", {
        class: "control", type: "button", "aria-label": tr("换前后摄像头", "Switch camera"),
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
          el("div", { class: "score" }, [view.score, el("span", { class: "score-label", text: tr("杆", "swings") }), view.pop]),
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
      say(tr(`今天挥了 ${swings} 杆，太棒了！`, `${swings} swings today, amazing!`), tr(`拿到 ${swings} 分。`, `You earned ${swings} points.`), "celebrate");
    } else {
      say(tr("这次没有数到挥杆", "No swings counted this time"), tr("下次站到画面里，双脚和双手都要看得到。", "Next time, stand in the frame with your feet and hands visible."));
    }
    return [
      levelCard(),
      clips.length ? el("p", { class: "section-title", text: tr("这次的挥杆", "This session's swings") }) : null,
      clips.length ? el("div", { class: "clips" }, clips.map(clipFigure)) : null,
      clips.length ? el("p", { class: "note", text: tr("视频只留到关闭页面。想留着就点“保存”，再选“存储视频”，就会进相册。", "Videos only last until you close the page. To keep one, tap Save, then Save Video to put it in Photos.") }) : null,
      el("div", { class: "actions" }, [
        el("button", { class: "primary", type: "button", text: tr("回主页", "Back to home"), onclick: () => go("home") }),
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
  view.set.textContent = tr(`第 ${Math.floor(swings / FEEDBACK_EVERY) + 1} 组`, `Set ${Math.floor(swings / FEEDBACK_EVERY) + 1}`);
  view.setHint.textContent = tr(`再 ${left} 杆，它给你这组的话。`, left === 1 ? "1 more swing until this set's tip." : `${left} more swings until this set's tip.`);
  const { level, name, start, next } = levelOf(state.progress.points, LANG);
  view.levelName.textContent = `Lv.${level} ${name}`;
  view.levelHint.textContent = next ? tr(`再 ${next - state.progress.points} 杆升级`, `${next - state.progress.points} to level up`) : tr("最高级了", "Top level");
  view.levelFill.style.width = `${next ? Math.round(((state.progress.points - start) / (next - start)) * 100) : 100}%`;
  view.mute.replaceChildren(icon(state.muted ? "muted" : "speaker"));
  view.mute.classList.toggle("off", state.muted);
  view.mute.setAttribute("aria-label", state.muted ? tr("Chirpi 静音中，点一下打开", "Chirpi is muted, tap to unmute") : tr("Chirpi 会说话，点一下静音", "Chirpi can talk, tap to mute"));
  if (view.talk && realtimeChosen()) {
    const { status, micOpen } = state.live;
    view.talk.replaceChildren(icon("mic"));
    view.talk.classList.toggle("listening", status === "on" && micOpen);
    view.talk.classList.toggle("off", status === "on" && !micOpen);
    view.talk.disabled = status !== "on";
    view.talk.setAttribute("aria-label", status === "connecting" ? tr("实时对话连接中", "Real-time chat connecting") : status === "off" ? tr("实时对话已结束", "Real-time chat ended")
      : micOpen ? tr("Chirpi 在听，点一下关麦克风", "Chirpi is listening, tap to turn off the mic") : tr("麦克风关着，点一下打开", "Mic is off, tap to turn it on"));
  } else if (view.talk) {
    const { status } = state.talk;
    view.talk.replaceChildren(icon("mic"));
    view.talk.classList.toggle("listening", status === "listening");
    view.talk.disabled = status === "thinking";
    view.talk.setAttribute("aria-label", status === "listening" ? tr("说完了", "Done talking") : tr("跟 Chirpi 说话", "Talk to Chirpi"));
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
    bird: kind ? tr(`${kind.name}（${kind.tags.join("、")}）`, `${kind.name} (${kind.tags.join(", ")})`) : "",
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
  say(tr("我在听…", "Listening…"), tr("说完停一下就好", "Just pause when you're done"), "talk");
  setTalkStatus("listening");
  let text = "";
  try {
    listening = listen({ onHeard: (heard) => say(`“${heard}”`, tr("我在听…", "Listening…"), "talk") });
    text = await listening.done;
  } catch (problem) {
    say(problem.message, "", "hop");
  }
  listening = null;
  if (!text) {
    if (state.talk.status === "listening") say(tr("没听到你说话", "I didn't hear anything"), tr("再点一下麦克风试试。", "Tap the mic and try again."), "hop");
    setTalkStatus("idle");
    return;
  }
  setTalkStatus("thinking");
  say(`“${text}”`, tr("Chirpi 在想…", "Chirpi is thinking…"), "talk");
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
    el("p", { class: "section-title", text: tr("Chirpi 怎么陪你", "How Chirpi keeps you company") }),
    ...optionList(VOICE_MODES, state.profile.voice_mode, (value) => { state.profile.voice_mode = value; saveProfile(); render(); }),
  ];
}

// What Chirpi knows when the call starts, in plain words; the camera adds swings and tips as they come.
function liveContext() {
  const context = talkContext();
  const facts = [
    context.name && tr(`名字：${context.name}`, `name: ${context.name}`),
    context.level && tr(`水平：${context.level}`, `level: ${context.level}`),
    context.experience && tr(`球龄：${context.experience}`, `playing for: ${context.experience}`),
    context.goal && tr(`目标：${context.goal}`, `goal: ${context.goal}`),
    context.handedness && tr(`习惯：${context.handedness}`, `swings: ${context.handedness}`),
    context.bird && tr(`Chirpi 是：${context.bird}`, `Chirpi is: ${context.bird}`),
    context.camera && tr(`手机：${context.camera}`, `phone: ${context.camera}`),
  ].filter(Boolean);
  const analysis = state.profile.camera_view === "face_on" ? ""
    : tr("这个角度只数杆和录像，没有动作建议。", " From this angle the app only counts and records swings, with no technique tips.");
  return tr(`练球刚开始，还没有挥杆。球手资料：${facts.join("；")}。${analysis}`,
    `Practice just started, no swings yet. The golfer: ${facts.join("; ")}.${analysis}`);
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
      language: LANG,
      firstMessage: tr(`${name ? `${name}，` : ""}我在旁边看着呢！准备好了就挥，想聊随时说。`,
        `${name ? `${name}, I'm` : "I'm"} watching! Swing whenever you're ready, and talk to me any time.`),
      context: liveContext(),
      onMessage: (who, text) => {
        if (!view) return;
        if (who === "golfer") { say(`“${text}”`, "", "talk"); return; }
        say(text, "", "talk");
        feedbackUntil = Date.now() + FEEDBACK_SECONDS * 1000; // keep its words up instead of the next cheer
      },
      onMode: (mode) => { if (mode === "speaking" && view) react("talk"); },
      onEnd: () => liveEnded(tr("实时对话到时间了", "Real-time chat time's up"), tr("接下来我用录好的声音陪你。", "I'll keep you company with my recorded voice now.")),
    });
    if (state.live.status !== "connecting") { await call.end(); return; } // practice ended meanwhile
    if (state.muted) call.setMuted(true);
    setLive({ call, status: "on" });
  } catch (problem) {
    console.error(problem);
    if (state.live.status === "connecting") liveEnded(tr("实时对话没连上", "Real-time chat couldn't connect"), tr("这次先用录好的声音陪你。", "I'll use my recorded voice this time."));
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
      call.tell(tr(`球手挥了第 ${swing} 杆。`, `The golfer just hit swing ${swing}.`));
    }
    if (levelUp) {
      const text = levelUpLine(levelUp);
      say(text, tr("继续加油！", "Keep going!"), "celebrate");
    } else if (Date.now() < feedbackUntil) {
      react("cheer");
    } else {
      const cheer = CHEERS[(swing - 1) % CHEERS.length];
      say(cheer, tr(`第 ${swing} 杆 · +1 分`, `Swing ${swing} · +1 point`), "cheer");
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
    if (call) call.ask(tr(`球手挥完了第 ${state.session.swings} 杆。这一组的建议：${text}。用你的话跟球手说。`,
      `The golfer just finished swing ${state.session.swings}. This set's tip: ${text} Tell the golfer in your own words.`));
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
  else unlockSystemVoice();
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
  saveProfile, unlockVoice,
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
