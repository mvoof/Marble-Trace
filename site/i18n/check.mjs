/**
 * `npm run i18n:check` - reports, per language, the English strings on the
 * page a dictionary does not translate yet and the entries no longer on it.
 * `--write` rewrites each dictionary in page order, keeping every translation
 * and adding the missing strings with an empty value to fill in.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRANSLATED_LOCALES, extractStrings } from './translate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const write = process.argv.includes('--write');
const strings = extractStrings(
  readFileSync(join(HERE, '..', 'index.html'), 'utf8')
);

let gaps = 0;

for (const locale of TRANSLATED_LOCALES) {
  const path = join(HERE, `${locale.code}.json`);
  let dictionary = {};

  try {
    dictionary = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    dictionary = {};
  }

  const missing = strings.filter((text) => !dictionary[text]);
  const stale = Object.keys(dictionary).filter(
    (text) => !strings.includes(text)
  );

  gaps += missing.length;
  console.log(
    `${locale.code}: ${missing.length} missing, ${stale.length} stale`
  );
  missing.slice(0, 5).forEach((text) => console.log(`   - ${text}`));

  if (write) {
    const ordered = Object.fromEntries(
      strings.map((text) => [text, dictionary[text] || ''])
    );

    writeFileSync(path, `${JSON.stringify(ordered, null, 2)}\n`);
  }
}

console.log(`${strings.length} strings on the page`);
process.exitCode = gaps && !write ? 1 : 0;
