// Captures widget pictures from Storybook as transparent PNGs into
// site/assets/widgets/ - the one set of widget pictures the site gallery
// and the README both use.
//
// Start Storybook first, and nothing else heavy beside it:
//
//   npm run storybook
//
// then:
//
//   npm run capture:widgets                      every picture in SHOTS
//   npm run capture:widgets -- fuel standings    only these files
//   npm run capture:widgets -- --border          with the frame's border
//
// Each shot is one story, taken as the widget itself at 3x with its alpha
// intact: the container's ground and border the story decorator draws (the
// user's background on the overlay) are taken off, every ancestor is made
// transparent, and the page's own ground is left out. A picture is a story, so a state worth showing is a story
// worth writing: give the widget a story that seeds it the way it looks in a
// race, and point SHOTS at it.

import path from 'node:path';
import process from 'node:process';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const STORYBOOK_URL = process.env.STORYBOOK_URL ?? 'http://localhost:6006';
const OUT_DIR = path.join(process.cwd(), 'site', 'assets', 'widgets');
const DEVICE_SCALE = 3;
const VIEWPORT = { width: 1600, height: 1200 };
// Long enough for a sweep, a blink or a chart to reach a resting frame
const SETTLE_MS = 1200;

// The story decorator's frame: the one element carrying --widget-bg
const WIDGET_FRAME = '#storybook-root [style*="--widget-bg"]';

// How far past its own frame a widget's overhang is taken in - a badge or a
// flag, not an element parked far off for later
const OVERHANG_PX = 160;

const KEEP_BORDER = process.argv.includes('--border');

// file name -> [story title under Widgets/, story name, options?]. Options:
// `settle` (ms) overrides SETTLE_MS; `ground: false` drops the frame's own
// background too, for widgets that sit on nothing on the overlay. The first
// entry of a widget is its picture on the site; the ones after it are the
// variants the README shows beside it.
const SHOTS = {
  battery: ['BatteryWidget', 'deploying'],
  'close-battle': ['CloseBattleWidget', 'ahead-behind-and-merged'],
  coach: ['CoachWidget', 'brake-call'],
  delta: ['DeltaWidget', 'default'],
  'delta-best': ['DeltaWidget', 'best-lap'],
  drs: ['DrsWidget', 'open'],
  engine: ['EnginePanelWidget', 'default'],
  'flat-flag': ['FlatFlagsWidget', 'yellow'],
  fuel: ['FuelWidget', 'full-preview'],
  'fuel-pit-stop': ['FuelWidget', 'pit-window-open'],
  'g-metr': ['GMeter', 'showcase'],
  'input-trace': ['InputTraceWidget', 'showcase'],
  'invisible-dash': ['InvisibleDashWidget', 'default'],
  'lap-log': ['LapLogWidget', 'with-history'],
  'led-flag-dual': ['LedFlagWidget', 'yellow-flag'],
  'led-flag-one': ['LedFlagWidget', 'safety-car-single-led'],
  map: ['TrackMapWidget', 'with-sectors'],
  'map-record': ['TrackMapWidget', 'recording'],
  'pit-line': ['PitLineWidget', 'on-the-way-in'],
  'pit-service': ['PitServiceWidget', 'servicing'],
  'proximity-radar': ['ProximityRadarWidget', 'surrounded'],
  'race-dash': ['RaceDashWidget', 'on-pace'],
  'radar-bar': ['RadarBarWidget', 'both-sides'],
  relative: ['RelativeWidget', 'default'],
  'relative-map': ['RelativeMapWidget', 'horizontal'],
  'rpm-lights': ['RpmLightsWidget', 'mid-rpm'],
  'sector-matrix': ['SectorMatrixWidget', 'in-progress'],
  standings: ['StandingsWidget', 'default'],
  'stream-chat': ['StreamChatWidget', 'default'],
  timer: ['TimerWidget', 'timed-race'],
  weather: ['WeatherWidget', 'horizontal'],
  'wheel-to-wheel': ['WheelToWheelWidget', 'in-the-fight'],
};

const storyId = ([title, name]) => `widgets-${title.toLowerCase()}--${name}`;

const storyUrl = (id) => `${STORYBOOK_URL}/iframe.html?id=${id}&viewMode=story`;

