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
//   npm run capture:widgets -- --audit           no pictures: which frames
//                                                leave empty room or cut
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
const AUDIT = process.argv.includes('--audit');

// How much room a frame may leave beside what the widget draws, in CSS px,
// before the audit calls it too big: a widget's own padding (up to ~16 px)
// sits within it
const SPARE_ROOM_PX = 24;

// file name -> [story title under Widgets/, story name, options?]. Options:
// `settle` (ms) overrides SETTLE_MS; `overhang` (px) overrides OVERHANG_PX for
// a widget that draws far past its box by design (Delta's gauge); `ground: false` drops the frame's own
// background too, for widgets that sit on nothing on the overlay. The first
// entry of a widget is its picture on the site; the ones after it are the
// variants the README shows beside it.
const SHOTS = {
  abs: ['AbsWidget', 'active'],
  battery: ['BatteryWidget', 'deploying'],
  'close-battle': ['CloseBattleWidget', 'ahead-behind-and-merged'],
  coach: ['CoachWidget', 'brake-call'],
  'crew-radio': ['CrewRadioWidget', 'reply'],
  delta: ['DeltaWidget', 'default', { overhang: 320 }],
  'delta-best': ['DeltaWidget', 'best-lap'],
  drs: ['DrsWidget', 'open'],
  engine: ['EnginePanelWidget', 'default'],
  'flat-flag': ['FlatFlagsWidget', 'showcase', { ground: false }],
  fuel: ['FuelWidget', 'showcase'],
  'fuel-pit-stop': ['FuelWidget', 'pit-window-open'],
  'g-metr': ['GMeter', 'showcase'],
  'incident-tracker': ['IncidentTrackerWidget', 'minor-incidents'],
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
  radio: ['RadioWidget', 'all-drivers'],
  relative: ['RelativeWidget', 'default'],
  'relative-map': ['RelativeMapWidget', 'horizontal'],
  'rpm-lights': ['RpmLightsWidget', 'mid-rpm'],
  'sector-matrix': ['SectorMatrixWidget', 'in-progress'],
  standings: ['StandingsWidget', 'default'],
  'stream-chat': ['StreamChatWidget', 'default'],
  timer: ['TimerWidget', 'timed-race'],
  weather: ['WeatherWidget', 'horizontal'],
  'wheel-to-wheel': ['WheelToWheelWidget', 'in-the-fight'],

  // The setups and states the site gallery switches between, one widget at a
  // time: <widget's own picture>-<what changes>.
  'standings-all-columns': ['StandingsWidget', 'with-all-columns'],
  'standings-minimal': ['StandingsWidget', 'minimal-columns'],
  'standings-grouped': ['StandingsWidget', 'grouped-by-class'],
  'standings-team': ['StandingsWidget', 'team-race'],
  'relative-minimal': ['RelativeWidget', 'minimal-view'],
  'relative-abbreviated': ['RelativeWidget', 'abbreviated-names'],
  'relative-driver-flags': ['RelativeWidget', 'with-driver-flags'],
  'input-trace-no-wheel': ['InputTraceWidget', 'corner-speeds-without-wheel'],
  'input-trace-throttle-brake': ['InputTraceWidget', 'only-throttle-brake'],
  'input-trace-corner-speeds': ['InputTraceWidget', 'corner-speeds'],
  'race-dash-comb': ['RaceDashWidget', 'rpm-sweep-animation-comb'],
  'race-dash-no-ring': ['RaceDashWidget', 'rpm-sweep-animation-hidden-ring'],
  'race-dash-pit-limiter': ['RaceDashWidget', 'pit-limiter'],
  'invisible-dash-contour': ['InvisibleDashWidget', 'contour'],
  'invisible-dash-backdrop': ['InvisibleDashWidget', 'full-backdrop'],
  'invisible-dash-compact': ['InvisibleDashWidget', 'compact'],
  'fuel-line': ['FuelWidget', 'with-line-chart'],
  'fuel-no-chart': ['FuelWidget', 'no-chart'],
  'fuel-forecast': ['FuelWidget', 'next-stop-forecast'],
  'map-class-shapes': ['TrackMapWidget', 'class-shapes'],
  'map-incidents': ['TrackMapWidget', 'with-incident-zones'],
  'relative-map-vertical': ['RelativeMapWidget', 'vertical'],
  'weather-vertical': ['WeatherWidget', 'default'],
  'weather-forecast': ['WeatherWidget', 'with-forecast'],
  'weather-rain': ['WeatherWidget', 'heavy-rain'],
  'g-metr-trail': ['GMeter', 'trail-mono'],
  'g-metr-peak': ['GMeter', 'peak-simple'],
  'g-metr-fading': ['GMeter', 'fading-advanced'],
  'close-battle-full-names': ['CloseBattleWidget', 'full-names'],
  'close-battle-axis': ['CloseBattleWidget', 'compact-axis-only'],
  'coach-no-trace': ['CoachWidget', 'trace-off'],
  'coach-no-readouts': ['CoachWidget', 'no-readouts'],
  'coach-brake-channel': ['CoachWidget', 'brake-channel'],
  'engine-formula': ['EnginePanelWidget', 'formula-car'],
  'engine-minimal': ['EnginePanelWidget', 'minimal-layout'],
  'battery-compact': ['BatteryWidget', 'compact'],
  'battery-lap-deploy': ['BatteryWidget', 'with-lap-deploy'],
  'pit-service-no-footer': ['PitServiceWidget', 'footer-off'],
  'pit-service-interact': ['PitServiceWidget', 'interact-mode'],
  'timer-minimal': ['TimerWidget', 'minimal-view'],
  'timer-clocks': ['TimerWidget', 'with-clocks'],
  'timer-dates': ['TimerWidget', 'with-dates'],
  'lap-log-pace-loss': ['LapLogWidget', 'pace-loss-bars'],
  'wheel-to-wheel-rows': ['WheelToWheelWidget', 'rows'],
  'abs-idle': ['AbsWidget', 'idle'],
  'drs-armed': ['DrsWidget', 'armed'],
  'drs-ready': ['DrsWidget', 'ready'],
  'proximity-radar-left': ['ProximityRadarWidget', 'car-left'],
  'proximity-radar-both': ['ProximityRadarWidget', 'cars-both-sides'],
  'radar-bar-left': ['RadarBarWidget', 'car-left'],
  'radio-race-control': ['RadioWidget', 'race-control'],
  'sector-matrix-behind': ['SectorMatrixWidget', 'behind'],
  'sector-matrix-four': ['SectorMatrixWidget', 'four-sectors'],
  'pit-line-over-limit': ['PitLineWidget', 'over-pit-limit'],
  'pit-line-brake': ['PitLineWidget', 'brake-for-box'],
  'crew-radio-listening': ['CrewRadioWidget', 'listening'],
  'crew-radio-refused': ['CrewRadioWidget', 'refused'],
  'incident-tracker-penalty': ['IncidentTrackerWidget', 'penalty-warning'],
  'incident-tracker-clean': ['IncidentTrackerWidget', 'clean-race'],
  'stream-chat-twitch': ['StreamChatWidget', 'twitch-only'],
  'rpm-lights-circle': ['RpmLightsWidget', 'circle-leds'],
  'rpm-lights-parallelogram': ['RpmLightsWidget', 'parallelogram-leds'],
  'delta-no-gauge': ['DeltaWidget', 'no-gauge'],
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

// A bare frame - a widget on nothing - is taken as what it draws, with a
// hair of room: the frame is a box the user sized on the overlay, and the
// empty part of it is not the widget.
const BARE_ROOM_PX = 2;

const clipOfDrawn = ({ box }) => ({
  x: Math.floor(box.left - BARE_ROOM_PX),
  y: Math.floor(box.top - BARE_ROOM_PX),
  width: Math.ceil(box.right - box.left + BARE_ROOM_PX * 2),
  height: Math.ceil(box.bottom - box.top + BARE_ROOM_PX * 2),
});

// The frame and anything it hangs past its edge, up to OVERHANG_PX
const clipOf = (page, overhang = OVERHANG_PX) =>
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
    }, overhang);

