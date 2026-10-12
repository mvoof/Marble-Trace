import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// A running CSS transition redraws the overlay on every display frame, and
// every redraw makes DWM compose a frame on the GPU the game is drawing on.
// A transition on a value that changes with each bundle never stops running,
// so the overlay changes at the monitor's rate whatever the publication rate
// is — measured, it cost iRacing about half its 1% low (ADR-0009). Values that
// move with telemetry are set on the overlay's own clock, without one.
//
// What remains is a transition on a change of state — a light switching on, a
// panel opening — which runs once and stops. Each is listed here with why it
// does not follow the telemetry; a new one is a decision, not a default.
const STATE_CHANGE_TRANSITIONS: Record<string, string> = {
  'close-battle/BattleAxis.module.scss':
    'the axis rescales when the battle range changes, not every frame',
  'delta/DeltaLive/DeltaLive.module.scss':
    'the plate resizes when the number gains or loses a digit',
  'delta/DeltaPlate/DeltaPlate.module.scss':
    'moves with DeltaLive on the same digit-count change',
  'drs/DrsWidget.module.scss': 'DRS available / open is a state',
  'engine-panel/EnginePanelWidget.module.scss':
    'warning lights switch on and off',
  'pit-service/TireGrid/TireCorner/TireCorner.module.scss':
    'tire wear is read in the pit box, not while driving',
  'race-dash/PitBlock/PitBlock.module.scss': 'the pit limiter engaging',
  'race-dash/PitBlock/PitLaneBar.module.scss': 'entering and leaving the lane',
  'standings/ClassSwitcher/ClassSwitcher.module.scss': 'pointer hover',
  'track-map/TrackMapView/RotationControls/RotationControls.module.scss':
    'pointer hover on the rotation controls',
};

const WIDGETS_DIR = dirname(fileURLToPath(import.meta.url));

// The shared components the widgets are built from render on the overlay too.
const SHARED_UI_DIR = join(WIDGETS_DIR, '..', 'shared', 'ui');

// Keyed by the path below `directory`, with forward slashes.
const stylesheetsUnder = (directory: string): Record<string, string> =>
  Object.fromEntries(
    readdirSync(directory, { recursive: true, encoding: 'utf8' })
      .filter((file) => file.endsWith('.module.scss'))
      .map((file) => [
        file.split(sep).join('/'),
        readFileSync(join(directory, file), 'utf8'),
      ])
  );

const STYLESHEETS = stylesheetsUnder(WIDGETS_DIR);

const OVERLAY_STYLESHEETS: Record<string, string> = {
  ...STYLESHEETS,
  ...Object.fromEntries(
    Object.entries(stylesheetsUnder(SHARED_UI_DIR)).map(([file, source]) => [
      `shared/ui/${file}`,
      source,
    ])
  ),
};

const TRANSITION_DECLARATION =
  /(?:^|[;{\s])transition(?:-property)?\s*:\s*([^;]+);/g;

const ANIMATION_DECLARATION =
  /(?:^|[;{\s])animation(?:-iteration-count)?\s*:\s*([^;]+);/g;

const INFINITE = /\binfinite\b/;

const SCSS_COMMENT = /\/\*[\s\S]*?\*\/|\/\/.*$/gm;

const runningTransitionsIn = (source: string): string[] =>
  [...source.replace(SCSS_COMMENT, '').matchAll(TRANSITION_DECLARATION)]
    .map((match) => match[1].trim())
    .filter((value) => value !== 'none');

const endlessAnimationsIn = (source: string): string[] =>
  [...source.replace(SCSS_COMMENT, '').matchAll(ANIMATION_DECLARATION)]
    .map((match) => match[1].trim())
    .filter((value) => INFINITE.test(value));

describe('widget transitions', () => {
  it('declares no transition on a value that moves with telemetry', () => {
    for (const [file, source] of Object.entries(STYLESHEETS)) {
      if (file in STATE_CHANGE_TRANSITIONS) {
        continue;
      }

      expect(
        runningTransitionsIn(source),
        `${file}: a transition keeps the overlay redrawing on every display frame (ADR-0009); set the value without one, or list it in STATE_CHANGE_TRANSITIONS with the state it follows`
      ).toEqual([]);
    }
  });

  it('lists only stylesheets that still declare a transition', () => {
    for (const file of Object.keys(STATE_CHANGE_TRANSITIONS)) {
      const source = STYLESHEETS[file];

      expect(source, `${file} is listed but does not exist`).toBeDefined();
      expect(
        runningTransitionsIn(source ?? ''),
        `${file} is listed but declares no transition`
      ).not.toEqual([]);
    }
  });
});

describe('overlay animations', () => {
  // An endless animation is the same cost as a transition that never stops:
  // even a `steps()` one has the browser build a frame on every display refresh
  // for as long as it runs. A blink goes through `useBlink`
  // (`shared/hooks/useBlink.ts`), which writes the DOM only when its step
  // changes; a one-shot animation on a change of state is fine.
  it('declares no animation that runs forever', () => {
    for (const [file, source] of Object.entries(OVERLAY_STYLESHEETS)) {
      expect(
        endlessAnimationsIn(source),
        `${file}: an infinite animation keeps the overlay redrawing on every display frame (ADR-0009); blink through useBlink instead`
      ).toEqual([]);
    }
  });
});
