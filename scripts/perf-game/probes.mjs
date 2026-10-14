// The app's side of a run, without the game: what changes the overlay between
// bundles, what its heap and garbage collector do, and what every process of
// the app costs. The first two attach to the overlay over CDP, so the app has
// to be started with a debugging port.

import { runPowerShell } from './powershell.mjs';
import { sleep } from './app.mjs';

export const DEBUGGING_PORT = 9333;

const MS_PER_SECOND = 1000;
const MIB = 1024 * 1024;
const PERCENT = 100;
const TARGET_POLL_MS = 500;
const TARGET_ATTEMPTS = 60;

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

const connectToOverlay = async () => {
  for (let attempt = 0; attempt < TARGET_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(
        `http://127.0.0.1:${DEBUGGING_PORT}/json/list`
      );
      const targets = await response.json();
      const overlay = targets.find(
        (target) => target.type === 'page' && target.url.includes('/overlay')
      );

      if (overlay) {
        return connect(overlay.webSocketDebuggerUrl);
      }
    } catch {
      // The browser is not listening yet.
    }

    await sleep(TARGET_POLL_MS);
  }

  throw new Error(
    'no overlay page on the debugging port — is a widget switched on?'
  );
};

const evaluate = async (session, expression) => {
  const result = await session.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });

  return result.result.value;
};

// --- What changes the overlay ------------------------------------------------

const CHANGE_SAMPLE_MS = 50;
const TOP_ROWS = 15;

/**
 * Counts, for `seconds`, who requests animation frames and which CSS
 * animations and transitions are running. Requests are fine as long as they
 * are multiples of the bundle rate — the browser folds them into one frame per
 * bundle. A running animation is not: it changes the overlay on every display
 * frame (ADR-0009).
 */
export const probeChanges = async (seconds) => {
  const session = await connectToOverlay();
  const report = await evaluate(
    session,
    `new Promise((resolve) => {
      const original = window.requestAnimationFrame;
      const callers = new Map();
      window.requestAnimationFrame = (callback) => {
        const stack = (new Error().stack || '').split('\\n').slice(2, 4).map((line) => line.trim()).join(' <- ');
        callers.set(stack, (callers.get(stack) || 0) + 1);
        return original.call(window, callback);
      };
      const running = new Map();
      let samples = 0;
      const sampler = setInterval(() => {
        samples += 1;
        for (const animation of document.getAnimations()) {
          if (animation.playState !== 'running') continue;
          const target = animation.effect && animation.effect.target;
          const name = animation.animationName || animation.transitionProperty || animation.constructor.name;
          const owner = target && target.getAttribute ? String(target.getAttribute('class') || target.tagName).split(' ')[0] : '?';
          const key = name + ' on ' + owner;
          running.set(key, (running.get(key) || 0) + 1);
        }
      }, ${CHANGE_SAMPLE_MS});
      setTimeout(() => {
        window.requestAnimationFrame = original;
        clearInterval(sampler);
        resolve({
          callers: [...callers.entries()].sort((left, right) => right[1] - left[1]).slice(0, ${TOP_ROWS}),
          running: [...running.entries()].sort((left, right) => right[1] - left[1]).slice(0, ${TOP_ROWS}),
          samples,
        });
      }, ${seconds * MS_PER_SECOND});
    })`
  );
  session.close();

  console.log(
    'animation frames requested, per second, by caller (minified; resolve with dist/assets/*.map):'
  );
  console.table(
    report.callers.map(([caller, count]) => ({
      'per second': Number((count / seconds).toFixed(1)),
      caller,
    }))
  );
  console.log('running CSS animations and transitions, share of samples:');
  console.table(
    report.running.map(([animation, count]) => ({
      share: `${Math.round((count / report.samples) * PERCENT)}%`,
      animation,
    }))
  );

  if (report.running.length === 0) {
    console.log('none — the overlay changes only when a bundle arrives');
  }
};

// --- Heap and garbage collection ----------------------------------------------

const HEAP_SAMPLE_SECONDS = 10;
const GC_TRACE_SECONDS = 10;
const GC_SETTLE_MS = 2000;
const GC_EVENTS = new Set([
  'MinorGC',
  'MajorGC',
  'V8.GC_SCAVENGER',
  'V8.GC_MARK_COMPACTOR',
]);
const TOP_ALLOCATORS = 10;

