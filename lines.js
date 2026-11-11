// Chirpi's words, in Chinese and English. Only the swing analysis is spoken: tools/generate_voice.mjs
// turns allLines() (each set's tip, both languages) into audio files, so a spoken line must come from
// here and can't contain anything that varies, like a swing count. Cheers, level-ups and the hatch
// line are shown on screen only; the game parts stay quiet while Chirpi focuses on the swing.

import { LANG } from "./i18n.js";
import { FAULT_CODES, FEEDBACK_EVERY, LEVEL_NAMES, LEVEL_NAMES_EN, setFeedback } from "./swing.js";

const WORDS = {
  zh: {
    hatch: "终于出来了！以后你每挥一杆，我都给你加油。",
    cheers: ["好球！", "漂亮！", "继续保持！", "越来越顺了！", "这杆不错！", "节奏很好！", "加油！"],
    levelUp: (name) => `升级啦！Chirpi 变成${name}了！`,
    levels: LEVEL_NAMES,
  },
  en: {
    hatch: "I'm finally out! From now on, I'll cheer for every swing you make.",
    cheers: ["Nice shot!", "Beautiful!", "Keep it up!", "Getting smoother!", "Good one!", "Great rhythm!", "You've got this!"],
    levelUp: (name) => `Level up! Chirpi is ${/^[AEIOU]/.test(name) ? "an" : "a"} ${name} now!`,
    levels: LEVEL_NAMES_EN,
  },
};
const words = WORDS[LANG] || WORDS.en;

export const HATCH_LINE = words.hatch;
export const CHEERS = words.cheers;
export const levelUpLine = words.levelUp;

const SPOKEN_COUNTS = {
  zh: { 2: "两", 3: "三", 4: "四", 5: "五" },
  en: { 2: "two", 3: "three", 4: "four", 5: "five" },
};

// One language's lines, for checks and tools; the page uses the exports above.
export function linesIn(lang) {
  return WORDS[lang];
}

// The tip as shown on screen, without the set number and with counts as words so they read naturally.
export function spoken(text, lang) {
  if (lang === "en") {
    return text
      .replace(/^Set \d+: /, "")
      .replace(/\b(\d) swings\b/g, (match, count) => `${SPOKEN_COUNTS.en[count] || count} swings`)
      .replace(/(^|[.!?] )([a-z])/g, (match, before, first) => before + first.toUpperCase());
  }
  return text
    .replace(/^第 \d+ 组 /, "")
    .replace(/ ?(\d) 杆/g, (match, count) => `${SPOKEN_COUNTS.zh[count] || count}杆`);
}

export function spokenFeedback(text) {
  return spoken(text, LANG);
}

function feedbackLines(lang) {
  const faulted = (code) => ({ primary: { code } });
  const clean = { primary: null };
  const texts = [
    setFeedback(Array(FEEDBACK_EVERY).fill(clean), 1, { lang }),
    setFeedback(Array(FEEDBACK_EVERY).fill(null), 1, { lang }),
    setFeedback(Array(FEEDBACK_EVERY).fill(null), 1, { analyzed: false, lang }),
  ];
  for (const code of FAULT_CODES) {
    for (let count = 2; count <= FEEDBACK_EVERY; count += 1) {
      const reports = Array(FEEDBACK_EVERY).fill(clean).fill(faulted(code), 0, count);
      texts.push(setFeedback(reports, 1, { lang }));
    }
  }
  return texts.map((text) => spoken(text, lang));
}

export function allLines() {
  return [...new Set(Object.keys(WORDS).flatMap(feedbackLines))];
}
