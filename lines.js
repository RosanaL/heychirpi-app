// Everything Chirpi says out loud. tools/generate_voice.mjs turns allLines() into audio files,
// so a spoken line must come from here and can't contain anything that varies, like a swing count.

import { FAULT_CODES, FEEDBACK_EVERY, LEVEL_NAMES, setFeedback } from "./swing.js";

export const START_LINE = "开始啦！";
export const DONE_LINE = "今天练得太棒了！";
export const CHEERS = ["好球！", "漂亮！", "继续保持！", "越来越顺了！", "这杆不错！", "节奏很好！", "加油！"];

export function levelUpLine(name) {
  return `升级啦！Chirpi 变成${name}了！`;
}

const SPOKEN_COUNTS = { 2: "两", 3: "三", 4: "四", 5: "五" };

// The tip as shown on screen, without the set number and with counts as words so they read naturally.
export function spokenFeedback(text) {
  return text
    .replace(/^第 \d+ 组 /, "")
    .replace(/ ?(\d) 杆/g, (match, count) => `${SPOKEN_COUNTS[count] || count}杆`);
}

function feedbackLines() {
  const faulted = (code) => ({ primary: { code } });
  const clean = { primary: null };
  const texts = [
    setFeedback(Array(FEEDBACK_EVERY).fill(clean), 1),
    setFeedback(Array(FEEDBACK_EVERY).fill(null), 1),
    setFeedback(Array(FEEDBACK_EVERY).fill(null), 1, { analyzed: false }),
  ];
  for (const code of FAULT_CODES) {
    for (let count = 2; count <= FEEDBACK_EVERY; count += 1) {
      const reports = Array(FEEDBACK_EVERY).fill(clean).fill(faulted(code), 0, count);
      texts.push(setFeedback(reports, 1));
    }
  }
  return texts.map(spokenFeedback);
}

export function allLines() {
  return [...new Set([START_LINE, DONE_LINE, ...CHEERS, ...LEVEL_NAMES.map(levelUpLine), ...feedbackLines()])];
}
