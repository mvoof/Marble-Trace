import { spy } from 'mobx';

import type {
  OverlayPerfReport,
  TimingSummary,
} from '@shared/contracts/bindings';
import { PERF_BEGIN, PERF_END } from '@shared/contracts/backend-events';
import { listenTo } from '@shared/api/events.service';
import {
  currentWindowLabel,
  getPerfRun,
  submitOverlayPerf,
} from '@shared/api/perf.service';
import type { RendererCore } from '@store/roots/renderer-core';
import { coldStartSample } from './perf-cold-start';

/**
 * The overlay's half of a perf run (see `telemetry/perf_run.rs`).
 *
 * The backend keeps the clock; this window starts collecting on `perf://begin`
 * and answers `perf://end` with what it saw. Nothing here runs unless the app
 * was started for a run.
 */

const HEAP_SAMPLE_INTERVAL_MS = 50;
const MS_PER_SECOND = 1000;
const REFERENCE_REFRESH_HZ = 60;
/** A frame this much longer than a 60 Hz one means one was dropped. */
const OVER_BUDGET_FACTOR = 1.5;
const FRAME_BUDGET_MS =
  (MS_PER_SECOND / REFERENCE_REFRESH_HZ) * OVER_BUDGET_FACTOR;
const MEDIAN = 0.5;
const P99 = 0.99;

/**
 * The markers `scripts/perf-run.mjs` watches for over CDP to start and stop a
 * sampling heap profile on exactly the measured span.
 */
const BEGIN_MARKER = '[perf-run] begin';
const END_MARKER = '[perf-run] end';
/** Set by the script, over CDP, once it holds the heap profile. */
const PROFILE_TAKEN_FLAG = '__marbleTracePerfProfileTaken';
const PROFILE_POLL_MS = 100;
const PROFILE_WAIT_LIMIT_MS = 30_000;

type FlaggedWindow = Window & { [PROFILE_TAKEN_FLAG]?: boolean };

/**
 * Holds the report until the profiler is done: the report is what ends the
 * run, and the app exits right after it.
 */
const waitForProfile = async (): Promise<void> => {
  const flagged = window as FlaggedWindow;
  const deadline = performance.now() + PROFILE_WAIT_LIMIT_MS;

  while (!flagged[PROFILE_TAKEN_FLAG] && performance.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, PROFILE_POLL_MS));
  }
};

interface ChromiumMemory {
  usedJSHeapSize: number;
}

const readHeap = (): number | null => {
  const memory = (performance as Performance & { memory?: ChromiumMemory })
    .memory;

  return memory ? memory.usedJSHeapSize : null;
};

const summarize = (samples: number[]): TimingSummary => {
  const sorted = [...samples].sort((left, right) => left - right);

  const rank = (fraction: number): number => {
    if (sorted.length === 0) {
      return 0;
    }

    const index = Math.min(
      sorted.length - 1,
      Math.max(0, Math.ceil(sorted.length * fraction) - 1)
    );

    return sorted[index];
  };

  return {
    count: sorted.length,
    p50Ms: rank(MEDIAN),
    p99Ms: rank(P99),
    maxMs: sorted.length === 0 ? 0 : sorted[sorted.length - 1],
  };
};

type FinishCollecting = () => OverlayPerfReport;

const startCollecting = (
  root: RendererCore,
  storesOnly: boolean
): FinishCollecting => {
  const startedAt = performance.now();
  const applyTimes: number[] = [];
  const fullApplyTimes: number[] = [];
  let allocatedBytes = 0;
  let heapMoved = false;
  let lastHeap = readHeap();
  let longTasks = 0;
  let longTaskMs = 0;
  let frames = 0;
  let framesOverBudget = 0;
  let lastFrameAt: number | null = null;
  let frameRequest = 0;
  let mutations = 0;
  let wakeups = 0;

  root.sim.setBundleApplyProbe((durationMs, isFull) => {
    if (isFull) {
      fullApplyTimes.push(durationMs);
    } else {
      applyTimes.push(durationMs);
    }
  });

  const heapTimer = window.setInterval(() => {
    const heap = readHeap();

    if (heap === null || lastHeap === null) {
      return;
    }

    if (heap !== lastHeap) {
      heapMoved = true;
    }

    if (heap > lastHeap) {
      allocatedBytes += heap - lastHeap;
    }

    lastHeap = heap;
  }, HEAP_SAMPLE_INTERVAL_MS);

  const longTaskObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      longTasks += 1;
      longTaskMs += entry.duration;
    }
  });

  longTaskObserver.observe({ type: 'longtask', buffered: false });

  const onFrame = (now: number) => {
    if (lastFrameAt !== null) {
      frames += 1;

      if (now - lastFrameAt > FRAME_BUDGET_MS) {
        framesOverBudget += 1;
      }
    }

    lastFrameAt = now;
    frameRequest = requestAnimationFrame(onFrame);
  };

  frameRequest = requestAnimationFrame(onFrame);

  const mutationObserver = new MutationObserver((records) => {
    mutations += records.length;
  });

  mutationObserver.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  });

  // `spy` is a no-op in a production MobX, so a production run reports null
  // rather than a zero that reads as "nothing woke up".
  const countsWakeups = import.meta.env.DEV;
  const stopSpying = countsWakeups
    ? spy((event) => {
        if (event.type === 'reaction') {
          wakeups += 1;
        }
      })
    : () => {};

  return () => {
    const elapsedMs = performance.now() - startedAt;
    const seconds = elapsedMs / MS_PER_SECOND;

    root.sim.setBundleApplyProbe(null);
    window.clearInterval(heapTimer);
    longTaskObserver.disconnect();
    cancelAnimationFrame(frameRequest);
    mutationObserver.disconnect();
    stopSpying();

    return {
      label: currentWindowLabel(),
      elapsedMs,
      widgets: storesOnly
        ? []
        : root.liveWidgets.ownMonitorWidgets.map((widget) => widget.type),
      allocBytesPerSec: heapMoved ? allocatedBytes / seconds : null,
      longTasks,
      longTaskMs,
      frames,
      framesOverBudget,
      domMutationsPerSec: mutations / seconds,
      observerWakeupsPerSec: countsWakeups ? wakeups / seconds : null,
      apply: summarize(applyTimes),
      applyFull: summarize(fullApplyTimes),
      ...coldStartSample(),
    };
  };
};

export const initPerfRun = async (root: RendererCore): Promise<() => void> => {
  const config = await getPerfRun();

  if (!config) {
    return () => {};
  }

  if (config.storesOnly) {
    root.sim.suppressWidgets();
  }

  let finish: FinishCollecting | null = null;

  const unlistenBegin = await listenTo(PERF_BEGIN, () => {
    console.info(BEGIN_MARKER);
    finish = startCollecting(root, config.storesOnly);
  });

  const unlistenEnd = await listenTo(PERF_END, async () => {
    if (!finish) {
      return;
    }

    const report = finish();
    finish = null;
    console.info(END_MARKER);

    if (config.heapProfile) {
      await waitForProfile();
    }

    submitOverlayPerf(report).catch((error: unknown) =>
      console.error('[perf-run] report was not accepted:', error)
    );
  });

  return () => {
    unlistenBegin();
    unlistenEnd();
  };
};
