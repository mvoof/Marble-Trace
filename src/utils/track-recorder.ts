import type { TrackPoint } from '../types/track';

const MS_PER_SECOND = 1000;
const MAX_PROGRESS_PCT = 0.99;
const DT_CAP_SECONDS = 0.1;
const DT_FALLBACK_SECONDS = 0.016; // ~60Hz
const LAP_WRAP_THRESHOLD = 0.5;
const SAMPLING_THRESHOLD_PCT = 0.001;
const NEAR_END_THRESHOLD = 0.9;
const NEAR_START_THRESHOLD = 0.1;
const MIN_POINTS_FOR_COMPLETION = 100;
const VIEWBOX_PADDING_FACTOR = 0.02;
const SVG_PRECISION = 1;
const FULL_LAP_PCT = 1.0;

export class TrackRecorder {
  private points: TrackPoint[] = [];
  private x = 0;
  private y = 0;
  private recording = false;
  private complete = false;
  private prevTime = 0;

  // Progress tracking
  private startPct = -1;
  private highestPct = -1;
  private lastLapDistPct = -1;
  private pointsCount = 0;

  get isRecording(): boolean {
    return this.recording;
  }

  get isComplete(): boolean {
    return this.complete;
  }

  get progress(): number {
    if (this.complete) return 1;
    if (!this.recording || this.startPct < 0 || this.highestPct < 0) return 0;

    let pct = this.highestPct - this.startPct;
    if (pct < 0) pct += 1;
    return Math.max(0, Math.min(pct, MAX_PROGRESS_PCT));
  }

  start(): void {
    this.reset();
    this.recording = true;
    this.prevTime = performance.now() / MS_PER_SECOND;
  }

  reset(): void {
    this.points = [];
    this.x = 0;
    this.y = 0;
    this.recording = false;
    this.complete = false;
    this.startPct = -1;
    this.highestPct = -1;
    this.lastLapDistPct = -1;
    this.pointsCount = 0;
    this.prevTime = 0;
  }

  /**
   * Feed a telemetry tick. Call this at ~60Hz.
   * @param speed Vehicle speed in m/s (updates at 60Hz)
   * @param yaw Heading angle in radians (updates at 60Hz)
   * @param lapDistPct Current lap distance percentage (updates at 10Hz)
   */
  tick(speed: number, yaw: number, lapDistPct: number): void {
    if (!this.recording || this.complete) return;

    // Use high-precision wall clock for perfect 60Hz integration,
    // independent of when the sessionTime telemetry object actually updates (1Hz).
    const now = performance.now() / MS_PER_SECOND;
    let dt = now - this.prevTime;
    this.prevTime = now;

    // First valid tick: initialize start position
    if (this.startPct < 0) {
      if (lapDistPct < 0) return;
      this.startPct = lapDistPct;
      this.highestPct = lapDistPct;
      this.lastLapDistPct = lapDistPct;
      this.points.push({ x: 0, y: 0, pct: lapDistPct });
      this.pointsCount = 1;
      return;
    }

    // Cap dt to prevent massive jumps during app lag or backgrounding
    if (dt > DT_CAP_SECONDS) dt = DT_FALLBACK_SECONDS;
    if (dt <= 0) return;

    // 60Hz dead reckoning: integrate position based on current velocity vector
    const dx = -speed * Math.sin(yaw) * dt;
    const dy = speed * Math.cos(yaw) * dt;
    this.x += dx;
    this.y -= dy;

    // 10Hz progress tracking:
    // We only push a new track point when the lapDistPct actually changes.
    let pctDiff = lapDistPct - this.lastLapDistPct;
    if (pctDiff < -LAP_WRAP_THRESHOLD) pctDiff += 1; // Cross S/F forward
    if (pctDiff > LAP_WRAP_THRESHOLD) pctDiff -= 1; // Cross S/F backward

    if (Math.abs(pctDiff) >= SAMPLING_THRESHOLD_PCT) {
      this.points.push({ x: this.x, y: this.y, pct: lapDistPct });
      this.lastLapDistPct = lapDistPct;
      this.pointsCount++;
    }

    // Track highest achieved progress from start point
    let currentRelativeProgress = lapDistPct - this.startPct;
    if (currentRelativeProgress < 0) currentRelativeProgress += 1;

    let highestRelativeProgress = this.highestPct - this.startPct;
    if (highestRelativeProgress < 0) highestRelativeProgress += 1;

    // Only update highestPct if it's a forward movement (to ignore noise)
    if (
      currentRelativeProgress > highestRelativeProgress &&
      currentRelativeProgress - highestRelativeProgress < NEAR_START_THRESHOLD
    ) {
      this.highestPct = lapDistPct;
    }

    // Completion Logic:
    // If we have recorded most of the lap (>90%) and then jump back to the start (<10%),
    // OR we hit the hard threshold, we are done.
    // We require a minimum points count to prevent accidental completion.
    const crossedStartLine =
      highestRelativeProgress > NEAR_END_THRESHOLD &&
      currentRelativeProgress < NEAR_START_THRESHOLD;

    if (crossedStartLine && this.pointsCount > MIN_POINTS_FOR_COMPLETION) {
      this.complete = true;
      this.recording = false;
    }
  }

