// The heap half of the perf harness: takes a sampling heap profile of an
// overlay over CDP for exactly the measured span, and says where the bytes
// went. Used by scripts/perf-run.mjs --heap.
//
// The profile includes objects the GC has already collected — the overlay's
// cost is churn, not what stays live — and the frames are resolved through the
// hidden source maps of a `--build` binary, so buckets name source files.

import path from 'node:path';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

const BEGIN_MARKER = '[perf-run] begin';
const END_MARKER = '[perf-run] end';
const PROFILE_TAKEN_FLAG = '__marbleTracePerfProfileTaken';
const SAMPLING_INTERVAL_BYTES = 16 * 1024;
const TARGET_POLL_MS = 500;
const TARGET_WAIT_LIMIT_MS = 120_000;
const PERCENT = 100;
const KIB = 1024;
const TOP_SOURCES = 15;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const findOverlayTarget = async (port) => {
  const deadline = Date.now() + TARGET_WAIT_LIMIT_MS;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      const overlay = targets.find(
        (target) => target.type === 'page' && target.url.includes('/overlay')
      );

      if (overlay) {
        return overlay;
      }
    } catch {
      // The browser is not listening yet.
    }

    await sleep(TARGET_POLL_MS);
  }

  throw new Error('no overlay page appeared on the debugging port');
};

const connect = (url) =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const pending = new Map();
    const listeners = [];
    let nextId = 1;

    const send = (method, params = {}) =>
      new Promise((resolveCall, rejectCall) => {
        const id = nextId;
        nextId += 1;
        pending.set(id, { resolveCall, rejectCall });
        socket.send(JSON.stringify({ id, method, params }));
      });

    socket.addEventListener('message', (message) => {
      const data = JSON.parse(message.data);

      if (data.id && pending.has(data.id)) {
        const call = pending.get(data.id);
        pending.delete(data.id);

        if (data.error) {
          call.rejectCall(new Error(data.error.message));
        } else {
          call.resolveCall(data.result);
        }

        return;
      }

      for (const listener of listeners) {
        listener(data);
      }
    });

    socket.addEventListener('open', () =>
      resolve({
        send,
        onEvent: (listener) => listeners.push(listener),
        close: () => socket.close(),
      })
    );
    socket.addEventListener('error', () =>
      reject(new Error(`cannot connect to ${url}`))
    );
  });

const consoleText = (event) =>
  event.method === 'Runtime.consoleAPICalled'
    ? event.params.args.map((arg) => arg.value ?? '').join(' ')
    : null;

/**
 * Attaches to the overlay as soon as it exists and resolves with the profile
 * taken between the overlay's begin and end markers.
 */
export const takeHeapProfile = async (port, profilePath) => {
  const target = await findOverlayTarget(port);
  const session = await connect(target.webSocketDebuggerUrl);

  const profile = new Promise((resolve, reject) => {
    session.onEvent(async (event) => {
      const text = consoleText(event);

      try {
        if (text === BEGIN_MARKER) {
          await session.send('HeapProfiler.startSampling', {
            samplingInterval: SAMPLING_INTERVAL_BYTES,
            includeObjectsCollectedByMajorGC: true,
            includeObjectsCollectedByMinorGC: true,
          });
        }

        if (text === END_MARKER) {
          const result = await session.send('HeapProfiler.stopSampling');
          writeFileSync(profilePath, JSON.stringify(result.profile));
          await session.send('Runtime.evaluate', {
            expression: `window.${PROFILE_TAKEN_FLAG} = true`,
          });
          session.close();
          resolve(profilePath);
        }
      } catch (error) {
        reject(error);
      }
    });
  });

  await session.send('Runtime.enable');
  await session.send('HeapProfiler.enable');

  return profile;
};

// --- Source maps -----------------------------------------------------------

const BASE64 =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const VLQ_SHIFT = 5;
const VLQ_CONTINUATION = 32;
const VLQ_MASK = 31;

const decodeVlq = (segment) => {
  const values = [];
  let value = 0;
  let shift = 0;

  for (const char of segment) {
    const digit = BASE64.indexOf(char);
    value += (digit & VLQ_MASK) << shift;

    if (digit & VLQ_CONTINUATION) {
      shift += VLQ_SHIFT;
    } else {
      values.push(value & 1 ? -(value >> 1) : value >> 1);
      value = 0;
      shift = 0;
    }
  }

  return values;
};

