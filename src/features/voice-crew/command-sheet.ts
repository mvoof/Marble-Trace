/**
 * The pack's voice commands as one printable HTML page, written in the pack's
 * own language: what each command does, the sentences that call it as
 * readable patterns, and a reply the engineer may give. Everything from the
 * pack is escaped — a pack may come from someone else.
 */

import type { TFunction } from 'i18next';
import type {
  VoiceIntentView,
  VoicePackView,
} from '@shared/contracts/generated/bindings';
import { VOICE_QUESTION_PREFIX } from '@shared/contracts/generated/backend-constants';
import { parseReplyBlocks, type ReplyBlock } from './reply-blocks';
import { parseTemplateBlocks, type TemplateBlock } from './template-blocks';

const SECTIONS = [
  'fuel',
  'tires',
  'pit',
  'race',
  'control',
  'questions',
] as const;

type Section = (typeof SECTIONS)[number];

const FUEL_INTENTS: readonly string[] = [
  'pit.fuel',
  'pit.fuelToFinish',
  'pit.clearFuel',
];
const TIRE_INTENTS: readonly string[] = [
  'pit.tires',
  'pit.clearTires',
  'pit.compound',
];
/** Languages written without spaces between words. */
const UNSPACED_LANGUAGES: readonly string[] = ['zh'];
const NUMBER_SLOT = 'number';
const PLURAL_WORD_ORDER = ['other', 'many', 'few', 'two', 'one', 'zero'];

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);

const sectionOf = (intent: VoiceIntentView): Section => {
  if (FUEL_INTENTS.includes(intent.id)) {
    return 'fuel';
  }

  if (TIRE_INTENTS.includes(intent.id)) {
    return 'tires';
  }

  if (intent.id.startsWith(VOICE_QUESTION_PREFIX)) {
    return 'questions';
  }

  if (intent.id.startsWith('pit.')) {
    return 'pit';
  }

  if (intent.id.startsWith('query.')) {
    return 'race';
  }

  return 'control';
};

interface SheetText {
  language: string;
  t: TFunction;
}

/** A value's name as the driver reads it: `‹number›`. */
const placeholder = (name: string, { t }: SheetText): string => {
  const fallback =
    name === NUMBER_SLOT ? t('crewPage.cheatSheet.number') : name;
  const label = t(`crewPage.values.names.${name}`, { defaultValue: fallback });

  return `<span class="value">‹${escapeHtml(label)}›</span>`;
};

const joinWords = (pieces: string[], { language }: SheetText): string =>
  pieces.join(UNSPACED_LANGUAGES.includes(language) ? '' : ' ');

const templateHtml = (template: string, text: SheetText): string => {
  const blocks = parseTemplateBlocks(template);

  if (!blocks) {
    return escapeHtml(template);
  }

  return joinWords(
    blocks.map((block) => templateBlockHtml(block, text)),
    text
  );
};

const optionalHtml = (inner: string): string =>
  `<span class="optional">[${inner}]</span>`;

const templateBlockHtml = (block: TemplateBlock, text: SheetText): string => {
  if (block.kind === 'words') {
    return escapeHtml(block.text);
  }

  if (block.kind === 'slot') {
    const value = placeholder(block.slot, text);

    return block.optional ? optionalHtml(value) : value;
  }

  if (block.kind === 'optional') {
    return optionalHtml(templateHtml(block.text, text));
  }

  const options = block.options
    .map((option) => templateHtml(option, text))
    .join('<span class="or"> / </span>');

  return block.optional ? optionalHtml(options) : `(${options})`;
};

const pluralWord = (words: Partial<Record<string, string>>): string =>
  PLURAL_WORD_ORDER.map((form) => words[form]).find(Boolean) ?? '';

/** A reply as it may sound: the first way of each choice, its values named. */
const replyHtml = (reply: string, text: SheetText): string => {
  const blocks = parseReplyBlocks(reply);

  if (!blocks) {
    return escapeHtml(reply);
  }

  return blocks.map((block) => replyBlockHtml(block, text)).join('');
};

