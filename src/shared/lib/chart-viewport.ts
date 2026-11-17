/**
 * One view over a lap shared by charts and a map: the stretch shown, the
 * cursor, and the gesture in force. Plain listeners, not MobX: the cursor
 * moves with the mouse and nothing in React should render for it.
 */

/** [from, to], metres from the line. */
export type DistanceRange = readonly [number, number];

/** Who moved the view: a chart, or the map. A listener skips its own. */
export type ViewSource = 'chart' | 'map';

export type ChartGesture = 'zoom' | 'pan' | 'frame';

/** The narrowest stretch a zoom goes to, metres. */
export const MIN_RANGE_M = 20;

const clampRange = (
  from: number,
  to: number,
  lengthM: number
): DistanceRange | null => {
  const span = Math.max(to - from, MIN_RANGE_M);

  if (span >= lengthM) {
    return null;
  }

  const start = Math.min(Math.max(from, 0), lengthM - span);

  return [start, start + span];
};

/**
 * Zooms around `atM`: `factor` below 1 narrows the stretch, above 1 widens
 * it. `null` is the whole lap.
 */
export const zoomRange = (
  range: DistanceRange | null,
  lengthM: number,
  atM: number,
  factor: number
): DistanceRange | null => {
  const [from, to] = range ?? [0, lengthM];
  const share = to > from ? (atM - from) / (to - from) : 0.5;
  const span = (to - from) * factor;
  const start = atM - span * share;

  return clampRange(start, start + span, lengthM);
};

/** Moves the stretch by `deltaM`, kept on the lap. */
export const panRange = (
  range: DistanceRange | null,
  lengthM: number,
  deltaM: number
): DistanceRange | null =>
  range === null
    ? null
    : clampRange(range[0] + deltaM, range[1] + deltaM, lengthM);

/** A stretch picked by its two ends, in either order. */
export const frameRange = (
  first: number,
  second: number,
  lengthM: number
): DistanceRange | null =>
  clampRange(Math.min(first, second), Math.max(first, second), lengthM);

/** The longest run of `true` in `inside`, as [first, last] index; `null` for none. */
export const longestRun = (inside: boolean[]): [number, number] | null => {
  let best: [number, number] | null = null;
  let runStart = -1;

  inside.forEach((isInside, index) => {
    if (isInside && runStart < 0) {
      runStart = index;
    }

    const runEnds = runStart >= 0 && (!isInside || index === inside.length - 1);

    if (runEnds) {
      const runEnd = isInside ? index : index - 1;

      if (best === null || runEnd - runStart > best[1] - best[0]) {
        best = [runStart, runEnd];
      }

      runStart = -1;
    }
  });

  return best;
};

type Listener<Value> = (value: Value, source: ViewSource) => void;

export class ChartViewport {
  range: DistanceRange | null = null;
  cursorM: number | null = null;
  gesture: ChartGesture | null = null;
  /** The lap's length, metres: the grid's last point. */
  lengthM = 0;

  private rangeListeners = new Set<Listener<DistanceRange | null>>();
  private cursorListeners = new Set<Listener<number | null>>();
  private gestureListeners = new Set<(gesture: ChartGesture | null) => void>();

  setLength(lengthM: number) {
    this.lengthM = lengthM;
  }

  setRange(range: DistanceRange | null, source: ViewSource) {
    this.range = range;
    this.rangeListeners.forEach((listener) => listener(range, source));
  }

  setCursor(metres: number | null, source: ViewSource) {
    this.cursorM = metres;
    this.cursorListeners.forEach((listener) => listener(metres, source));
  }

  setGesture(gesture: ChartGesture | null) {
    if (gesture === this.gesture) {
      return;
    }

    this.gesture = gesture;
    this.gestureListeners.forEach((listener) => listener(gesture));
  }

  onRange(listener: Listener<DistanceRange | null>) {
    this.rangeListeners.add(listener);

    return () => {
      this.rangeListeners.delete(listener);
    };
  }

  onCursor(listener: Listener<number | null>) {
    this.cursorListeners.add(listener);

    return () => {
      this.cursorListeners.delete(listener);
    };
  }

  onGesture(listener: (gesture: ChartGesture | null) => void) {
    this.gestureListeners.add(listener);

    return () => {
      this.gestureListeners.delete(listener);
    };
  }
}
