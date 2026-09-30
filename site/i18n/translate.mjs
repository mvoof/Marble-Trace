/**
 * Site translation.
 *
 * index.html is written in English and stays the only page anyone edits. Each
 * other language is generated from it: every text node and every attribute a
 * reader or a search engine sees is looked up, verbatim after collapsing
 * whitespace, in i18n/<locale>.json and replaced. A string with no entry keeps
 * its English and is reported, so a new sentence on the page never breaks the
 * build - it shows up as a gap to fill.
 *
 * Used by the Vite plugin in vite.config.js (dev server and build) and by
 * `npm run i18n:check`.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, NodeType } from 'node-html-parser';

const HERE = dirname(fileURLToPath(import.meta.url));

export const SITE_URL = 'https://mvoof.github.io/Marble-Trace/';

/** Every language the site is published in; English is the source. */
export const LOCALES = [
  {
    code: 'en',
    htmlLang: 'en',
    ogLocale: 'en_US',
    label: 'English',
    short: 'EN',
  },
  {
    code: 'ru',
    htmlLang: 'ru',
    ogLocale: 'ru_RU',
    label: 'Русский',
    short: 'RU',
  },
  {
    code: 'es',
    htmlLang: 'es',
    ogLocale: 'es_ES',
    label: 'Español',
    short: 'ES',
  },
  {
    code: 'zh',
    htmlLang: 'zh-CN',
    ogLocale: 'zh_CN',
    label: '中文',
    short: '中文',
  },
];

export const TRANSLATED_LOCALES = LOCALES.filter(
  (locale) => locale.code !== 'en'
);

/** Attributes whose value is read by a person or a crawler. */
const TRANSLATED_ATTRIBUTES = [
  'alt',
  'title',
  'aria-label',
  'placeholder',
  'data-name',
  'data-alt',
  'data-group',
  'data-template',
  'data-status-interact',
  'data-status-edit',
  'data-status-game',
  'data-edit-note',
  'data-edit-exit',
];

/** <meta> tags whose content is a sentence rather than a URL or a flag. */
const TRANSLATED_META = new Set([
  'description',
  'og:title',
  'og:description',
  'og:image:alt',
  'twitter:title',
  'twitter:description',
  'twitter:image:alt',
]);

/** JSON-LD fields that carry prose. */
const TRANSLATED_JSON_FIELDS = new Set(['description', 'name', 'text']);

const SKIPPED_TAGS = new Set(['script', 'style', 'code', 'noscript']);

const HAS_LETTERS = /\p{L}/u;

export const normalize = (text) => text.replace(/\s+/g, ' ').trim();

const escapeText = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const loadDictionary = (code) =>
  JSON.parse(readFileSync(join(HERE, `${code}.json`), 'utf8'));

// The doctype comes through the parser as a text node; it is not prose.
const isTranslatable = (text) =>
  HAS_LETTERS.test(text) && !text.startsWith('<!');

/** A node inside translate="no", or inside a tag that holds no prose. */
const isSkipped = (node) => {
  for (let current = node.parentNode; current; current = current.parentNode) {
    const tag = (current.rawTagName || '').toLowerCase();

    if (SKIPPED_TAGS.has(tag)) {
      return true;
    }

    if (current.getAttribute && current.getAttribute('translate') === 'no') {
      return true;
    }
  }

  return false;
};

const translateJsonLd = (scriptNode, visit) => {
  const data = JSON.parse(scriptNode.text);

  const visitValue = (value) => {
    if (Array.isArray(value)) {
      return value.map(visitValue);
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, inner]) => [
          key,
          TRANSLATED_JSON_FIELDS.has(key) && typeof inner === 'string'
            ? (visit(normalize(inner)) ?? inner)
            : visitValue(inner),
        ])
      );
    }

    return value;
  };

  scriptNode.set_content(
    `\n${JSON.stringify(visitValue(data), null, 2)}\n    `
  );
};

/**
 * Walks the page and hands every translatable string to `visit`, which
 * returns the replacement (or undefined to keep it). With a visitor that only
 * collects, this is the extractor.
 */
