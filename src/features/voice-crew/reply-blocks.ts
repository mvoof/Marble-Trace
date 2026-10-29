/**
 * A crew reply as blocks: text said as written, a value `{liters}`, a value
 * with the word that agrees with it, `{liters, plural, one {# литр} …}`, one
 * of several ways to put a part `(Принято|Понял)` and a part the engineer
 * may leave out `[ставим]` — those two keep what they hold as written.
 * A plural whose cases are not all "the number, then words" is kept whole as
 * written, so a hand-made one survives the round trip. Text is a word to a
 * block, its spacing kept with it, so a value can go between any two words.
 */

import { pluralMessage, type PluralForm } from './plural-message';

export type ReplyBlock =
  | { kind: 'text'; text: string }
  | { kind: 'value'; value: string }
  | {
      kind: 'plural';
      value: string;
      words: Partial<Record<PluralForm, string>>;
    }
  | { kind: 'message'; text: string }
  /** `optional`: the engineer may leave the choice out, `[(a|b)]`. */
  | { kind: 'choice'; options: string[]; optional?: boolean }
  | { kind: 'optional'; text: string };

const PLURAL_FORMS: readonly string[] = [
  'zero',
  'one',
  'two',
  'few',
  'many',
  'other',
];
const PLURAL_HEAD = /^\s*([\w.]+)\s*,\s*plural\s*,(.*)$/s;
const CASE = /^\s*(\w+)\s*\{\s*#\s*([^{}#]*?)\s*\}/;
/** A word with the spacing around it, or spacing alone. */
const TEXT_TOKEN = /\s*\S+\s*|\s+/g;
/** Text that follows the word before it with no space: "кругов." */
const CLINGS_TO_PREVIOUS = /^[.,!?;:…)»%]/;
/** Languages written without spaces between words. */
const UNSPACED_LANGUAGES: readonly string[] = ['zh'];

