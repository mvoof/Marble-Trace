import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import {
  TRANSLATED_LOCALES,
  loadDictionary,
  translatePage,
} from './i18n/translate.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const LOCALE_PATH = /^\/(ru|es|zh)(\/(index\.html)?)?(\?.*)?$/;

/**
 * Every language besides English is a copy of index.html translated from
 * i18n/<code>.json. The build writes it to dist/<code>/index.html from the
 * finished English page, hashed asset names and all; the dev server builds
 * the same page on request, so /ru/ can be checked before a build.
 */
const localizedPages = () => {
  let outDir = 'dist';

  const report = (locale, missing) => {
    if (missing.length) {
      console.warn(
        `[i18n] ${locale.code}: ${missing.length} untranslated, left in English ` +
          `(run npm run i18n:check)`
      );
    }
  };

  return {
    name: 'marble-trace-localized-pages',

    configResolved(config) {
      outDir = join(config.root, config.build.outDir);
    },

    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const match = LOCALE_PATH.exec(request.url || '');
        const locale =
          match && TRANSLATED_LOCALES.find((entry) => entry.code === match[1]);

        if (!locale) {
          next();

          return;
        }

        if (!match[2]) {
          response.statusCode = 302;
          response.setHeader('Location', `/${locale.code}/`);
          response.end();

          return;
        }

        try {
          const source = readFileSync(join(ROOT, 'index.html'), 'utf8');
          const english = await server.transformIndexHtml('/', source);
          const { html, missing } = translatePage(
            english,
            locale,
            loadDictionary(locale.code)
          );

          report(locale, missing);
          response.setHeader('Content-Type', 'text/html; charset=utf-8');
          response.end(html);
        } catch (error) {
          next(error);
        }
      });
    },

    closeBundle() {
      const english = readFileSync(join(outDir, 'index.html'), 'utf8');

      for (const locale of TRANSLATED_LOCALES) {
        const { html, missing } = translatePage(
          english,
          locale,
          loadDictionary(locale.code)
        );
        const directory = join(outDir, locale.code);

        mkdirSync(directory, { recursive: true });
        writeFileSync(join(directory, 'index.html'), html);
        report(locale, missing);
      }
    },
  };
};

// Relative base so the built site works from any location: domain root,
// a sub-path (e.g. GitHub Pages /Marble-Trace/), or opened straight from disk.
export default defineConfig({
  base: './',
  plugins: [localizedPages()],
});
