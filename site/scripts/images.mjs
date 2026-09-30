/**
 * `npm run images` - the responsive copies of every picture the page shows.
 *
 * The page keeps pointing at the source files (index.html, the README and the
 * widget capture script all share site/assets/widgets/*.png), and this writes
 * WebP copies of each at a ladder of widths into assets/img/, plus a manifest
 * of what it wrote. The Vite plugin in vite.config.js reads that manifest and
 * turns every <img src="assets/..."> into the WebP with a srcset and its
 * intrinsic size, so no source is edited by hand to add a size.
 *
 * Only sources newer than their copies are encoded again; a picture added,
 * replaced or recaptured needs one more run, and the build warns about any
 * <img> it finds no copies for.
 */

import {
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
  existsSync,
} from 'node:fs';
import { basename, dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SITE = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(SITE, 'assets', 'img');

/** Folders whose pictures the page shows. */
const SOURCE_DIRS = ['widgets', 'control', 'why', 'screens', 'layouts'];
const SOURCE_TYPES = new Set(['.png', '.jpg', '.jpeg', '.webp']);

/** The widths a srcset offers; a picture never gets a copy wider than itself. */
const WIDTHS = [480, 960, 1440, 1920, 2560];
const QUALITY = 80;

const posix = (path) => path.split('\\').join('/');

const variantsFor = (width) => {
  const ladder = WIDTHS.filter((step) => step < width);

  return [...ladder, Math.min(width, WIDTHS[WIDTHS.length - 1])];
};

const isStale = (source, target) =>
  !existsSync(target) || statSync(target).mtimeMs < statSync(source).mtimeMs;

const manifest = {};
let encoded = 0;

for (const dir of SOURCE_DIRS) {
  const sourceDir = join(SITE, 'assets', dir);

  for (const file of readdirSync(sourceDir)) {
    if (!SOURCE_TYPES.has(extname(file).toLowerCase())) {
      continue;
    }

    const source = join(sourceDir, file);
    const { width, height } = await sharp(source).metadata();
    const name = basename(file, extname(file));
    const targetDir = join(OUT, dir);
    const variants = [];

    mkdirSync(targetDir, { recursive: true });

    for (const step of variantsFor(width)) {
      const target = join(targetDir, `${name}-${step}.webp`);

      if (isStale(source, target)) {
        await sharp(source)
          .resize({ width: step, withoutEnlargement: true })
          .webp({ quality: QUALITY, alphaQuality: 90, effort: 6 })
          .toFile(target);
        encoded += 1;
      }

      variants.push({ width: step, path: posix(relative(SITE, target)) });
    }

    manifest[posix(relative(SITE, source))] = { width, height, variants };
  }
}

writeFileSync(
  join(OUT, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`
);

console.log(
  `${Object.keys(manifest).length} pictures, ${encoded} copies encoded`
);
