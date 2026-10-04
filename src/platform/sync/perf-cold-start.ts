/**
 * The overlay's cold start, for a perf run: navigation start to its first
 * contentful paint, and the heap at that moment.
 *
 * Watched from the entry module, before React mounts, because the paint
 * happens long before `initPerfRun` knows whether a run is on — the settings
 * file is read first. One buffered observer that disconnects after its single
 * entry, so it costs nothing outside a run.
 */

const FIRST_CONTENTFUL_PAINT = 'first-contentful-paint';

export interface ColdStartSample {
  firstPaintMs: number | null;
  heapAtFirstPaintBytes: number | null;
}

interface ChromiumMemory {
  usedJSHeapSize: number;
}

const sample: ColdStartSample = {
  firstPaintMs: null,
  heapAtFirstPaintBytes: null,
};

const readHeap = (): number | null => {
  const memory = (performance as Performance & { memory?: ChromiumMemory })
    .memory;

  return memory ? memory.usedJSHeapSize : null;
};

export const watchColdStart = () => {
  const observer = new PerformanceObserver((list) => {
    const paint = list.getEntriesByName(FIRST_CONTENTFUL_PAINT)[0];

    if (!paint) {
      return;
    }

    sample.firstPaintMs = paint.startTime;
    sample.heapAtFirstPaintBytes = readHeap();
    observer.disconnect();
  });

  observer.observe({ type: 'paint', buffered: true });
};

export const coldStartSample = (): ColdStartSample => ({ ...sample });