// What the widget actually draws inside its frame: the union of its leaves -
// text, a picture, a chart, or a box that paints something - so a plate that
// merely fills the frame does not hide the room left around its content.
// Returns the room on each side (negative: drawn past the frame), the drawn
// box itself, and whether the frame is bare - no ground and no border of its
// own, the widget floating on nothing as it does on the overlay.
const roomOf = (page) =>
  page
    .locator(WIDGET_FRAME)
    .first()
    .evaluate((frame) => {
      const own = frame.getBoundingClientRect();
      const frameStyle = getComputedStyle(frame);
      const bare =
        frameStyle.backgroundColor === 'rgba(0, 0, 0, 0)' &&
        frameStyle.backgroundImage === 'none' &&
        (frameStyle.borderTopStyle === 'none' ||
          frameStyle.borderTopColor === 'rgba(0, 0, 0, 0)');
      const paints = (element) => {
        const style = getComputedStyle(element);

        return (
          style.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
          style.backgroundImage !== 'none' ||
          parseFloat(style.borderTopWidth) > 0 ||
          parseFloat(style.borderBottomWidth) > 0
        );
      };
      const isLeaf = (element) =>
        ['svg', 'canvas', 'img'].includes(element.localName) ||
        element.children.length === 0;
      const drawsSomething = (element) =>
        ['svg', 'canvas', 'img'].includes(element.localName) ||
        element.textContent.trim().length > 0 ||
        paints(element);

      const rects = [...frame.querySelectorAll('*')]
        .filter(
          (element) => !element.closest('svg') || element.localName === 'svg'
        )
        // On a bare frame a box that paints is part of the widget even with
        // children (Delta's gauge track under its fill); on a grounded one a
        // plate filling the frame would hide the room around the content
        .filter((element) => isLeaf(element) || (bare && paints(element)))
        .filter((element) => element.checkVisibility({ opacityProperty: true }))
        .filter(drawsSomething)
        .map((element) => element.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0);

      if (rects.length === 0) {
        return null;
      }

      const box = {
        left: Math.min(...rects.map((rect) => rect.left)),
        top: Math.min(...rects.map((rect) => rect.top)),
        right: Math.max(...rects.map((rect) => rect.right)),
        bottom: Math.max(...rects.map((rect) => rect.bottom)),
      };

      return {
        bare,
        box,
        frame: [Math.round(own.width), Math.round(own.height)],
        left: Math.round(box.left - own.left),
        top: Math.round(box.top - own.top),
        right: Math.round(own.right - box.right),
        bottom: Math.round(own.bottom - box.bottom),
      };
    });

