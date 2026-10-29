/**
 * A driver's sentence template as blocks: plain words, one of several
 * choices `(a|b)`, a part that may be left out `[x]`, and a value `{slot}`.
 * Only the top level is split, a word to a block so a value can go between
 * any two; a choice or an optional part keeps whatever it holds as template
 * text, so nothing a template can say is lost.
 */

export type TemplateBlock =
  | { kind: 'words'; text: string }
  /** `optional`: the driver may leave the choice out, `[(a|b)]`. */
  | { kind: 'choice'; options: string[]; optional?: boolean }
  | { kind: 'optional'; text: string }
  /** `optional`: the driver may leave the value out, `[{tires}]`. */
  | { kind: 'slot'; slot: string; optional?: boolean };

/** An optional part that holds only a value: `[{tires}]`. */
const OPTIONAL_SLOT = /^\{\s*([\w.]+)\s*\}$/;

const CLOSING: Record<string, string> = { '(': ')', '[': ']', '{': '}' };

/** Where the bracket opened at `start` closes, or -1 when it never does. */
const closingIndex = (template: string, start: number): number => {
  const stack: string[] = [];

  for (let index = start; index < template.length; index += 1) {
    const character = template[index];

    if (character in CLOSING) {
      stack.push(CLOSING[character]);
    } else if (Object.values(CLOSING).includes(character)) {
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

/** A choice's options: its text split on the `|` outside nested brackets. */
const splitOptions = (inner: string): string[] => {
  const options: string[] = [];
  let depth = 0;
  let current = '';

  for (const character of inner) {
    if (character in CLOSING) {
      depth += 1;
    } else if (Object.values(CLOSING).includes(character)) {
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
  text.startsWith('(') && closingIndex(text, 0) === text.length - 1
    ? text.slice(1, -1)
    : null;

/** The template's blocks, or `null` when its brackets do not pair up. */
export const parseTemplateBlocks = (
  template: string
): TemplateBlock[] | null => {
  const blocks: TemplateBlock[] = [];
  let words = '';
  let index = 0;

  const flushWords = () => {
    words
      .split(/\s+/)
      .filter((word) => word !== '')
      .forEach((word) => blocks.push({ kind: 'words', text: word }));

    words = '';
  };

  while (index < template.length) {
    const character = template[index];

    if (!(character in CLOSING)) {
      if (Object.values(CLOSING).includes(character) || character === '|') {
        return null;
      }

      words += character;
      index += 1;
      continue;
    }

    const end = closingIndex(template, index);

    if (end < 0) {
      return null;
    }

    const inner = template.slice(index + 1, end);

    flushWords();

    if (character === '(') {
      blocks.push({ kind: 'choice', options: splitOptions(inner) });
    } else if (character === '[') {
      const optionalSlot = OPTIONAL_SLOT.exec(inner.trim());
      const optionalChoice = wholeChoice(inner.trim());

      if (optionalSlot) {
        blocks.push({ kind: 'slot', slot: optionalSlot[1], optional: true });
      } else if (optionalChoice !== null) {
        blocks.push({
          kind: 'choice',
          options: splitOptions(optionalChoice),
          optional: true,
        });
      } else {
        blocks.push({ kind: 'optional', text: inner.trim() });
      }
    } else {
      blocks.push({ kind: 'slot', slot: inner.trim() });
    }

    index = end + 1;
  }

  flushWords();

  return blocks;
};

const blockText = (block: TemplateBlock): string => {
  if (block.kind === 'words') {
    return block.text.trim();
  }

  if (block.kind === 'choice') {
    const choice = `(${block.options.map((option) => option.trim()).join('|')})`;

    return block.optional ? `[${choice}]` : choice;
  }

  if (block.kind === 'optional') {
    return `[${block.text.trim()}]`;
  }

  return block.optional ? `[{${block.slot}}]` : `{${block.slot}}`;
};

/** The blocks written back as template text; empty words are dropped. */
export const templateFromBlocks = (blocks: TemplateBlock[]): string =>
  blocks
    .map(blockText)
    .filter((text) => text !== '')
    .join(' ');