const heapNow = async (session) => {
  const usage = await session.send('Runtime.getHeapUsage');
  const dom = await session.send('Memory.getDOMCounters');

  return {
    usedMiB: usage.usedSize / MIB,
    totalMiB: usage.totalSize / MIB,
    domNodes: dom.nodes,
  };
};

const traceFor = async (session, seconds, withDump) => {
  const events = [];
  let finished;
  const complete = new Promise((resolve) => {
    finished = resolve;
  });

  session.onEvent((event) => {
    if (event.method === 'Tracing.dataCollected') {
      events.push(...event.params.value);
    }

    if (event.method === 'Tracing.tracingComplete') {
      finished();
    }
  });

  await session.send('Tracing.start', {
    transferMode: 'ReportEvents',
    traceConfig: {
      includedCategories: [
        'devtools.timeline',
        'v8',
        'disabled-by-default-v8.gc',
        'disabled-by-default-memory-infra',
      ],
      memoryDumpConfig: { triggers: [] },
    },
  });
  await sleep(seconds * MS_PER_SECOND);

  if (withDump) {
    await session.send('Tracing.requestMemoryDump', {
      deterministic: false,
      levelOfDetail: 'detailed',
    });
  }

  await session.send('Tracing.end');
  await complete;

  return events;
};

const gcSummary = (events, seconds) => {
  const byName = {};

  for (const event of events) {
    if (event.ph !== 'X' || !event.dur || !GC_EVENTS.has(event.name)) {
      continue;
    }

    const slot = (byName[event.name] ??= { count: 0, totalMs: 0, maxMs: 0 });
    const durationMs = event.dur / MS_PER_SECOND;
    slot.count += 1;
    slot.totalMs += durationMs;
    slot.maxMs = Math.max(slot.maxMs, durationMs);
  }

  return Object.entries(byName).map(([name, slot]) => ({
    event: name,
    'per second': Number((slot.count / seconds).toFixed(2)),
    'ms per second': Number((slot.totalMs / seconds).toFixed(2)),
    'max ms': Number(slot.maxMs.toFixed(2)),
  }));
};

const sizeOf = (allocator) =>
  allocator?.attrs?.size?.value ? parseInt(allocator.attrs.size.value, 16) : 0;

/**
 * The overlay renderer's allocators from a memory-infra dump, in MiB: the dump
 * covers every process, and the overlay is the renderer with the largest V8
 * heap.
 */
const allocatorsOf = (events) => {
  const dumps = events.filter(
    (event) => event.ph === 'v' && event.args?.dumps?.allocators
  );
  const largest = dumps
    .map((event) => event.args.dumps.allocators)
    .sort((left, right) => sizeOf(right.v8) - sizeOf(left.v8))[0];

  if (!largest) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(largest)
      .filter(
        ([name, allocator]) =>
          !name.includes('/') && allocator.attrs?.size?.value
      )
      .map(([name, allocator]) => [
        name,
        Number((parseInt(allocator.attrs.size.value, 16) / MIB).toFixed(1)),
      ])
      .sort((left, right) => right[1] - left[1])
      .slice(0, TOP_ALLOCATORS)
  );
};

/**
 * Watches the heap for `seconds`, traces the collector, then forces a full
 * collection: what falls away was garbage the collector had not reached yet,
 * what stays is what the overlay actually holds.
 */
export const probeHeap = async (seconds) => {
  const session = await connectToOverlay();
  const series = [];

  for (let elapsed = 0; elapsed <= seconds; elapsed += HEAP_SAMPLE_SECONDS) {
    series.push({ second: elapsed, ...(await heapNow(session)) });
    await sleep(HEAP_SAMPLE_SECONDS * MS_PER_SECOND);
  }

  const traced = await traceFor(session, GC_TRACE_SECONDS, true);
  const before = await heapNow(session);
  await session.send('HeapProfiler.enable');
  await session.send('HeapProfiler.collectGarbage');
  await sleep(GC_SETTLE_MS);
  await session.send('HeapProfiler.collectGarbage');
  const after = await heapNow(session);
  const afterTrace = await traceFor(session, 1, true);
  session.close();

  const rounded = (row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, Number(value.toFixed(1))])
    );

  console.log('JS heap over time:');
  console.table(series.map(rounded));
  console.log(`garbage collection over ${GC_TRACE_SECONDS} s:`);
  console.table(gcSummary(traced, GC_TRACE_SECONDS));
  console.log('before and after a forced full collection:');
  console.table({ before: rounded(before), after: rounded(after) });
  console.log('overlay renderer allocators, MiB, before → after:');
  const allocatorsBefore = allocatorsOf(traced);
  const allocatorsAfter = allocatorsOf(afterTrace);
  console.table(
    Object.keys(allocatorsBefore).map((name) => ({
      allocator: name,
      before: allocatorsBefore[name],
      after: allocatorsAfter[name] ?? '—',
    }))
  );
};

