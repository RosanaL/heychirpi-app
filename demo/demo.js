// Talk to Chirpi in real time. ElevenLabs runs the call (listening, turn-taking, interruptions,
// Claude for the words, the voice); this page asks for the microphone, starts the call and shows it.

import { AGENT_ID } from "./config.js";

const zh = (navigator.language || "").toLowerCase().startsWith("zh");
const TEXT = zh ? {
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
} : {
  headline: "Talk to Chirpi",
  intro: "A little bird that keeps you company at the driving range. Pretend you just hit a set of balls and ask what it saw. English or Chinese both work.",
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
};
const FIRST_MESSAGE = zh
  ? "嗨，我是 Chirpi！你刚才用七号铁打了二十三杆，想听听我看到了什么吗？"
  : "Hi, I'm Chirpi! You just hit twenty three balls with your seven iron. Want to hear how it went?";

const bird = document.getElementById("bird");
const headline = document.getElementById("headline");
const status = document.getElementById("status");
const transcript = document.getElementById("transcript");
const talk = document.getElementById("talk");
const note = document.getElementById("note");

const MIC = '<svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/></svg>';
const STOP = '<svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2.5" fill="currentColor" stroke="none"/></svg>';

document.documentElement.lang = zh ? "zh-CN" : "en";
headline.textContent = TEXT.headline;
status.textContent = TEXT.intro;
note.append(TEXT.note, " ", Object.assign(document.createElement("a"), { href: "../", textContent: TEXT.app }));

let conversation = null;
let busy = false;

function setButton(live) {
  talk.classList.toggle("live", live);
  talk.innerHTML = `${live ? STOP : MIC}<span>${live ? TEXT.end : TEXT.start}</span>`;
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
      overrides: { agent: { language: zh ? "zh" : "en", firstMessage: FIRST_MESSAGE } },
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

setButton(false);