const walk = (root, visit) => {
  const stack = [root];

  while (stack.length) {
    const node = stack.pop();

    if (node.nodeType === NodeType.TEXT_NODE) {
      const text = normalize(node.text);

      if (isTranslatable(text) && !isSkipped(node)) {
        const replacement = visit(text);

        if (replacement !== undefined) {
          // Keep the surrounding whitespace so inline markup still spaces out.
          const leading = /^\s/.test(node.rawText) ? ' ' : '';
          const trailing = /\s$/.test(node.rawText) ? ' ' : '';

          node.rawText = leading + escapeText(replacement) + trailing;
        }
      }

      continue;
    }

    if (node.nodeType !== NodeType.ELEMENT_NODE) {
      continue;
    }

    const tag = (node.rawTagName || '').toLowerCase();

    if (
      tag === 'script' &&
      node.getAttribute('type') === 'application/ld+json'
    ) {
      translateJsonLd(node, visit);

      continue;
    }

    if (tag && !isSkipped(node) && node.getAttribute('translate') !== 'no') {
      for (const attribute of TRANSLATED_ATTRIBUTES) {
        const value = node.getAttribute(attribute);

        if (value && isTranslatable(value)) {
          const replacement = visit(normalize(value));

          if (replacement !== undefined) {
            node.setAttribute(attribute, replacement);
          }
        }
      }

      if (tag === 'meta') {
        const key = node.getAttribute('name') || node.getAttribute('property');
        const content = node.getAttribute('content');

        if (TRANSLATED_META.has(key) && content) {
          const replacement = visit(normalize(content));

          if (replacement !== undefined) {
            node.setAttribute('content', replacement);
          }
        }
      }
    }

    for (let index = node.childNodes.length - 1; index >= 0; index -= 1) {
      stack.push(node.childNodes[index]);
    }
  }
};

/** Every string on the page, in order of first appearance. */
export const extractStrings = (html) => {
  const seen = new Set();

  walk(parse(html, { comment: false }), (text) => {
    seen.add(text);

    return undefined;
  });

  return [...seen];
};

/**
 * Prefixes every relative URL with `../` for a page one folder down, so the
 * translated copy in /ru/ reaches the same assets as the English one.
 */
const RELATIVE_URL =
  /\b(src|href|srcset)="(?!https?:|mailto:|data:|#|\/|\.\.\/)([^"]+)"/g;

const rebaseUrl = (url) =>
  url.startsWith('./') ? `../${url.slice(2)}` : `../${url}`;

// A srcset is a list - "a.webp 480w, b.webp 960w" - and every URL in it moves.
const rebaseSrcset = (list) =>
  list
    .split(',')
    .map((candidate) => {
      const [url, ...descriptor] = candidate.trim().split(/\s+/);

      return [rebaseUrl(url), ...descriptor].join(' ');
    })
    .join(', ');

const rebase = (html) =>
  html.replace(RELATIVE_URL, (match, attribute, url) => {
    const rebased = attribute === 'srcset' ? rebaseSrcset(url) : rebaseUrl(url);

    return `${attribute}="${rebased}"`;
  });

const setMeta = (root, property, value) => {
  const meta = root.querySelector(`meta[property="${property}"]`);

  if (meta) {
    meta.setAttribute('content', value);
  }
};

const setLink = (root, rel, href) => {
  const link = root.querySelector(`link[rel="${rel}"]`);

  if (link) {
    link.setAttribute('href', href);
  }
};

/** Moves aria-current to this language's links and names it in the switcher. */
const markCurrentLanguage = (root, locale) => {
  root.querySelectorAll('[data-lang]').forEach((link) => {
    if (link.getAttribute('data-lang') === locale.code) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });

  root.querySelectorAll('[data-lang-current]').forEach((label) => {
    label.set_content(locale.short);
  });
};

/**
 * The English page as a page in `locale`: text replaced, <html lang> and the
 * locale-specific head tags set, URLs rebased one folder down. Returns the
 * html and the English strings that had no translation.
 */
export const translatePage = (source, locale, dictionary) => {
  const root = parse(source, { comment: true });
  const missing = new Set();

  walk(root, (text) => {
    const translation = dictionary[text];

    if (!translation) {
      missing.add(text);

      return undefined;
    }

    return translation;
  });

  root.querySelector('html').setAttribute('lang', locale.htmlLang);
  markCurrentLanguage(root, locale);
  setMeta(root, 'og:locale', locale.ogLocale);
  setLink(root, 'canonical', `${SITE_URL}${locale.code}/`);
  setMeta(root, 'og:url', `${SITE_URL}${locale.code}/`);

  const html = rebase(root.toString()).replace(
    '"inLanguage": "en"',
    `"inLanguage": "${locale.htmlLang}"`
  );

  return { html, missing: [...missing] };
};