/** Where the brace opened at `start` closes, or -1 when it never does. */
const closingBrace = (text: string, start: number): number => {
  let depth = 0;

  for (let index = start; index < text.length; index += 1) {
    if (text[index] === '{') {
      depth += 1;
    } else if (text[index] === '}') {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
};

const CLOSING: Record<string, string> = { '(': ')', '[': ']' };

/**
 * Where the choice or optional part opened at `start` closes, or -1 when it
 * never does; a value inside is skipped whole.
 */
const closingMark = (text: string, start: number): number => {
  const stack: string[] = [];

  for (let index = start; index < text.length; index += 1) {
    const character = text[index];

    if (character === '{') {
      const close = closingBrace(text, index);

      if (close < 0) {
        return -1;
      }

      index = close;
    } else if (character in CLOSING) {
      stack.push(CLOSING[character]);
    } else if (character === ')' || character === ']') {
      if (stack.pop() !== character) {
        return -1;
      }

      if (stack.length === 0) {
        return index;
      }
    }
  }

  return -1;
};

/** A choice's options: split on the `|` outside nested marks and values. */
const splitOptions = (inner: string): string[] => {
  const options: string[] = [];
  let depth = 0;
  let current = '';

  for (const character of inner) {
    if (character === '(' || character === '[' || character === '{') {
      depth += 1;
    } else if (character === ')' || character === ']' || character === '}') {
      depth -= 1;
    }

    if (character === '|' && depth === 0) {
      options.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }

  options.push(current.trim());

  return options;
};

/** What a choice holds when `text` is one choice and nothing else, `(a|b)`. */
const wholeChoice = (text: string): string | null =>
  text.startsWith('(') && closingMark(text, 0) === text.length - 1
    ? text.slice(1, -1)
    : null;

const markBlock = (mark: string, inner: string): ReplyBlock => {
  if (mark === '(') {
    return { kind: 'choice', options: splitOptions(inner) };
  }

  const choice = wholeChoice(inner.trim());

  return choice === null
    ? { kind: 'optional', text: inner.trim() }
    : { kind: 'choice', options: splitOptions(choice), optional: true };
};

/** A plural's words by form, or `null` when a case is anything else. */
const pluralWords = (
  cases: string
): Partial<Record<PluralForm, string>> | null => {
  const words: Partial<Record<PluralForm, string>> = {};
  let rest = cases;

  while (rest.trim() !== '') {
    const match = CASE.exec(rest);

    if (!match || !PLURAL_FORMS.includes(match[1]) || match[2] === '') {
      return null;
    }

    words[match[1] as PluralForm] = match[2];
    rest = rest.slice(match[0].length);
  }

  return Object.keys(words).length > 0 ? words : null;
};

const valueBlock = (inner: string, whole: string): ReplyBlock => {
  const plural = PLURAL_HEAD.exec(inner);

  if (!plural) {
    return /^\s*[\w.]+\s*$/.test(inner)
      ? { kind: 'value', value: inner.trim() }
      : { kind: 'message', text: whole };
  }

  const words = pluralWords(plural[2]);

  return words
    ? { kind: 'plural', value: plural[1], words }
    : { kind: 'message', text: whole };
};

const textBlocks = (text: string): ReplyBlock[] =>
  (text.match(TEXT_TOKEN) ?? []).map((token) => ({
    kind: 'text',
    text: token,
  }));

const OPENING = /[{([]/;
const STRAY = /[})\]|]/;

/** The reply's blocks, or `null` when its marks do not pair up. */
export const parseReplyBlocks = (text: string): ReplyBlock[] | null => {
  const blocks: ReplyBlock[] = [];
  let index = 0;

  while (index < text.length) {
    const rest = text.slice(index);
    const open = rest.search(OPENING);
    const stray = rest.search(STRAY);

    if (stray >= 0 && (open < 0 || stray < open)) {
      return null;
    }

    if (open < 0) {
      blocks.push(...textBlocks(rest));
      break;
    }

    const start = index + open;
    const mark = text[start];

    blocks.push(...textBlocks(text.slice(index, start)));

    const close =
      mark === '{' ? closingBrace(text, start) : closingMark(text, start);

    if (close < 0) {
      return null;
    }

    const inner = text.slice(start + 1, close);

    blocks.push(
      mark === '{'
        ? valueBlock(inner, text.slice(start, close + 1))
        : markBlock(mark, inner)
    );
    index = close + 1;
  }

  return blocks;
};

const blockText = (block: ReplyBlock): string => {
  if (block.kind === 'value') {
    return `{${block.value}}`;
  }

  if (block.kind === 'plural') {
    return pluralMessage(block.value, block.words);
  }

  if (block.kind === 'choice') {
    const choice = `(${block.options.map((option) => option.trim()).join('|')})`;

    return block.optional ? `[${choice}]` : choice;
  }

  if (block.kind === 'optional') {
    return `[${block.text.trim()}]`;
  }

  return block.text;
};

/** The blocks written back as reply text, spacing as it is. */
export const replyFromBlocks = (blocks: ReplyBlock[]): string =>
  blocks.map(blockText).join('');

const withText = (block: ReplyBlock, text: string): ReplyBlock =>
  block.kind === 'text' ? { ...block, text } : block;

/**
 * The blocks spaced as a sentence after one was moved: one space between
 * words, none at the ends or before a mark that follows a word, none at all
 * in a language written without spaces.
 */
export const spacedReplyBlocks = (
  blocks: ReplyBlock[],
  language: string
): ReplyBlock[] => {
  const unspaced = UNSPACED_LANGUAGES.includes(language);
  const spaced = blocks.map((block) =>
    withText(block, unspaced ? blockText(block).trim() : blockText(block))
  );

  for (let index = 1; index < spaced.length; index += 1) {
    const previous = blockText(spaced[index - 1]);
    const next = blockText(spaced[index]);

    if (CLINGS_TO_PREVIOUS.test(next.trimStart())) {
      spaced[index - 1] = withText(spaced[index - 1], previous.trimEnd());
      spaced[index] = withText(spaced[index], next.trimStart());
    } else if (/\s$/.test(previous)) {
      spaced[index] = withText(spaced[index], next.trimStart());
    } else if (!unspaced && !/^\s/.test(next)) {
      if (spaced[index - 1].kind === 'text') {
        spaced[index - 1] = withText(spaced[index - 1], `${previous} `);
      } else if (spaced[index].kind === 'text') {
        spaced[index] = withText(spaced[index], ` ${next}`);
      } else {
        spaced.splice(index, 0, { kind: 'text', text: ' ' });
        index += 1;
      }
    }
  }

  const first = spaced[0];
  const last = spaced[spaced.length - 1];

  if (first) {
    spaced[0] = withText(first, blockText(first).trimStart());
  }

  if (last) {
    spaced[spaced.length - 1] = withText(last, blockText(last).trimEnd());
  }

  return spaced.filter((block) => block.kind !== 'text' || block.text !== '');
};
