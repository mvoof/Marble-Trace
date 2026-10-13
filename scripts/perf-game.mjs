// The in-game half of the perf method (docs/perf-methodology.md): what the
// overlay costs the game's frames, measured with PresentMon on an iRacing
// replay, and the app-side probes that explain it. `npm run perf` measures
// what the app costs itself on a tape; this measures what it costs the game.
//
//   npm run perf:game -- mark                                  remember where the replay stands
//   npm run perf:game -- run --name s0 --no-app --rewind       game alone, from that point
//   npm run perf:game -- run --name all-30 --layout perf-all --rate 30
//   npm run perf:game -- run --name one --widgets lap-log      only these on
//   npm run perf:game -- report <capture.csv>...               summarize again
//   npm run perf:game -- changes [--tape <tape> --from <s>]    what redraws the overlay
//   npm run perf:game -- heap [--seconds 120] [--tape …]       heap, GC, garbage vs held
//   npm run perf:game -- processes [--seconds 30]              CPU / memory / GPU per process
//
// mark        saves the frame the iRacing replay stands on (<out>/replay-point.json)
//             as the point every --rewind run starts from.
// run         one capture. The replay must cover the same stretch every time:
//             --rewind puts it back on the marked frame and plays it, or start
//             it there by hand. The app is restarted on the given layout, its settings
//             window minimized, the screen saved beside the capture, the game
//             captured for --seconds (default 105, the first --skip 15 dropped),
//             the app closed and the settings file put back byte for byte.
// --layout    layout to make active, by name; layout auto-switch is turned off
//             for the run so the replay's session cannot switch it back
// --widgets   instance ids to keep on (comma-separated); the rest switched off
// --rate      overlay update rate in Hz: 60, 30, 20 or 15
// --no-app    capture the game alone, after the same lead time as an app run
// --rewind    rewind the replay to the point `mark` saved and play it first
// --elevate   let PresentMon ask for administrator rights (UAC) itself; not
//             needed when the account is in "Performance Log Users"
// --tape/--from  for changes and heap: run the app on a tape instead of the sim
// --out <dir> where captures go (default: <temp>/marble-trace-perf/game)
//
// Close Marble Trace before a run or a probe: both start their own instance.

import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { mkdirSync } from 'node:fs';

import {
  APP_EXE,
  assertAppNotRunning,
  launchApp,
  sleep,
  withRunSettings,
} from './perf-game/app.mjs';
import {
  GAME_PROCESS,
  capture,
  summarizeCapture,
} from './perf-game/presentmon.mjs';
import {
  DEBUGGING_PORT,
  probeChanges,
  probeHeap,
  probeProcesses,
} from './perf-game/probes.mjs';
import {
  ownsForegroundWindow,
  saveScreenshot,
} from './perf-game/powershell.mjs';
import { markReplayPoint, rewindReplay } from './perf-game/replay.mjs';

const MS_PER_SECOND = 1000;
const DEFAULT_CAPTURE_SECONDS = 105;
const DEFAULT_SKIP_SECONDS = 15;
const DEFAULT_CHANGES_SECONDS = 5;
const DEFAULT_HEAP_SECONDS = 120;
const DEFAULT_PROCESS_SECONDS = 30;
/** What an app run spends starting and settling, so a game-only capture covers the same stretch. */
const APP_LEAD_SECONDS = 20;
const OVERLAY_RATES_HZ = [60, 30, 20, 15];

const FLAGS = new Set(['no-app', 'elevate', 'rewind']);

const parseArgs = (argv) => {
  const [command, ...rest] = argv;
  const options = { command, files: [] };

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];

    if (!token.startsWith('--')) {
      options.files.push(path.resolve(token));
      continue;
    }

    const name = token.slice(2);

    if (FLAGS.has(name)) {
      options[name] = true;
      continue;
    }

    options[name] = rest[index + 1];
    index += 1;
  }

  return options;
};

const numberOption = (value, fallback) =>
  value === undefined ? fallback : Number(value);