const audit = async (page, fileName, story) => {
  const id = storyId(story);
  const {
    settle = SETTLE_MS,
    overhang = OVERHANG_PX,
    ground = true,
  } = story[2] ?? {};

  await page.goto(storyUrl(id));
  await page.locator(WIDGET_FRAME).first().waitFor({ state: 'visible' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(settle);

  const room = await roomOf(page);

  if (!room) {
    console.log(`? ${fileName}  draws nothing measurable`);

    return false;
  }

  const sides = ['left', 'top', 'right', 'bottom'];
  // A bare frame is taken as what it draws, so its room never reaches the
  // picture; past the frame, the picture keeps up to the overhang
  const spare =
    room.bare || !ground
      ? []
      : sides.filter((side) => room[side] > SPARE_ROOM_PX);
  const cut = sides.filter((side) => room[side] < -overhang);
  const ok = spare.length === 0 && cut.length === 0;
  const detail = sides.map((side) => `${side} ${room[side]}`).join(', ');

  console.log(
    `${ok ? ' ' : '!'} ${fileName.padEnd(28)} ${room.bare ? 'bare ' : 'frame'} ${room.frame.join('x').padEnd(9)} ${detail}${
      cut.length ? `  CUT ${cut.join('/')}` : ''
    }${spare.length ? `  ROOM ${spare.join('/')}` : ''}`
  );

  return ok;
};

const shoot = async (page, fileName, story) => {
  const id = storyId(story);
  const { settle = SETTLE_MS, ground = true, overhang } = story[2] ?? {};

  await page.goto(storyUrl(id));
  await page.locator(WIDGET_FRAME).first().waitFor({ state: 'visible' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(settle);

  // Measured before the ground is cleared: after it every frame looks bare
  const drawn = await roomOf(page);

  await clearGround(page, KEEP_BORDER, ground);

  const target = path.join(OUT_DIR, `${fileName}.png`);
  const clip =
    drawn && (drawn.bare || !ground)
      ? clipOfDrawn(drawn)
      : await clipOf(page, overhang);

  await page.screenshot({
    path: target,
    clip,
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

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE,
  });

  if (AUDIT) {
    let failing = 0;

    try {
      for (const name of wanted) {
        failing += (await audit(page, name, SHOTS[name])) ? 0 : 1;
      }
    } finally {
      await browser.close();
    }

    console.log(`
${failing} of ${wanted.length} frames need a look`);

    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });

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
