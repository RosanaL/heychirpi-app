// First visit: a golf ball on the night range is about to hatch into a birdie.
// The golfer chats with it, sees what kind of bird it will be, picks a cap and holds to hatch it.

import { tr } from "./i18n.js";

const STORY = tr([
  "夜场快关灯了。",
  "听说，每颗球都想打出一个小鸟球。",
  "这颗……好像是认真的。",
  "喂！外面有人吗？",
  "我快孵出来了，可还不知道要变成什么样的小鸟。你能陪我聊两句吗？",
], [
  "The night range is about to close.",
  "They say every golf ball dreams of making a birdie.",
  "This one… seems to mean it.",
  "Hey! Is anyone out there?",
  "I'm about to hatch, but I don't know what kind of bird I'll be yet. Will you chat with me for a bit?",
]);
const STORY_SECONDS = 2.8;
const TYPING_SECONDS = 0.8;
const HOLD_SECONDS = 1.8;
const FLASH_SECONDS = 0.45;
const SHARE_URL = () => `${location.origin}${location.pathname}`;

export const CAPS = [
  { value: "green", label: tr("果岭绿", "Fairway Green"), top: "#3aa86f", brim: "#2d8a5a" },
  { value: "red", label: tr("球旗红", "Flag Red"), top: "#e2574c", brim: "#b83f36" },
  { value: "blue", label: tr("夜空蓝", "Night Blue"), top: "#4f8fe0", brim: "#3a6fb8" },
  { value: "pink", label: tr("樱花粉", "Blossom Pink"), top: "#f58fb0", brim: "#d96f92" },
];

const KINDS = tr({
  far: { name: "冲天鸟", about: "陪你把球送到更远的地方，每一杆我都飞在前面等它。", tags: ["爱冲", "嗓门大", "不怕挑战"] },
  steady: { name: "稳稳鸟", about: "不催你，不吓你，陪你把同一个动作练到不用想。", tags: ["耐心", "靠谱", "细心"] },
  record: { name: "破纪录鸟", about: "心里记着你的那个数字，你每练一杆，我都替你记一笔。", tags: ["好胜", "记性好", "爱庆祝"] },
  happy: { name: "开心鸟", about: "打好打坏都是好天气。练球这件事，开心最要紧。", tags: ["爱笑", "话多", "不记仇"] },
  buddy: { name: "搭子鸟", about: "你说的目标我记下了。从今天起，你练球，我就在旁边。", tags: ["仗义", "好奇", "爱凑热闹"] },
}, {
  far: { name: "Skyrocket Bird", about: "I'll help you send the ball farther, and fly out ahead to wait for every shot.", tags: ["Bold", "Loud", "Loves a challenge"] },
  steady: { name: "Steady Bird", about: "No rushing, no scaring. I'll stay with you until the same move needs no thinking.", tags: ["Patient", "Reliable", "Careful"] },
  record: { name: "Record Bird", about: "I keep your number in mind, and I count every swing you put in toward it.", tags: ["Competitive", "Great memory", "Loves to celebrate"] },
  happy: { name: "Happy Bird", about: "Good shot or bad, it's always a nice day. When you practice, having fun comes first.", tags: ["Smiley", "Chatty", "Never holds a grudge"] },
  buddy: { name: "Buddy Bird", about: "I wrote down your goal. From today on, whenever you practice, I'm right beside you.", tags: ["Loyal", "Curious", "Loves company"] },
});
// Goals from the suggestions in either language; anything else is a buddy.
const KIND_OF_GOAL = {
  打得更远: "far", 打得更稳定: "steady", 改掉右曲球: "steady", "第一次破 100": "record", "破 90": "record", 享受打球就好: "happy",
  "Hit it farther": "far", "Be more consistent": "steady", "Fix my slice": "steady", "Break 100": "record", "Break 90": "record", "Just enjoy the game": "happy",
};

// The kind follows the goal until the bird hatches, then it is kept even if the goal changes.
export function kindKeyFor(goal) {
  return KIND_OF_GOAL[goal] || "buddy";
}

export function birdKind(key) {
  return KINDS[key] || KINDS.buddy;
}

export function applyCap(value) {
  const cap = CAPS.find((item) => item.value === value) || CAPS[0];
  document.documentElement.style.setProperty("--cap", cap.top);
  document.documentElement.style.setProperty("--cap-brim", cap.brim);
}

