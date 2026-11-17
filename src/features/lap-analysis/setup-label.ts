/** A run of capitals before a capitalised word, a word, or a number. */
const KEY_WORD = /[A-Z]+(?![a-z])|[A-Z]?[a-z]+|\d+/g;

/** The sim's setup key as words: `LastTempsOMI` → `Last Temps OMI`. */
export const setupLabel = (key: string): string =>
  key.match(KEY_WORD)?.join(' ') ?? key;