  /**
   * Build an SVG path and viewBox from recorded points.
   */
  buildSvgPath(): { svgPath: string; viewBox: string } {
    const pts = this.getSortedPoints();
    if (pts.length < 3) {
      return { svgPath: '', viewBox: '0 0 100 100' };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const p of pts) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }

    const width = maxX - minX || 1;
    const height = maxY - minY || 1;
    const padding = Math.max(width, height) * VIEWBOX_PADDING_FACTOR;

    const vbX = minX - padding;
    const vbY = minY - padding;
    const vbW = width + padding * 2;
    const vbH = height + padding * 2;

    let d = `M ${pts[0].x.toFixed(SVG_PRECISION)} ${pts[0].y.toFixed(SVG_PRECISION)}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i].x.toFixed(SVG_PRECISION)} ${pts[i].y.toFixed(SVG_PRECISION)}`;
    }
    d += ' Z';

    return {
      svgPath: d,
      viewBox: `${vbX.toFixed(0)} ${vbY.toFixed(0)} ${vbW.toFixed(0)} ${vbH.toFixed(0)}`,
    };
  }

  private getSortedPoints(): TrackPoint[] {
    if (this.points.length === 0) return [];
    return [...this.points].sort((a, b) => a.pct - b.pct);
  }

  getPoints(): TrackPoint[] {
    return this.getSortedPoints();
  }
}

/**
 * Find a point along the recorded path at the given lapDistPct.
 * Returns interpolated {x, y} coordinates.
 */
export const getPointAtPct = (
  points: TrackPoint[],
  pct: number
): { x: number; y: number } => {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return { x: points[0].x, y: points[0].y };

  // Wrap pct to [0, 1)
  let p = pct % FULL_LAP_PCT;
  if (p < 0) p += FULL_LAP_PCT;

  // Binary search for the segment
  let lo = 0;
  let hi = points.length - 1;

  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (points[mid].pct <= p) lo = mid;
    else hi = mid;
  }

  const a = points[lo];
  const b = points[hi];
  const segLen = b.pct - a.pct + (b.pct < a.pct ? FULL_LAP_PCT : 0);

  if (segLen <= 0) return { x: a.x, y: a.y };

  let t = (p - a.pct) / segLen;
  if (t < 0) t += FULL_LAP_PCT / segLen;
  const tClamped = Math.max(0, Math.min(FULL_LAP_PCT, t));

  return {
    x: a.x + (b.x - a.x) * tClamped,
    y: a.y + (b.y - a.y) * tClamped,
  };
};
