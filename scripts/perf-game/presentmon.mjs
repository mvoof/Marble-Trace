// The game's side of a run: PresentMon captures every frame iRacing presents,
// and the summary turns a capture into the numbers docs/perf-methodology.md
// defines — average FPS, 1% and 0.1% lows, stutters, latency, present mode.

import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

import { processIdsOf } from './powershell.mjs';
import { sleep } from './app.mjs';

export const GAME_PROCESS = 'iRacingSim64DX11.exe';

const PRESENTMON_DIRS = [
  'C:\\Program Files\\Intel\\PresentMon\\PresentMonConsoleApplication',
];

const MS_PER_SECOND = 1000;
const POLL_MS = 3000;
/** How long past its timed span an elevated capture may take to finish. */
const CAPTURE_GRACE_SECONDS = 45;

/** The PresentMon console binary: `PRESENTMON`, or the Intel install. */
export const findPresentMon = () => {
  if (process.env.PRESENTMON) {
    return process.env.PRESENTMON;
  }

  for (const dir of PRESENTMON_DIRS) {
    if (!existsSync(dir)) {
      continue;
    }

    const binary = readdirSync(dir).find((name) =>
      /^PresentMon-.*-x64\.exe$/i.test(name)
    );

    if (binary) {
      return path.join(dir, binary);
    }
  }

  throw new Error(
    'PresentMon console not found — install PresentMon 2.x from Intel, or set PRESENTMON to its PresentMon-<version>-x64.exe'
  );
};

/**
 * Captures the game for `seconds` into `csvPath`. PresentMon needs ETW access:
 * administrator rights, or membership of "Performance Log Users". With
 * `elevate` it asks for UAC itself, and the elevated copy runs on its own, so
 * this waits for that copy to exit rather than for the one it started.
 */
export const capture = async ({ csvPath, seconds, elevate }) => {
  const args = [
    '--process_name',
    GAME_PROCESS,
    '--output_file',
    csvPath,
    '--timed',
    String(seconds),
    '--terminate_after_timed',
    '--no_console_stats',
    '--stop_existing_session',
    '--v2_metrics',
  ];
  const result = spawnSync(
    findPresentMon(),
    elevate ? ['--restart_as_admin', ...args] : args,
    {
      stdio: 'ignore',
    }
  );

  if (!elevate && result.status !== 0) {
    throw new Error(
      `PresentMon exited with ${result.status} — run with --elevate, or join "Performance Log Users"`
    );
  }

  const deadline =
    Date.now() + (seconds + CAPTURE_GRACE_SECONDS) * MS_PER_SECOND;

  do {
    await sleep(POLL_MS);
  } while (presentMonRunning() && Date.now() < deadline);

  if (!existsSync(csvPath)) {
    throw new Error(
      `no capture was written to ${csvPath} — was the UAC prompt declined?`
    );
  }
};

const presentMonRunning = () => processIdsOf('PresentMon-*').length > 0;

// --- Summary ----------------------------------------------------------------

/** A frame this many times its recent median is a stutter: a missed vblank. */
const STUTTER_FACTOR = 2;
const STUTTER_WINDOW = 20;
/** A frame this long is a hitch, counted apart from stutters. */
const HITCH_MS = 50;
/** A long frame takes more than this many times the capture's median frame. */
const LONG_FRAME_FACTOR = 2;
const P99 = 0.99;
const P999 = 0.999;
const MEDIAN = 0.5;
const SECONDS_PER_MINUTE = 60;
const PERCENT = 100;
const ONE_PERCENT = 0.01;

const percentile = (sorted, fraction) =>
  sorted[
    Math.min(
      sorted.length - 1,
      Math.max(0, Math.ceil(sorted.length * fraction) - 1)
    )
  ];

const mean = (values) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

const ascending = (left, right) => left - right;

const round = (value, digits = 1) => Number(value.toFixed(digits));