/** Per generated line, the segments sorted by column: [column, sourceIndex]. */
const parseMap = (map) => {
  const lines = [];
  let sourceIndex = 0;

  for (const lineText of map.mappings.split(';')) {
    const segments = [];
    let column = 0;

    for (const segment of lineText.split(',')) {
      if (!segment) {
        continue;
      }

      const fields = decodeVlq(segment);
      column += fields[0];

      if (fields.length > 1) {
        sourceIndex += fields[1];
        segments.push([column, sourceIndex]);
      }
    }

    lines.push(segments);
  }

  return { lines, sources: map.sources };
};

const loadMaps = (assetsDir) => {
  const maps = new Map();

  if (!existsSync(assetsDir)) {
    return maps;
  }

  for (const file of readdirSync(assetsDir)) {
    if (file.endsWith('.js.map')) {
      const map = JSON.parse(readFileSync(path.join(assetsDir, file), 'utf8'));
      maps.set(file.replace(/\.map$/, ''), parseMap(map));
    }
  }

  return maps;
};

const normalizeSource = (source) =>
  source
    .replace(/^(\.\.\/)+/, '')
    .replace(
      /^.*node_modules\/(\.pnpm\/[^/]+\/node_modules\/)?/,
      'node_modules/'
    );

const resolveFrame = (maps, frame) => {
  if (!frame.url) {
    return '(eval: event payload / injected script)';
  }

  const file = frame.url.split('/').pop().split('?')[0];
  const map = maps.get(file);

  if (!map) {
    return frame.url.startsWith('http') ? file : frame.url;
  }

  const segments = map.lines[frame.lineNumber] ?? [];
  let found = null;

  for (const [column, sourceIndex] of segments) {
    if (column > frame.columnNumber) {
      break;
    }

    found = sourceIndex;
  }

  return found === null ? file : normalizeSource(map.sources[found]);
};

// --- Attribution ------------------------------------------------------------

/** First rule a stack matches names its bucket; checked leaf to root. */
const BUCKETS = [
  [
    'apply bundle → stores (incl. reactions)',
    (source) => source.endsWith('store/sim/apply-bundle.ts'),
  ],
  ['Tauri event dispatch', (source) => source.includes('@tauri-apps/api')],
  ['React render / commit', (source) => source.includes('react-dom')],
];

const EVAL_BUCKET = 'event payload literal (the "parse")';
const OTHER_BUCKET = 'other';

export const summarizeHeapProfile = (profilePath, assetsDir) => {
  const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
  const maps = loadMaps(assetsDir);
  const bySource = new Map();
  const byBucket = new Map();
  let total = 0;

  const add = (table, key, bytes) =>
    table.set(key, (table.get(key) ?? 0) + bytes);

  const walk = (node, stack) => {
    const source = resolveFrame(maps, node.callFrame);
    const here = [...stack, { source, name: node.callFrame.functionName }];
    const bytes = node.selfSize;

    if (bytes > 0) {
      total += bytes;
      add(bySource, source, bytes);

      const inside = [...here].reverse().map((frame) => frame.source);
      const bucket =
        BUCKETS.find(([, matches]) => inside.some(matches))?.[0] ??
        (inside.every((frame) => frame.startsWith('('))
          ? EVAL_BUCKET
          : OTHER_BUCKET);

      add(byBucket, bucket, bytes);
    }

    for (const child of node.children ?? []) {
      walk(child, here);
    }
  };

  walk(profile.head, []);

  return { total, byBucket, bySource };
};

export const printHeapSummary = ({ total, byBucket, bySource }, seconds) => {
  const share = (bytes) => `${((bytes / total) * PERCENT).toFixed(1)} %`;
  const rate = (bytes) => `${(bytes / KIB / KIB / seconds).toFixed(2)}`;

  console.log('');
  console.log(`| heap bucket | MiB/s | share |`);
  console.log(`| --- | --- | --- |`);

  for (const [bucket, bytes] of [...byBucket].sort(
    (left, right) => right[1] - left[1]
  )) {
    console.log(`| ${bucket} | ${rate(bytes)} | ${share(bytes)} |`);
  }

  console.log(`| **total sampled** | ${rate(total)} | 100 % |`);
  console.log('');
  console.log(`| allocating source (self) | MiB/s | share |`);
  console.log(`| --- | --- | --- |`);

  for (const [source, bytes] of [...bySource]
    .sort((left, right) => right[1] - left[1])
    .slice(0, TOP_SOURCES)) {
    console.log(`| ${source} | ${rate(bytes)} | ${share(bytes)} |`);
  }
};