const outDirOf = (options) => {
  const dir = path.resolve(
    options.out ?? path.join(os.tmpdir(), 'marble-trace-perf', 'game')
  );
  mkdirSync(dir, { recursive: true });

  return dir;
};

const runChange = (options) => {
  const rateHz = options.rate === undefined ? undefined : Number(options.rate);

  if (rateHz !== undefined && !OVERLAY_RATES_HZ.includes(rateHz)) {
    throw new Error(`--rate must be one of ${OVERLAY_RATES_HZ.join(', ')}`);
  }

  return {
    layout: options.layout,
    widgets: options.widgets?.split(',').filter(Boolean),
    rateHz,
  };
};

const tapeEnv = (options) =>
  options.tape
    ? {
        MARBLE_TRACE_REPLAY: options.tape,
        MARBLE_TRACE_REPLAY_FROM: options.from ?? '0',
      }
    : {};

const run = async (options) => {
  if (!options.name) {
    throw new Error('run needs --name: the capture is saved as <name>.csv');
  }

  const outDir = outDirOf(options);
  const csvPath = path.join(outDir, `${options.name}.csv`);
  const seconds = numberOption(options.seconds, DEFAULT_CAPTURE_SECONDS);
  const skip = numberOption(options.skip, DEFAULT_SKIP_SECONDS);

  if (options.rewind) {
    console.error(
      `replay: back to frame ${await rewindReplay(outDir)}, playing`
    );
  }

  const captureGame = async () => {
    saveScreenshot(path.join(outDir, `${options.name}.png`));

    if (!ownsForegroundWindow(GAME_PROCESS.replace(/\.exe$/i, ''))) {
      console.error(
        'warning: the game is not the foreground window — anything drawn over it is measured too; check the screenshot'
      );
    }

    await capture({ csvPath, seconds, elevate: Boolean(options.elevate) });
  };

  if (options['no-app']) {
    await sleep(APP_LEAD_SECONDS * MS_PER_SECOND);
    await captureGame();
  } else {
    assertAppNotRunning();
    await withRunSettings(outDir, runChange(options), async (applied) => {
      console.error(
        `${applied.layout}: ${applied.enabled.length} widgets on — ${applied.enabled.join(' ')}`
      );
      const stop = await launchApp();

      try {
        await captureGame();
      } finally {
        await stop();
      }
    });
  }

  console.error(`capture: ${csvPath}`);
  console.table([summarizeCapture(csvPath, skip)]);
};

const report = (options) => {
  if (options.files.length === 0) {
    throw new Error('report needs one or more PresentMon CSV files');
  }

  const skip = numberOption(options.skip, DEFAULT_SKIP_SECONDS);
  console.table(options.files.map((file) => summarizeCapture(file, skip)));
};

/** Starts the app with a debugging port, runs `probe`, closes it, restores the settings. */
const withProbedApp = async (options, probe) => {
  assertAppNotRunning();
  await withRunSettings(outDirOf(options), runChange(options), async () => {
    const stop = await launchApp({
      ...tapeEnv(options),
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${DEBUGGING_PORT}`,
    });

    try {
      await probe();
    } finally {
      await stop();
    }
  });
};

const COMMANDS = {
  run,
  mark: (options) =>
    console.error(`replay point: frame ${markReplayPoint(outDirOf(options))}`),
  report,
  changes: (options) =>
    withProbedApp(options, () =>
      probeChanges(numberOption(options.seconds, DEFAULT_CHANGES_SECONDS))
    ),
  heap: (options) =>
    withProbedApp(options, () =>
      probeHeap(numberOption(options.seconds, DEFAULT_HEAP_SECONDS))
    ),
  processes: (options) =>
    probeProcesses(numberOption(options.seconds, DEFAULT_PROCESS_SECONDS)),
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const command = COMMANDS[options.command];

  if (!command) {
    throw new Error(
      `usage: npm run perf:game -- <${Object.keys(COMMANDS).join('|')}> [options]; see the header of scripts/perf-game.mjs (${APP_EXE})`
    );
  }

  await command(options);
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
