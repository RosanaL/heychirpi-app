// 实时对话 during practice: an ElevenLabs Agents call (listening, turn-taking, interruptions,
// Claude for the words, the voice). The app keeps Chirpi up to date with context updates and
// asks it to say each set's tip; no key is on the phone, only the public agent id.

import { PRACTICE_AGENT_ID } from "./realtime-config.js";

const CLIENT = new URL("./vendor/elevenlabs-client/elevenlabs-client-1.35.0.iife.js", import.meta.url).href;

let loading = null;

export function realtimeAvailable() {
  return Boolean(PRACTICE_AGENT_ID);
}

// The client library is 1 MB, so it loads only once someone picks 实时对话, before the tap that starts.
export function loadRealtime() {
  if (window.ElevenLabsClient) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = CLIENT;
      script.onload = () => resolve();
      script.onerror = () => { loading = null; reject(new Error("实时对话没加载出来，检查一下网络。")); };
      document.head.append(script);
    });
  }
  return loading;
}

// Voice tags like [laugh] are for the speech; "..." is the recognizer hearing only noise.
function clean(message) {
  const text = (message || "").replace(/\[[^\]]*\]\s*/g, "").trim();
  return /^[.…\s]*$/.test(text) ? "" : text;
}

// Starts the call. Resolves to a call with tell(), ask(), setMuted(), setMicMuted() and end().
// onEnd runs once when the call ends for any reason other than end() (time limit, network).
export async function startRealtime({ language = "zh", firstMessage, context, onMessage, onMode, onEnd }) {
  await loadRealtime();
  let ending = false;
  const conversation = await window.ElevenLabsClient.Conversation.startSession({
    agentId: PRACTICE_AGENT_ID,
    overrides: { agent: { language, firstMessage } },
    onMessage: ({ role, message }) => {
      const text = clean(message);
      if (text) onMessage(role === "agent" ? "chirpi" : "golfer", text);
    },
    onModeChange: ({ mode }) => onMode(mode),
    onDisconnect: () => { if (!ending) onEnd(); },
    onError: (message) => console.error("Chirpi realtime:", message),
  });
  if (context) conversation.sendContextualUpdate(context);
  return {
    // Something Chirpi should know but not answer out loud.
    tell: (text) => conversation.sendContextualUpdate(text),
    // Something Chirpi should say now, in its own words.
    ask: (text) => conversation.sendUserMessage(`[App] ${text}`),
    setMuted: (muted) => conversation.setVolume({ volume: muted ? 0 : 1 }),
    setMicMuted: (muted) => conversation.setMicMuted(muted),
    end: async () => { ending = true; await conversation.endSession(); },
  };
}
