// Talking to Chirpi: the phone turns what the golfer says into text, and the talk server
// answers sentence by sentence in Chirpi's voice. The server address and invite code arrive
// once in the link's #fragment (never sent to any server) and are kept on this phone.

import { tr } from "./i18n.js";

const SETTINGS_KEY = "chirpi.talk";
const LISTEN_SECONDS = 12;

function store(value) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(value)); } catch { /* private mode */ }
}

// { url, code } or null. A link like …/#talk=https://chirpi.example&code=abc sets them.
export function talkSettings() {
  const hash = new URLSearchParams(location.hash.slice(1));
  if (hash.has("talk") && hash.has("code")) {
    const url = hash.get("talk").replace(/\/+$/, "");
    if (/^https:\/\/|^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(url)) store({ url, code: hash.get("code") });
    history.replaceState(null, "", location.pathname + location.search); // keep the code out of shared links
  }
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    return saved && saved.url && saved.code ? saved : null;
  } catch {
    return null;
  }
}

function Recognition() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function canListen() {
  return Boolean(Recognition());
}

// Listens for one thing the golfer says. Resolves to the text ("" if nothing was heard).
// Returns { done, stop }: stop() ends listening early and keeps what was heard so far.
export function listen({ onHeard } = {}) {
  const Speech = Recognition();
  const recognition = new Speech();
  recognition.lang = tr("zh-CN", "en-US");
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;
  let heard = "";
  let timer = null;
  const done = new Promise((resolve, reject) => {
    recognition.onresult = (event) => {
      heard = Array.from(event.results, (result) => result[0].transcript).join("");
      if (onHeard) onHeard(heard);
    };
    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      const words = event.error === "not-allowed" || event.error === "service-not-allowed"
        ? tr("没有麦克风权限。在 设置 › Safari › 麦克风 里允许这个网站。", "No microphone permission. Allow this site in Settings › Safari › Microphone.")
        : tr("没听清，再说一次？", "I didn't catch that. Say it again?");
      reject(new Error(words));
    };
    recognition.onend = () => { clearTimeout(timer); resolve(heard.trim()); };
  });
  recognition.start();
  timer = setTimeout(() => recognition.stop(), LISTEN_SECONDS * 1000);
  return { done, stop: () => recognition.stop() };
}

// Sends what the golfer said; onLine gets each {type: "line", text, audio} as it arrives.
// Throws an Error whose message can be shown to the golfer.
export async function askChirpi({ settings, text, history, context, onLine }) {
  let response;
  try {
    response = await fetch(`${settings.url}/talk`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Chirpi-Code": settings.code },
      body: JSON.stringify({ text, history, context }),
    });
  } catch {
    throw new Error(tr("连不上 Chirpi，检查一下网络再试试。", "Can't reach Chirpi. Check your connection and try again."));
  }
  if (!response.ok) {
    let message = tr("Chirpi 这边出了点问题，过一会儿再试试。", "Something went wrong on Chirpi's side. Try again in a bit.");
    try { message = (await response.json()).error || message; } catch { /* not JSON */ }
    throw new Error(message);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let failure = null;
  for (;;) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    let newline;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const raw = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!raw) continue;
      const item = JSON.parse(raw);
      if (item.type === "line") onLine(item);
      else if (item.type === "error") failure = item.text;
    }
    if (done) break;
  }
  if (failure) throw new Error(failure);
}

export function audioUrl(base64) {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
}
