// Chirpi's recorded voice. The clips are loaded up front so they still play with poor signal
// at the range. Without voice/manifest.json nothing is recorded and playLine returns false.

const VOICE_ROOT = new URL("./voice/", import.meta.url);
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

const audio = new Audio();
audio.setAttribute("playsinline", "");
let clips = new Map(); // spoken text -> playable url

export async function prepareVoice() {
  let lines;
  try {
    const response = await fetch(new URL("manifest.json", VOICE_ROOT));
    if (!response.ok) return;
    ({ lines } = await response.json());
  } catch {
    return;
  }
  clips = new Map(Object.entries(lines).map(([text, file]) => [text, new URL(file, VOICE_ROOT).href]));
  for (const [text, url] of clips) {
    try {
      const response = await fetch(url);
      if (response.ok) clips.set(text, URL.createObjectURL(await response.blob()));
    } catch {
      /* keep the network url; it may still play */
    }
  }
}

// iPhones only let an audio element play after a tap has started it once. Call this from a tap.
export function unlockVoice() {
  audio.src = SILENCE;
  audio.play().catch(() => {});
}

export function isVoicePlaying() {
  return !audio.paused && !audio.ended;
}

export function stopVoice() {
  queue.length = 0;
  audio.pause();
}

// Chirpi's spoken replies arrive a sentence at a time; they play one after another.
const queue = [];
audio.addEventListener("ended", playNext);
audio.addEventListener("error", playNext);

function playNext() {
  const next = queue.shift();
  if (!next) return;
  audio.src = next;
  audio.play().catch((problem) => { if (problem.name !== "AbortError") playNext(); });
}

export function queueClip(url) {
  queue.push(url);
  if (!isVoicePlaying() && queue.length === 1) playNext();
}

// False if this line has no clip. onBlocked runs if the browser refuses to play it.
export function playLine(text, onBlocked) {
  const url = clips.get(text);
  if (!url) return false;
  queue.length = 0;
  audio.src = url;
  audio.play().catch((problem) => {
    if (problem.name !== "AbortError") onBlocked(); // AbortError: a newer line cut in
  });
  return true;
}
