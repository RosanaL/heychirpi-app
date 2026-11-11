// Talk to Chirpi in real time. ElevenLabs runs the call (listening, turn-taking, interruptions,
// Claude for the words, the voice); this page asks for the microphone, starts the call and shows it.

import { AGENT_ID } from "./config.js";

const TEXTS = {
  en: {
    headline: "Talk to Chirpi",
    intro: "A little bird that keeps you company at the driving range. Pretend you just hit a set of balls and ask what it saw.",
    start: "Start talking",
    end: "End",
    connecting: "Connecting…",
    listening: "Listening…",
    speaking: "Chirpi is talking. Interrupt any time.",
    ended: "That's the chat. Tap again to talk more.",
    noMic: "Chirpi needs your microphone. Allow it next to the address bar, then tap again.",
    notReady: "The demo isn't connected to the voice service yet.",
    failed: "Couldn't connect. Please try again in a moment.",
    note: "Real-time voice: ElevenLabs Agents + Claude. Up to 3 minutes per chat.",
    app: "Try the phone app",
    bird: "Chirpi the bird",
    conversation: "Conversation",
    first: "Hi, I'm Chirpi! You just hit twenty three balls with your seven iron. Want to hear how it went?",
  },
  zh: {
    headline: "跟 Chirpi 聊聊",
    intro: "陪你练高尔夫的小鸟。假装你刚在练习场打完一组，问问它看到了什么，中文英文都行。",
    start: "开始说话",
    end: "结束",
    connecting: "正在连接…",
    listening: "在听你说…",
    speaking: "Chirpi 在说话，可以随时打断它",
    ended: "聊完了。想再聊就再点一下。",
    noMic: "需要麦克风权限才能说话。请在浏览器地址栏旁边允许麦克风，再点一次。",
    notReady: "Demo 还没接上语音服务。",
    failed: "连不上，请稍后再试。",
    note: "实时语音：ElevenLabs Agents + Claude。每次最多 3 分钟。",
    app: "试试手机 app",
    bird: "Chirpi 小鸟",
    conversation: "对话",
    first: "嗨，我是 Chirpi！你刚才用七号铁打了二十三杆，想听听我看到了什么吗？",
  },
};

// English only for now; the Chinese text above stays for later.
function initialLanguage() {
  return "en";
}

const bird = document.getElementById("bird");
const headline = document.getElementById("headline");
const status = document.getElementById("status");
const transcript = document.getElementById("transcript");
const talk = document.getElementById("talk");
const note = document.getElementById("note");
const langButtons = [...document.querySelectorAll(".demo-lang button")];

const MIC = '<svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/></svg>';
const STOP = '<svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2.5" fill="currentColor" stroke="none"/></svg>';

let lang = initialLanguage();
let TEXT = TEXTS[lang];
let conversation = null;
let busy = false;

function setLanguage(next) {
  lang = next;
  TEXT = TEXTS[lang];
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  document.title = TEXT.headline;
  headline.textContent = TEXT.headline;
  status.textContent = TEXT.intro;
  bird.setAttribute("aria-label", TEXT.bird);
  transcript.setAttribute("aria-label", TEXT.conversation);
  note.replaceChildren(TEXT.note, " ", Object.assign(document.createElement("a"), { href: "../", textContent: TEXT.app }));
  langButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.lang === lang)));
  setButton(Boolean(conversation));
}

function setButton(live) {
  talk.classList.toggle("live", live);
  talk.innerHTML = `${live ? STOP : MIC}<span>${live ? TEXT.end : TEXT.start}</span>`;
  // The call's language is set when it starts, so switch between chats, not during one.
  langButtons.forEach((button) => { button.disabled = live; });
}

function setMode(mode) {
  bird.classList.toggle("speaking", mode === "speaking");
  status.textContent = mode === "speaking" ? TEXT.speaking : TEXT.listening;
}

function addLine(role, message) {
  // Voice tags like [laugh] are for the speech, not the page; "..." is the recognizer hearing only noise.
  const text = (message || "").replace(/\[[^\]]*\]\s*/g, "").trim();
  if (!text || /^[.…\s]+$/.test(text)) return;
  const line = document.createElement("p");
  line.className = `line ${role === "agent" ? "chirpi" : "you"}`;
  line.textContent = text;
  transcript.append(line);
  while (transcript.children.length > 6) transcript.firstChild.remove();
  line.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function ended(text) {
  conversation = null;
  bird.classList.remove("speaking");
  status.textContent = text;
  setButton(false);
}

async function start() {
  if (!AGENT_ID) { status.textContent = TEXT.notReady; return; }
  if (!window.ElevenLabsClient) { status.textContent = TEXT.failed; return; }
  status.textContent = TEXT.connecting;
  try {
    // Ask first so the browser's prompt appears right after the tap.
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
  } catch {
    status.textContent = TEXT.noMic;
    return;
  }
  transcript.replaceChildren();
  setButton(true);
  try {
    conversation = await window.ElevenLabsClient.Conversation.startSession({
      agentId: AGENT_ID,
      overrides: { agent: { language: lang, firstMessage: TEXT.first } },
      onModeChange: ({ mode }) => setMode(mode),
      onMessage: ({ role, message }) => addLine(role, message),
      onDisconnect: () => { if (conversation) ended(TEXT.ended); },
      onError: (message) => console.error("Chirpi demo:", message),
    });
    setMode("listening");
  } catch (problem) {
    console.error(problem);
    ended(TEXT.failed);
  }
}

talk.addEventListener("click", async () => {
  if (busy) return;
  busy = true;
  try {
    if (conversation) {
      const live = conversation;
      ended(TEXT.ended);
      await live.endSession();
    } else {
      await start();
    }
  } finally {
    busy = false;
  }
});

langButtons.forEach((button) => button.addEventListener("click", () => {
  if (conversation || button.dataset.lang === lang) return;
  try { localStorage.setItem("chirpi-demo-lang", button.dataset.lang); } catch {}
  transcript.replaceChildren();
  setLanguage(button.dataset.lang);
}));

setLanguage(lang);