// Leaves the widget on nothing: every ancestor of the frame is made
// transparent, so the page behind it is not in the shot. The frame keeps its
// ground - the widget's own background - and loses its border unless
// --border is passed: on the overlay the border is a colour the user can
// clear, and the pictures show it cleared.
const clearGround = (page, keepBorder, keepGround) =>
  page.evaluate(
    ([frameSelector, border, ground]) => {
      const frame = document.querySelector(frameSelector);

      if (!frame) {
        return;
      }

      if (!border) {
        frame.style.borderColor = 'transparent';
        // A widget that draws its own plate (Race Dash) borders it from this
        frame.style.setProperty('--widget-border', 'transparent');
      }

      if (!ground) {
        frame.style.background = 'transparent';
        frame.style.setProperty('--widget-bg', 'transparent');
      }

      // The decorator clips at its fixed size; whatever the widget draws past
      // it belongs in the picture, the clip below decides how much
      frame.style.overflow = 'visible';

      for (let node = frame.parentElement; node; node = node.parentElement) {
        node.style.background = 'transparent';
      }
    },
    [WIDGET_FRAME, keepBorder, keepGround]
  );

// The frame and anything it hangs past its edge, up to OVERHANG_PX
const clipOf = (page) =>
  page
    .locator(WIDGET_FRAME)
    .first()
    .evaluate((node, overhang) => {
      const own = node.getBoundingClientRect();

      const rects = [node, ...node.querySelectorAll('*')]
        .filter((element) => element.checkVisibility({ opacityProperty: true }))
        .map((element) => element.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0);

      const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

      const left = Math.floor(
        clamp(
          Math.min(...rects.map((rect) => rect.left)),
          own.left - overhang,
          own.left
        )
      );

      const top = Math.floor(
        clamp(
          Math.min(...rects.map((rect) => rect.top)),
          own.top - overhang,
          own.top
        )
      );

      const right = Math.ceil(
        clamp(
          Math.max(...rects.map((rect) => rect.right)),
          own.right,
          own.right + overhang
        )
      );

      const bottom = Math.ceil(
        clamp(
          Math.max(...rects.map((rect) => rect.bottom)),
          own.bottom,
          own.bottom + overhang
        )
      );

      return { x: left, y: top, width: right - left, height: bottom - top };
    }, OVERHANG_PX);

const shoot = async (page, fileName, story) => {
  const id = storyId(story);
  const { settle = SETTLE_MS, ground = true } = story[2] ?? {};

  await page.goto(storyUrl(id));
  await page.locator(WIDGET_FRAME).first().waitFor({ state: 'visible' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(settle);
  await clearGround(page, KEEP_BORDER, ground);

  const target = path.join(OUT_DIR, `${fileName}.png`);

  await page.screenshot({
    path: target,
    clip: await clipOf(page),
    omitBackground: true,
  });

  console.log(`- ${fileName}  (${id})`);
};

const main = async () => {
  const only = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  const unknown = only.filter((name) => !(name in SHOTS));

  if (unknown.length > 0) {
    throw new Error(`Not in SHOTS: ${unknown.join(', ')}`);
  }

  const response = await fetch(`${STORYBOOK_URL}/index.json`).catch(() => null);

  if (!response?.ok) {
    throw new Error(
      `Storybook is not answering at ${STORYBOOK_URL} - start it with npm run storybook.`
    );
  }

  const { entries } = await response.json();
  const wanted = only.length > 0 ? only : Object.keys(SHOTS);
  const missing = wanted.filter((name) => !(storyId(SHOTS[name]) in entries));

  if (missing.length > 0) {
    throw new Error(
      `No such story for: ${missing
        .map((name) => `${name} (${storyId(SHOTS[name])})`)
        .join(', ')}`
    );
  }

  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE,
  });

  try {
    for (const name of wanted) {
      await shoot(page, name, SHOTS[name]);
    }
  } finally {
    await browser.close();
  }

  // The site never serves these PNGs: it serves WebP copies at several
  // widths, which go stale the moment a PNG is written over. Refreshing
  // them here means a new picture reaches the site with no step to forget.
  execSync('npm run images', {
    cwd: path.join(process.cwd(), 'site'),
    stdio: 'inherit',
  });
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