// A golf ball on a tee. Cracks and the cap are drawn only when a screen asks for them.
function ballMarkup({ cap = false, cracks = false } = {}) {
  return `<svg class="golf-ball" viewBox="0 0 200 250" aria-hidden="true">
    <path class="tee" d="M78 186 H122 L106 214 L103 246 H97 L94 214 Z"/>
    <g class="ball-body">
      <circle class="ball-shell" cx="100" cy="104" r="84"/>
      <g class="ball-dents">
        ${[[70, 62], [104, 50], [138, 70], [52, 100], [88, 92], [124, 100], [156, 112], [68, 136], [104, 132], [140, 146], [90, 168], [120, 170]]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7"/>`).join("")}
      </g>
      ${cracks ? `<g class="ball-cracks">
        <path pathLength="1" d="M100 22 L88 54 L108 74 L92 104 L114 126"/>
        <path pathLength="1" d="M30 88 L58 96 L72 82 L92 104"/>
        <path pathLength="1" d="M172 92 L146 88 L134 108 L114 126 L122 158"/>
      </g>` : ""}
      ${cap ? `<g class="ball-cap">
        <path class="cap-top" d="M50 42 C 56 -6, 146 -8, 152 40 Z"/>
        <path class="cap-brim" d="M138 32 C 164 26, 190 32, 194 42 C 174 46, 152 46, 134 44 Z"/>
        <circle class="cap-dot" cx="101" cy="4" r="5"/>
      </g>` : ""}
    </g>
  </svg>`;
}

export function createOnboarding({ el, icon, state, go, say, setProgress, saveProfile, unlockVoice, questions, hatchLine }) {
  let timers = [];
  let stopHold = null;

  const later = (action, seconds) => {
    const timer = setTimeout(action, seconds * 1000);
    timers.push(timer);
  };
  const cancel = () => {
    timers.forEach(clearTimeout);
    timers = [];
    if (stopHold) stopHold();
    stopHold = null;
  };

  const ball = (options, className = "") => {
    const holder = el("div", { class: `ball-wrap ${className}` });
    holder.innerHTML = ballMarkup(options);
    return holder;
  };
  const nameOf = () => (state.profile.name || "").trim();
  const roundNext = (onclick, disabled = false) => el("button", {
    class: "fab", type: "button", "aria-label": tr("下一步", "Next"), disabled, onclick,
  }, [icon("next")]);
  const roundBack = (step) => el("button", {
    class: "back", type: "button", "aria-label": tr("上一步", "Back"), onclick: () => go(step),
  }, [icon("back")]);

  // --- The chat. What has already been said is worked out from the answers, so going back just works. ---

  function askText(question) {
    return typeof question.ask === "function" ? question.ask(nameOf()) : question.ask;
  }

  function replyText(question) {
    const answer = state.profile[question.key];
    return question.replies[answer] || question.otherReply;
  }

  function answerText(question) {
    const answer = state.profile[question.key];
    const item = question.items && question.items.find((option) => option.value === answer);
    return item ? item.label : answer;
  }

  function message(from, text, { latest = false } = {}) {
    const fromBall = from === "ball";
    return el("div", { class: `message ${from}` }, [
      fromBall ? el("span", { class: latest ? "message-ball" : "message-ball spacer", "aria-hidden": "true" }) : null,
      el("p", { class: "message-text", text }),
    ]);
  }

  function chatScreen() {
    const log = el("div", { class: "chat-log", "aria-live": "polite" });
    const answers = el("div", { class: "chat-answers" });
    const inner = el("div", { class: "chat-log-inner" });
    log.append(inner);

    const scrollDown = () => { log.scrollTop = log.scrollHeight; };
    const add = (node) => {
      inner.querySelectorAll(".message-ball:not(.spacer)").forEach((old) => old.classList.add("spacer"));
      inner.querySelector(".typing")?.remove();
      inner.append(node);
      scrollDown();
    };
    const typing = () => add(el("div", { class: "message ball typing" }, [
      el("span", { class: "message-ball", "aria-hidden": "true" }),
      el("p", { class: "message-text", "aria-label": tr("正在输入", "Typing") }, [el("i"), el("i"), el("i")]),
    ]));
    const sayFromBall = (text) => add(message("ball", text, { latest: true }));

    const index = () => state.chatIndex;
    const updateProgress = () => setProgress(index() / questions.length);

    function showAnswers() {
      const question = questions[index()];
      answers.replaceChildren(...(question.free ? freeAnswer(question) : optionAnswers(question)));
      scrollDown();
    }

    function askNext() {
      updateProgress();
      if (index() >= questions.length) {
        answers.replaceChildren(el("div", { class: "actions" }, [
          el("button", { class: "primary", type: "button", text: tr("继续", "Continue"), onclick: () => go("match") }),
        ]));
        scrollDown();
        return;
      }
      sayFromBall(askText(questions[index()]));
      showAnswers();
    }

    function answer(question, value) {
      state.profile[question.key] = value;
      add(message("you", answerText(question)));
      answers.replaceChildren();
      state.chatIndex += 1;
      updateProgress();
      typing();
      later(() => {
        sayFromBall(replyText(question));
        if (state.chatIndex >= questions.length) {
          sayFromBall(tr("够了够了，我感觉到了……", "That's enough, I can feel it…"));
          askNext();
          return;
        }
        typing();
        later(askNext, TYPING_SECONDS);
      }, TYPING_SECONDS);
    }

    function optionAnswers(question) {
      return question.items.map((item) => el("button", {
        class: "option", type: "button",
        "aria-pressed": String(state.profile[question.key] === item.value),
        onclick: () => answer(question, item.value),
      }, [el("strong", { text: item.label }), item.sub ? el("span", { class: "sub", text: item.sub }) : null]));
    }

    function freeAnswer(question) {
      const send = () => { if (field.value.trim()) answer(question, field.value.trim()); };
      const field = el("input", {
        class: "chat-field", type: "text", maxlength: "200", enterkeyhint: "send",
        placeholder: question.placeholder, "aria-label": question.placeholder,
        oninput: () => { sendButton.disabled = !field.value.trim(); },
      });
      field.value = state.profile[question.key] || "";
      field.addEventListener("keydown", (key) => { if (key.key === "Enter") send(); });
      const sendButton = el("button", {
        class: "send", type: "button", "aria-label": tr("发送", "Send"), disabled: !field.value.trim(), onclick: send,
      }, [icon("next")]);
      return [
        el("div", { class: "chips" }, question.ideas.map((idea) => el("button", {
          class: "chip", type: "button", text: idea, onclick: () => answer(question, idea),
        }))),
        el("div", { class: "chat-send" }, [field, sendButton]),
      ];
    }

    for (const question of questions.slice(0, index())) {
      add(message("ball", askText(question)));
      add(message("you", answerText(question)));
      add(message("ball", replyText(question)));
    }

    const back = el("button", {
      class: "back", type: "button", "aria-label": tr("上一步", "Back"),
      onclick: () => {
        if (index() === 0) { go("name"); return; }
        state.chatIndex -= 1;
        go("chat");
      },
    }, [icon("back")]);

    if (index() >= questions.length) {
      sayFromBall(tr("够了够了，我感觉到了……", "That's enough, I can feel it…"));
      askNext();
    } else {
      updateProgress();
      typing();
      later(askNext, index() === 0 ? TYPING_SECONDS : 0.2);
    }
    requestAnimationFrame(scrollDown);
    return [back, el("div", { class: "chat" }, [log, answers])];
  }

  // --- Hold to hatch ---

  function hatchScreen() {
    const egg = el("button", { class: "hatch-ball", type: "button", "aria-label": tr("按住孵化小鸟", "Press and hold to hatch") });
    egg.innerHTML = ballMarkup({ cap: true, cracks: true });
    const prompt = el("p", { class: "hatch-prompt" }, tr([el("span", { class: "key", text: "按住" }), " 把它孵出来"], [el("span", { class: "key", text: "Hold" }), " to hatch it"]));
    const flash = el("div", { class: "flash", "aria-hidden": "true" });

    const body = egg.querySelector(".ball-body");
    let progress = 0;
    let holding = false;
    let frame = 0;
    let lastTime = 0;
    let done = false;

    const draw = (time) => {
      const step = (time - lastTime) / 1000;
      lastTime = time;
      progress = Math.max(0, Math.min(1, progress + (holding ? step / HOLD_SECONDS : -step)));
      egg.style.setProperty("--hatch", progress.toFixed(3));
      const wobble = holding && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? Math.sin(time / 34) * (1.5 + progress * 6) : 0;
      body.style.transform = `rotate(${wobble.toFixed(2)}deg)`;
      if (progress >= 1 && !done) {
        done = true;
        prompt.hidden = true;
        flash.classList.add("show");
        later(() => go("reveal"), FLASH_SECONDS);
        return;
      }
      frame = holding || progress > 0 ? requestAnimationFrame(draw) : 0;
    };
    const start = () => {
      if (done) return;
      holding = true;
      prompt.classList.add("held");
      if (!frame) {
        lastTime = performance.now();
        frame = requestAnimationFrame(draw);
      }
    };
    const release = () => {
      holding = false;
      prompt.classList.remove("held");
    };
    stopHold = () => {
      release();
      cancelAnimationFrame(frame);
      frame = 0;
    };

    egg.addEventListener("pointerdown", (press) => {
      press.preventDefault();
      egg.setPointerCapture(press.pointerId);
      start();
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) egg.addEventListener(type, release);
    egg.addEventListener("contextmenu", (menu) => menu.preventDefault());
    egg.addEventListener("keydown", (key) => {
      if (key.key === " " || key.key === "Enter") { key.preventDefault(); start(); }
    });
    egg.addEventListener("keyup", release);

    return [roundBack("cap"), el("div", { class: "scene hatch" }, [egg, prompt]), flash];
  }

  // --- The screens ---

  const screens = {
    intro() {
      let shown = 0;
      const caption = el("p", { class: "caption", "aria-live": "polite", text: STORY[0] });
      const stage = ball({}, "dim");
      const button = el("button", {
        class: "primary", type: "button", text: tr("好呀", "Sure!"),
        onclick: (click) => { click.stopPropagation(); unlockVoice(); go("name"); },
      });
      const actions = el("div", { class: "actions story-actions", hidden: true }, [button]);
      const hint = el("p", { class: "story-hint", text: tr("点一下继续", "Tap to continue") });

      const advance = () => {
        if (shown >= STORY.length - 1) return;
        timers.forEach(clearTimeout);
        timers = [];
        shown += 1;
        caption.textContent = STORY[shown];
        caption.classList.remove("in");
        void caption.offsetWidth;
        caption.classList.add("in");
        stage.classList.toggle("dim", shown < 1);
        stage.classList.toggle("wobble", shown >= 2);
        if (shown === STORY.length - 1) {
          actions.hidden = false;
          hint.hidden = true;
        } else {
          later(advance, STORY_SECONDS);
        }
      };
      later(advance, STORY_SECONDS);
      const scene = el("div", { class: "scene story", onclick: advance }, [stage, caption, hint, actions]);
      return [scene];
    },

    name() {
      const editing = state.editing;
      const finish = () => {
        if (!nameOf()) return;
        unlockVoice();
        if (editing) go("summary");
        else go("chat");
      };
      const field = el("input", {
        class: "name-field", type: "text", maxlength: "20", enterkeyhint: "next", autocomplete: "given-name",
        placeholder: tr("你的名字", "Your name"), "aria-label": tr("你的名字", "Your name"),
        oninput: () => { state.profile.name = field.value; next.disabled = !field.value.trim(); },
      });
      field.value = state.profile.name || "";
      field.addEventListener("keydown", (key) => { if (key.key === "Enter") finish(); });
      const next = roundNext(finish, !nameOf());
      return [
        editing ? roundBack("summary") : null,
        el("div", { class: "ask" }, [
          el("h1", { class: "ask-title", text: editing ? tr("想让我叫你什么？", "What should I call you?") : tr("先告诉我，你叫什么？", "First, what's your name?") }),
          field,
          el("p", { class: "note", text: tr("早期测试版。摄像头画面、视频和资料都只留在你的手机上，不会上传。", "Early beta. Your camera feed, videos and answers stay on your phone and are never uploaded.") }),
          next,
        ]),
      ];
    },

    chat: chatScreen,

    match() {
      const kind = birdKind(kindKeyFor(state.profile.goal));
      return [
        roundBack("chat"),
        el("div", { class: "scene match" }, [
          el("h1", { class: "ask-title", text: tr("我知道我要变成什么了！", "I know what I'm going to be!") }),
          ball({}, "glow small"),
          el("div", { class: "match-card" }, [
            el("span", { class: "match-label", text: tr(`${nameOf()}，你的小鸟是`, `${nameOf()}, your bird is a`) }),
            el("strong", { class: "match-name", text: kind.name }),
            el("p", { text: kind.about }),
            el("div", { class: "tags" }, kind.tags.map((tag) => el("span", { class: "tag", text: tag }))),
          ]),
          roundNext(() => go("cap")),
        ]),
      ];
    },

    cap() {
      const editing = state.editing;
      const current = () => Math.max(0, CAPS.findIndex((item) => item.value === state.profile.cap));
      const label = el("p", { class: "cap-name", "aria-live": "polite", text: CAPS[current()].label });
      const swatches = el("div", { class: "swatches" });
      const pick = (index) => {
        state.profile.cap = CAPS[(index + CAPS.length) % CAPS.length].value;
        applyCap(state.profile.cap);
        label.textContent = CAPS[current()].label;
        drawSwatches();
      };
      const drawSwatches = () => swatches.replaceChildren(...CAPS.map((item, index) => el("button", {
        class: "swatch", type: "button", style: `background: ${item.top}`, "aria-label": item.label,
        "aria-pressed": String(index === current()),
        onclick: () => pick(index),
      })));
      drawSwatches();
      const arrow = (name, change, text) => el("button", {
        class: "arrow", type: "button", "aria-label": text, onclick: () => pick(current() + change),
      }, [icon(name)]);
      return [
        roundBack(editing ? "summary" : "match"),
        el("div", { class: "scene caps" }, [
          el("h1", { class: "ask-title", text: tr("给我挑顶帽子吧", "Pick a cap for me") }),
          el("p", { class: "ask-sub", text: tr("以后随时可以换。", "You can change it any time.") }),
          el("div", { class: "cap-row" }, [
            arrow("back", -1, tr("上一顶", "Previous cap")),
            ball({ cap: true }, "small"),
            arrow("next", 1, tr("下一顶", "Next cap")),
          ]),
          label,
          swatches,
          roundNext(() => { unlockVoice(); go(editing ? "summary" : "hatch"); }),
        ]),
      ];
    },

    hatch: hatchScreen,

    // The bird itself is the one in the page's stage; this screen is the moment it first appears.
    reveal() {
      if (!state.profile.hatchedAt) {
        state.profile.archetype = kindKeyFor(state.profile.goal);
        state.profile.hatchedAt = new Date().toISOString();
      }
      saveProfile();
      say("Chirpi", "", "celebrate");
      return [
        el("p", { class: "caption in", text: hatchLine }),
        roundNext(() => go("card")),
      ];
    },

    card() {
      const kind = birdKind(state.profile.archetype);
      const picture = document.getElementById("bird").cloneNode(true);
      picture.removeAttribute("id");
      picture.classList.remove("hop", "cheer", "celebrate", "talk");
      const status = el("p", { class: "note", "aria-live": "polite" });
      const share = el("button", {
        class: "share", type: "button", text: tr("发给朋友", "Send to a friend"),
        onclick: async () => {
          const text = tr(`${nameOf()}孵出了一只${kind.name}，来练球场找它玩。`, `${nameOf()} hatched a ${kind.name}. Come say hi at the range.`);
          try {
            if (navigator.share) await navigator.share({ title: "Chirpi", text, url: SHARE_URL() });
            else {
              await navigator.clipboard.writeText(`${text} ${SHARE_URL()}`);
              status.textContent = tr("链接已复制", "Link copied");
            }
          } catch (problem) {
            if (problem.name !== "AbortError") status.textContent = tr("没发出去，再试一次吧", "Didn't send. Try again?");
          }
        },
      });
      return [
        el("div", { class: "scene card-scene" }, [
          el("article", { class: "bird-card" }, [
            el("div", { class: "bird-card-sky" }, [picture]),
            el("div", { class: "bird-card-body" }, [
              el("strong", { class: "bird-card-name", text: "Chirpi" }),
              el("p", { text: tr(`${nameOf()} 的${kind.name}。${kind.about}`, `${nameOf()}'s ${kind.name}. ${kind.about}`) }),
              el("div", { class: "tags" }, kind.tags.map((tag) => el("span", { class: "tag", text: tag }))),
            ]),
          ]),
          share,
          status,
          el("div", { class: "actions" }, [
            el("button", { class: "primary", type: "button", text: tr("开始第一次练球", "Start my first practice"), onclick: () => go("camera") }),
          ]),
          el("button", { class: "link quiet-link", type: "button", text: tr("先去主页看看", "Look around first"), onclick: () => go("home") }),
        ]),
      ];
    },
  };

  return { screens, cancel };
}