const replyBlockHtml = (block: ReplyBlock, text: SheetText): string => {
  if (block.kind === 'value') {
    return placeholder(block.value, text);
  }

  if (block.kind === 'plural') {
    const word = pluralWord(block.words);
    const separator = UNSPACED_LANGUAGES.includes(text.language) ? '' : ' ';

    return `${placeholder(block.value, text)}${word ? separator + escapeHtml(word) : ''}`;
  }

  if (block.kind === 'choice') {
    return replyHtml(block.options[0] ?? '', text);
  }

  if (block.kind === 'optional') {
    return replyHtml(block.text, text);
  }

  return escapeHtml(block.text);
};

interface SheetRow {
  title: string;
  description: string;
  templates: string[];
  reply: string | null;
}

const rowOf = (
  intent: VoiceIntentView,
  pack: VoicePackView,
  { t }: SheetText
): SheetRow => {
  const question = intent.id.startsWith(VOICE_QUESTION_PREFIX)
    ? pack.questions.find(
        (candidate) =>
          candidate.id === intent.id.slice(VOICE_QUESTION_PREFIX.length)
      )
    : undefined;
  const reply = intent.replies
    .map(
      (key) =>
        pack.phrases.find((phrase) => phrase.key === key)?.variants[0]?.text
    )
    .find((text) => text !== undefined && text.trim() !== '');

  if (question) {
    return {
      title: question.name || t('crewPage.questions.untitled'),
      description: '',
      templates: intent.templates,
      reply: reply ?? null,
    };
  }

  return {
    title: t(`crewPage.actions.${intent.id}.title`, {
      defaultValue: intent.id,
    }),
    description: t(`crewPage.actions.${intent.id}.desc`, { defaultValue: '' }),
    templates: intent.templates,
    reply: reply ?? null,
  };
};

const rowHtml = (row: SheetRow, text: SheetText): string => {
  const description = row.description
    ? `<div class="desc">${escapeHtml(row.description)}</div>`
    : '';
  const templates = row.templates
    .map((template) => `<li>${templateHtml(template, text)}</li>`)
    .join('');
  const reply = row.reply === null ? '—' : replyHtml(row.reply, text);

  return [
    '<tr>',
    `<td class="command"><div class="title">${escapeHtml(row.title)}</div>${description}</td>`,
    `<td><ul>${templates}</ul></td>`,
    `<td class="reply">${reply}</td>`,
    '</tr>',
  ].join('');
};

const sectionTitle = (section: Section, { t }: SheetText): string => {
  if (section === 'questions') {
    return t('crewPage.questions.title');
  }

  if (section === 'control') {
    return t('crewPage.commands.groups.control');
  }

  return t(`crewPage.cheatSheet.sections.${section}`);
};

const sectionHtml = (
  section: Section,
  rows: SheetRow[],
  text: SheetText
): string => {
  const { t } = text;

  return [
    `<section><h2>${escapeHtml(sectionTitle(section, text))}</h2>`,
    '<table><thead><tr>',
    `<th class="command">${escapeHtml(t('crewPage.cheatSheet.command'))}</th>`,
    `<th>${escapeHtml(t('crewPage.commands.says'))}</th>`,
    `<th class="reply">${escapeHtml(t('crewPage.commands.answers'))}</th>`,
    '</tr></thead><tbody>',
    rows.map((row) => rowHtml(row, text)).join(''),
    '</tbody></table></section>',
  ].join('');
};