const countStutters = (frameTimes) => {
  let stutters = 0;

  for (let index = STUTTER_WINDOW; index < frameTimes.length; index += 1) {
    const recent = frameTimes
      .slice(index - STUTTER_WINDOW, index)
      .sort(ascending);

    if (
      frameTimes[index] >
      STUTTER_FACTOR * recent[Math.floor(recent.length / 2)]
    ) {
      stutters += 1;
    }
  }

  return stutters;
};

/** One capture summarized; the first `skipSeconds` are warm-up and dropped. */
export const summarizeCapture = (csvPath, skipSeconds) => {
  const lines = readFileSync(csvPath, 'utf8')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter(Boolean);
  const header = lines[0].split(',');
  const column = (name) => header.indexOf(name);
  const rows = lines
    .slice(1)
    .map((line) => line.split(','))
    .filter(
      (row) =>
        row[column('Application')]?.toLowerCase() === GAME_PROCESS.toLowerCase()
    );

  if (rows.length === 0) {
    return {
      capture: path.basename(csvPath),
      error: `no frames from ${GAME_PROCESS}`,
    };
  }

  const startMs = Number(rows[0][column('CPUStartTime')]);
  const kept = rows.filter(
    (row) =>
      Number(row[column('CPUStartTime')]) - startMs >=
      skipSeconds * MS_PER_SECOND
  );
  const numbers = (name) =>
    kept.map((row) => Number(row[column(name)])).filter(Number.isFinite);
  const frameTimes = numbers('FrameTime').filter((value) => value > 0);
  const sorted = [...frameTimes].sort(ascending);
  const seconds =
    frameTimes.reduce((sum, value) => sum + value, 0) / MS_PER_SECOND;
  const worstOnePercent = sorted.slice(
    Math.floor(sorted.length * (1 - ONE_PERCENT))
  );
  const latency = numbers('DisplayLatency')
    .filter((value) => value > 0)
    .sort(ascending);
  // Where a long frame went: when the game's CPU time grows with it and its GPU
  // time does not, the game was waiting rather than drawing more.
  const medianFrame = percentile(sorted, MEDIAN);
  const longRows = kept.filter(
    (row) => Number(row[column('FrameTime')]) > LONG_FRAME_FACTOR * medianFrame
  );
  const meanOver = (rowsOf, name) =>
    rowsOf.length > 0
      ? mean(rowsOf.map((row) => Number(row[column(name)]))).toFixed(1)
      : '—';
  const modes = {};

  for (const row of kept) {
    const mode = row[column('PresentMode')];
    modes[mode] = (modes[mode] ?? 0) + 1;
  }

  return {
    capture: path.basename(csvPath, '.csv'),
    seconds: round(seconds),
    'avg FPS': round(frameTimes.length / seconds),
    '1% low': round(MS_PER_SECOND / percentile(sorted, P99)),
    '1% low avg': round(MS_PER_SECOND / mean(worstOnePercent)),
    '0.1% low': round(MS_PER_SECOND / percentile(sorted, P999)),
    'frame p50/p99 ms': `${percentile(sorted, MEDIAN).toFixed(2)} / ${percentile(sorted, P99).toFixed(2)}`,
    'stutters/min': round(
      (countStutters(frameTimes) / seconds) * SECONDS_PER_MINUTE
    ),
    'hitches >50ms': frameTimes.filter((value) => value > HITCH_MS).length,
    'latency avg/p99 ms':
      latency.length > 0
        ? `${mean(latency).toFixed(1)} / ${percentile(latency, P99).toFixed(1)}`
        : '—',
    'GPU busy ms': round(mean(numbers('GPUBusy')), 2),
    'long frames %': round((longRows.length / kept.length) * PERCENT),
    'long CPU/GPU ms': `${meanOver(longRows, 'CPUBusy')} / ${meanOver(longRows, 'GPUBusy')}`,
    'present mode': Object.entries(modes)
      .sort((left, right) => right[1] - left[1])
      .map(
        ([mode, count]) =>
          `${mode} ${Math.round((count / kept.length) * PERCENT)}%`
      )
      .join('; '),
  };
};
