// Runs the app on a recorded tape for a fixed span and prints what it cost —
// the perf harness of docs/perf-baseline.md.
//
//   npm run perf -- --tape D:\tapes\session.tape.jsonl.gz --from 600 --build
//   npm run perf -- --tape <tape> --from 600 --runs 2
//   npm run perf -- --tape <tape> --from 600 --mode stores-only
//   npm run perf -- --report a.json --report b.json     print saved reports
//
// --build       build the measured binary first: a release build with the
//               `dev` feature (the tape source lives there) and a production
//               frontend, no installer
// --from <s>    start the tape this many seconds in (default 0)
// --seconds <s> measured span (default 60), after --warmup <s> (default 10)
// --mode        widgets (default) or stores-only: telemetry is applied, no
//               widget is mounted
// --runs <n>    run n times and print each, with the spread between them
// --out <dir>   where reports are written (default: the OS temp dir)
// --heap        also take a sampling heap profile of the overlay over CDP and
//               print where the bytes went. The profiler itself costs time, so
//               the other numbers of a --heap run are not baseline numbers.
//               Needs a binary from --build (it resolves frames through the
//               hidden source maps that build leaves in dist/assets)
//
// The app runs on your own settings: the layout measured is whichever layout
// is active, and each report names the widgets it had on every monitor. Close
// any running Marble Trace first.

import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';

import {
  printHeapSummary,
  summarizeHeapProfile,
  takeHeapProfile,
} from './perf-heap.mjs';

const ROOT = process.cwd();
const EXE = path.join(
  ROOT,
  'src-tauri',
  'target',
  'release',
  'marble-trace.exe'
);
const KIB = 1024;
const PERCENT = 100;
const RUN_TIMEOUT_MARGIN_MS = 180_000;
const MS_PER_SECOND = 1000;
const DEBUGGING_PORT = 9333;
const ASSETS_DIR = path.join(ROOT, 'dist', 'assets');

const parseArgs = (argv) => {
  const options = {
    reports: [],
    runs: 1,
    mode: 'widgets',
    from: '0',
    seconds: '60',
    warmup: '10',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];

    switch (flag) {
      case '--build':
        options.build = true;
        break;
      case '--heap':
        options.heap = true;
        break;
      case '--tape':
        options.tape = path.resolve(value);
        index += 1;
        break;
      case '--from':
      case '--seconds':
      case '--warmup':
      case '--mode':
      case '--out':
        options[flag.slice(2)] = value;
        index += 1;
        break;
      case '--runs':
        options.runs = Number(value);
        index += 1;
        break;
      case '--report':
        options.reports.push(path.resolve(value));
        index += 1;
        break;
      default:
        throw new Error(`unknown argument ${flag}`);
    }
  }

  return options;
};

const build = () => {
  const result = spawnSync(
    'npx',
    [
      'tauri',
      'build',
      '--features',
      'dev',
      '--no-bundle',
      '--config',
      'src-tauri/tauri.dev.conf.json',
    ],
    {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, MARBLE_TRACE_SOURCEMAPS: '1' },
    }
  );

  if (result.status !== 0) {
    throw new Error('build failed');
  }
};

const runOnce = (options, reportPath) =>
  new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      MARBLE_TRACE_REPLAY: options.tape,
      MARBLE_TRACE_REPLAY_FROM: options.from,
      MARBLE_TRACE_PERF: reportPath,
      MARBLE_TRACE_PERF_SECONDS: options.seconds,
      MARBLE_TRACE_PERF_WARMUP: options.warmup,
      MARBLE_TRACE_PERF_MODE: options.mode,
      MARBLE_TRACE_PERF_HEAP: options.heap ? '1' : '0',
      // Without it Chromium serves a cached, bucketed usedJSHeapSize and the
      // allocation rate reads as nothing.
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: [
        '--enable-precise-memory-info',
        options.heap ? `--remote-debugging-port=${DEBUGGING_PORT}` : '',
      ].join(' '),
    };
    const child = spawn(EXE, [], { env, stdio: 'ignore' });
    const limitMs =
      (Number(options.seconds) + Number(options.warmup)) * MS_PER_SECOND +
      RUN_TIMEOUT_MARGIN_MS;
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('the run did not finish in time'));
    }, limitMs);

    child.on('exit', (code) => {
      clearTimeout(timer);

      if (code === 0 && existsSync(reportPath)) {
        resolve(reportPath);
      } else {
        reject(new Error(`the app exited with ${code} and no report`));
      }
    });
  });

const fixed = (value, digits = 2) =>
  value === null || value === undefined ? '—' : Number(value).toFixed(digits);

