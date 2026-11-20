import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SITE = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(SITE, 'assets', 'why', 'hero-overlay.png');
const OUTPUT = join(SITE, 'public', 'hero-widgets');

const WIDGET_CROPS = [
  { name: 'standings', left: 0, top: 0, width: 856, height: 460 },
  { name: 'fuel', left: 3168, top: 516, width: 272, height: 336 },
  { name: 'relative', left: 0, top: 1208, width: 388, height: 232 },
  { name: 'lap-log', left: 8, top: 464, width: 220, height: 272 },
  { name: 'weather', left: 3120, top: 1280, width: 312, height: 160 },
  { name: 'input-trace', left: 1520, top: 916, width: 456, height: 104 },
  { name: 'track-map', left: 2948, top: 44, width: 460, height: 236 },
  { name: 'lap-delta', left: 1440, top: 88, width: 544, height: 52 },
  { name: 'pit-status', left: 408, top: 1380, width: 132, height: 56 },
  { name: 'proximity', left: 1344, top: 932, width: 92, height: 196 },
];

mkdirSync(OUTPUT, { recursive: true });

await Promise.all(
  WIDGET_CROPS.map(async (crop) => {
    await sharp(SOURCE)
      .extract({
        left: crop.left,
        top: crop.top,
        width: crop.width,
        height: crop.height,
      })
      .png({ compressionLevel: 9 })
      .toFile(join(OUTPUT, `${crop.name}.png`));
  })
);

console.log(`Created ${WIDGET_CROPS.length} hero widget crops.`);
