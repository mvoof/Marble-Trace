import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

const IMAGE_MANIFEST = join(ROOT, 'assets', 'img', 'manifest.json');
const IMG_TAG = /<img\b[^>]*>/g;
const DEFAULT_SIZES = '100vw';

/**
 * Every <img> whose source has WebP copies (npm run images) is served as
 * those copies: the widest as src, all of them as srcset, and the source's
 * own size as width/height so the box is held before the picture arrives.
 * A `sizes` written on the tag is kept; without one the picture is assumed
 * to span the screen. Runs before Vite resolves the URLs, so the copies are
 * hashed and bundled like any other asset.
 */
const responsiveImages = () => {
  const manifest = existsSync(IMAGE_MANIFEST)
    ? JSON.parse(readFileSync(IMAGE_MANIFEST, 'utf8'))
    : {};

  const attribute = (tag, name) => {
    const match = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);

    return match ? match[1] : null;
  };

  const rewrite = (tag) => {
    const src = attribute(tag, 'src');
    const entry = src && manifest[src];

    if (!entry) {
      if (src && /^assets\/(widgets|control|why|screens|layouts)\//.test(src)) {
        console.warn(`[images] no WebP copies for ${src} (run npm run images)`);
      }

      return tag;
    }

    const widest = entry.variants[entry.variants.length - 1];
    const srcset = entry.variants
      .map((variant) => `${variant.path} ${variant.width}w`)
      .join(', ');
    const extra = [
      `srcset="${srcset}"`,
      attribute(tag, 'sizes') ? '' : `sizes="${DEFAULT_SIZES}"`,
      attribute(tag, 'width') ? '' : `width="${entry.width}"`,
      attribute(tag, 'height') ? '' : `height="${entry.height}"`,
    ]
      .filter(Boolean)
      .join(' ');

    return tag
      .replace(`src="${src}"`, `src="${widest.path}"`)
      .replace(/^<img\b/, `<img ${extra}`);
  };

  return {
    name: 'marble-trace-responsive-images',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => html.replace(IMG_TAG, rewrite),
    },
  };
};

// Relative base so the built site works from any location: domain root,
// a sub-path (e.g. GitHub Pages /Marble-Trace/), or opened straight from disk.
export default defineConfig({
  base: './',
  plugins: [responsiveImages(), localizedPages()],
});