// Every number the table prints, keyed by its row name, so several runs line
// up row by row.
const metricsOf = (report) => {
  const rows = new Map();
  const seconds = report.config.durationMs / MS_PER_SECOND;

  rows.set('tick p50 (µs)', report.tick.p50Us);
  rows.set('tick p99 (µs)', report.tick.p99Us);
  rows.set('tick max (µs)', report.tick.maxUs);

  for (const set of report.delivery) {
    const setSeconds = set.elapsedMs / MS_PER_SECOND || seconds;

    rows.set(`${set.label} bundles/s`, set.bundles / setSeconds);
    rows.set(
      `${set.label} KiB/s`,
      set.bytes === null ? null : set.bytes / KIB / setSeconds
    );
  }

  for (const overlay of report.overlays) {
    const name = overlay.label;
    const overlaySeconds = overlay.elapsedMs / MS_PER_SECOND;

    rows.set(
      `${name} alloc (MiB/s)`,
      overlay.allocBytesPerSec === null
        ? null
        : overlay.allocBytesPerSec / KIB / KIB
    );
    rows.set(
      `${name} long tasks ≥50 ms /min`,
      (overlay.longTasks / overlaySeconds) * 60
    );
    rows.set(
      `${name} frames over budget (%)`,
      overlay.frames === 0
        ? null
        : (overlay.framesOverBudget / overlay.frames) * PERCENT
    );
    rows.set(`${name} DOM mutations/s`, overlay.domMutationsPerSec);
    rows.set(`${name} observer wake-ups/s`, overlay.observerWakeupsPerSec);
    rows.set(`${name} apply p50 (ms)`, overlay.apply.p50Ms);
    rows.set(`${name} apply p99 (ms)`, overlay.apply.p99Ms);
    rows.set(`${name} apply max (ms)`, overlay.apply.maxMs);
    rows.set(`${name} apply 1 Hz full p50 (ms)`, overlay.applyFull.p50Ms);
    rows.set(`${name} apply 1 Hz full max (ms)`, overlay.applyFull.maxMs);
  }

  return rows;
};

const spreadOf = (values) => {
  const numbers = values.filter((value) => typeof value === 'number');

  if (numbers.length < 2) {
    return '';
  }

  const low = Math.min(...numbers);
  const high = Math.max(...numbers);

  return high === 0 ? '0 %' : `${fixed(((high - low) / high) * PERCENT, 1)} %`;
};

const printTable = (reports) => {
  const metricSets = reports.map(metricsOf);
  const names = [...new Set(metricSets.flatMap((rows) => [...rows.keys()]))];
  const header = ['metric', ...reports.map((_, index) => `run ${index + 1}`)];

  if (reports.length > 1) {
    header.push('spread');
  }

  console.log(`| ${header.join(' | ')} |`);
  console.log(`| ${header.map(() => '---').join(' | ')} |`);

  for (const name of names) {
    const values = metricSets.map((rows) => rows.get(name));
    const cells = [name, ...values.map((value) => fixed(value))];

    if (reports.length > 1) {
      cells.push(spreadOf(values));
    }

    console.log(`| ${cells.join(' | ')} |`);
  }

  const first = reports[0];
  console.log('');
  console.log(
    `tape ${first.tape ?? '—'} from ${first.replayFromSeconds ?? '0'} s, ` +
      `${first.config.durationMs / MS_PER_SECOND} s after ${first.config.warmupMs / MS_PER_SECOND} s warm-up, ` +
      `${first.config.storesOnly ? 'stores-only' : 'widgets'}`
  );

  for (const overlay of first.overlays) {
    console.log(
      `${overlay.label}: ${overlay.widgets.join(', ') || '(no widgets)'}`
    );
  }
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));

  if (options.reports.length > 0) {
    printTable(
      options.reports.map((file) => JSON.parse(readFileSync(file, 'utf8')))
    );

    return;
  }

  if (!options.tape) {
    throw new Error('--tape is required');
  }

  if (options.build) {
    build();
  }

  if (!existsSync(EXE)) {
    throw new Error(`${EXE} not found — run with --build`);
  }

  const outDir = path.resolve(
    options.out ?? path.join(os.tmpdir(), 'marble-trace-perf')
  );
  mkdirSync(outDir, { recursive: true });

  const reports = [];
  const stamp = Date.now();

  for (let run = 1; run <= options.runs; run += 1) {
    const reportPath = path.join(
      outDir,
      `perf-${stamp}-${options.mode}-${run}.json`
    );
    const profilePath = reportPath.replace(/\.json$/, '.heapprofile');
    console.error(`run ${run}/${options.runs} → ${reportPath}`);

    const profiled = options.heap
      ? takeHeapProfile(DEBUGGING_PORT, profilePath)
      : Promise.resolve(null);

    await Promise.all([runOnce(options, reportPath), profiled]);
    reports.push(JSON.parse(readFileSync(reportPath, 'utf8')));
  }

  printTable(reports);

  if (options.heap) {
    const lastProfile = path.join(
      outDir,
      `perf-${stamp}-${options.mode}-${options.runs}.heapprofile`
    );

    printHeapSummary(
      summarizeHeapProfile(lastProfile, ASSETS_DIR),
      Number(options.seconds)
    );
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