// --- Processes ----------------------------------------------------------------

/**
 * CPU, private memory and GPU 3D engine time of every process of the app —
 * the Rust process and each WebView2 process by role — and of DWM, which
 * composes the overlay. Perf counters only: no tracing, which would load the
 * very processes it measures.
 */
export const probeProcesses = (seconds) => {
  const json = runPowerShell(`
$app = Get-Process -Name marble-trace -ErrorAction Stop | Select-Object -First 1
$all = Get-CimInstance Win32_Process
$roles = @{ ([int]$app.Id) = 'app (rust)' }
$queue = New-Object System.Collections.Queue
$queue.Enqueue([int]$app.Id)
while ($queue.Count -gt 0) {
  $parent = $queue.Dequeue()
  foreach ($child in ($all | Where-Object ParentProcessId -eq $parent)) {
    $line = [string]$child.CommandLine
    $role = 'webview browser'
    if ($line -match '--type=gpu-process') { $role = 'webview gpu' }
    elseif ($line -match '--type=renderer') { $role = 'webview renderer' }
    elseif ($line -match '--utility-sub-type=([\\w\\.]+)') { $role = 'webview ' + ($Matches[1] -replace '\\.mojom.*', '') }
    elseif ($line -match '--type=crashpad') { $role = 'webview crashpad' }
    $roles[[int]$child.ProcessId] = $role
    $queue.Enqueue([int]$child.ProcessId)
  }
}
$roles[[int](Get-Process dwm).Id] = 'dwm'
$cpuBefore = @{}
foreach ($id in $roles.Keys) { $cpuBefore[$id] = (Get-Process -Id $id -ErrorAction SilentlyContinue).TotalProcessorTime.TotalMilliseconds }
$started = Get-Date
$gpu = Get-Counter '\\GPU Engine(*engtype_3D)\\Utilization Percentage' -SampleInterval 1 -MaxSamples ${seconds}
$elapsedMs = ((Get-Date) - $started).TotalMilliseconds
$rows = foreach ($id in $roles.Keys) {
  $process = Get-Process -Id $id -ErrorAction SilentlyContinue
  if (-not $process) { continue }
  $gpuShare = ($gpu | ForEach-Object { ($_.CounterSamples | Where-Object Path -match "pid_$($id)_" | Measure-Object CookedValue -Sum).Sum } | Measure-Object -Average).Average
  [pscustomobject]@{
    role = $roles[$id]
    pid = $id
    cpuPercentOfCore = [math]::Round((($process.TotalProcessorTime.TotalMilliseconds - $cpuBefore[$id]) / $elapsedMs) * 100, 1)
    privateMiB = [math]::Round($process.PrivateMemorySize64 / 1MB, 1)
    gpu3dPercent = [math]::Round([double]$gpuShare, 2)
  }
}
$rows | ConvertTo-Json -Compress`);
  const rows = JSON.parse(json);
  const list = Array.isArray(rows) ? rows : [rows];
  const appRows = list.filter((row) => row.role !== 'dwm');
  const total = (key) =>
    Number(appRows.reduce((sum, row) => sum + row[key], 0).toFixed(1));

  console.table(
    list.sort((left, right) => left.role.localeCompare(right.role))
  );
  console.log(
    `app total: ${total('cpuPercentOfCore')} % of one core, ${total('privateMiB')} MiB private, ${total('gpu3dPercent')} % GPU 3D` +
      ' (DWM CPU reads 0 without administrator rights)'
  );
};
