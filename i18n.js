// The app's language. Chirpi is English only for now; the Chinese text stays beside the English in
// every tr() pair so it can come back by changing LANG, but nothing on the page offers it.

export const LANG = "en";

// The same words in both languages, side by side where they are used.
export function tr(zh, en) {
  return LANG === "zh" ? zh : en;
}