/** The words for each value of the pack's slots: `‹tires›` — all four, fronts… */
const valuesHtml = (pack: VoicePackView, text: SheetText): string => {
  const { t } = text;
  const slots = pack.slots
    .filter((slot) => slot.values.length > 0)
    .map((slot) => {
      const values = slot.values
        .filter((value) => value.phrases.length > 0)
        .map(
          (value) =>
            `<li>${value.phrases.map(escapeHtml).join('<span class="or"> / </span>')}</li>`
        )
        .join('');

      return `<div class="slot"><h3>${placeholder(slot.slot, text)}</h3><ul>${values}</ul></div>`;
    })
    .join('');
  const number = `<div class="slot"><h3>${placeholder(NUMBER_SLOT, text)}</h3><p>${escapeHtml(t('crewPage.cheatSheet.numberNote'))}</p></div>`;

  return `<section><h2>${escapeHtml(t('crewPage.cheatSheet.values'))}</h2><div class="slots">${number}${slots}</div></section>`;
};

const STYLE = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body {
  margin: 24px auto;
  max-width: 1080px;
  padding: 0 16px;
  color: #1a1a1a;
  background: #fff;
  font: 14px/1.45 system-ui, "Segoe UI", "Microsoft YaHei", "PingFang SC",
    "Noto Sans CJK SC", "Noto Sans", sans-serif;
}
header { border-bottom: 2px solid #1a1a1a; margin-bottom: 16px; padding-bottom: 8px; }
h1 { font-size: 22px; margin: 0 0 4px; }
.meta { color: #555; }
.legend { color: #555; margin-top: 4px; font-size: 13px; }
h2 { font-size: 17px; margin: 24px 0 8px; }
h3 { font-size: 14px; margin: 0 0 4px; }
table { width: 100%; border-collapse: collapse; }
thead { display: table-header-group; }
th, td { border: 1px solid #c8c8c8; padding: 6px 8px; text-align: left; vertical-align: top; }
th { background: #f0f0f0; font-weight: 600; }
tr { break-inside: avoid; }
.command { width: 26%; }
.reply { width: 28%; }
.title { font-weight: 600; }
.desc { color: #555; font-size: 12px; margin-top: 2px; }
ul { margin: 0; padding-left: 18px; }
.value { color: #a14a00; font-weight: 600; white-space: nowrap; }
.optional { color: #6a6a6a; }
.or { color: #8a8a8a; }
.slots { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.slot p { margin: 0; }
@media print {
  body { margin: 0; max-width: none; font-size: 11px; }
  h2 { break-after: avoid; }
}
`;

/** The whole page for `pack`, labelled in its language by `t`, dated `date`. */
export const buildCommandSheet = (
  pack: VoicePackView,
  t: TFunction,
  date: Date
): string => {
  const text: SheetText = { language: pack.language, t };
  const enabledQuestions = new Set(
    pack.questions
      .filter((question) => question.enabled)
      .map((question) => `${VOICE_QUESTION_PREFIX}${question.id}`)
  );
  const intents = pack.intents.filter(
    (intent) =>
      !intent.id.startsWith(VOICE_QUESTION_PREFIX) ||
      enabledQuestions.has(intent.id)
  );
  const sections = SECTIONS.map((section) => ({
    section,
    rows: intents
      .filter((intent) => sectionOf(intent) === section)
      .map((intent) => rowOf(intent, pack, text)),
  })).filter(({ rows }) => rows.length > 0);
  const languageName = t(`crewPage.voice.languages.${pack.language}`, {
    defaultValue: pack.language,
  });
  const exportedOn = new Intl.DateTimeFormat(pack.language, {
    dateStyle: 'long',
  }).format(date);
  const title = t('crewPage.cheatSheet.title');

  return [
    '<!doctype html>',
    `<html lang="${escapeHtml(pack.language)}">`,
    '<head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${STYLE}</style></head><body>`,
    `<header><h1>${escapeHtml(title)}</h1>`,
    `<div class="meta">${escapeHtml(t('crewPage.cheatSheet.meta', { language: languageName, date: exportedOn }))}</div>`,
    `<div class="legend">${escapeHtml(t('crewPage.cheatSheet.legend'))}</div></header>`,
    sections
      .map(({ section, rows }) => sectionHtml(section, rows, text))
      .join(''),
    valuesHtml(pack, text),
    '</body></html>',
    '',
  ].join('\n');
};
