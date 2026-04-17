/**
 * Track recorder — builds a 2D track path from telemetry via dead reckoning.
 *
 * Since iRacing does not expose GPS coordinates in telemetry, we reconstruct
 * the track shape by integrating velocity vectors + heading over one full lap.
 *
 * Input per tick: speed (m/s), yaw (heading in radians), lapDistPct (0..1)
 * Output: SVG path string + viewBox for rendering.
 */

export interface TrackPoint {
  x: number;
  y: number;
  pct: number; // lapDistPct at this point
}

export interface RecordedTrack {
  trackName: string;
  trackConfig: string;
  trackId: number;
  svgPath: string;
  viewBox: string;
  points: TrackPoint[];
  recordedAt: string;
}

export interface TracksFile {
  tracks: Record<string, RecordedTrack>;
}

const SAMPLE_INTERVAL_PCT = 0.002; // Sample every ~0.2% of the lap

export class TrackRecorder {
  private points: TrackPoint[] = [];
  private lastPct = -1;
  private x = 0;
  private y = 0;
  private recording = false;
  private complete = false;
  private startPct = -1;
  private prevTime = 0;
  private wrapCount = 0;

  get isRecording(): boolean {
    return this.recording;
  }

  get isComplete(): boolean {
    return this.complete;
  }

  get progress(): number {
    if (this.complete) return 1;
    if (!this.recording || this.startPct < 0) return 0;

    let pct = this.lastPct - this.startPct;
    if (pct < 0) pct += 1;
    return Math.min(pct, 1);
  }

  start(): void {
    this.points = [];
    this.lastPct = -1;
    this.x = 0;
    this.y = 0;
    this.recording = true;
    this.complete = false;
    this.startPct = -1;
    this.prevTime = 0;
    this.wrapCount = 0;
  }

  /**
   * Feed a telemetry tick. Call this at ~60Hz.
   * @param speed Vehicle speed in m/s
   * @param yaw Heading angle in radians (iRacing Yaw)
   * @param lapDistPct Current lap distance percentage (0..1)
   * @param sessionTime Current session time in seconds
   */
  tick(
    speed: number,
    yaw: number,
    lapDistPct: number,
    sessionTime: number
  ): void {
    if (!this.recording || this.complete) return;

    // Initialize start position
    if (this.startPct < 0) {
      this.startPct = lapDistPct;
      this.lastPct = lapDistPct;
      this.prevTime = sessionTime;
      this.points.push({ x: 0, y: 0, pct: lapDistPct });
      return;
    }

    // Calculate dt
    const dt = sessionTime - this.prevTime;
    this.prevTime = sessionTime;
    if (dt <= 0 || dt > 1) return; // Skip invalid or large gaps

    // Dead reckoning: integrate position
    // iRacing Yaw: 0 = north, positive = clockwise
    // Convert to standard math: x = east, y = north
    const dx = speed * Math.sin(yaw) * dt;
    const dy = speed * Math.cos(yaw) * dt;
    this.x += dx; // east = positive x = right in SVG (standard map orientation)
    this.y -= dy; // north = negative y = up in SVG

    // Sample at regular intervals
    let pctDiff = lapDistPct - this.lastPct;
    if (pctDiff < -0.5) {
      pctDiff += 1; // Lap wrap
      this.wrapCount++;
    }
    if (pctDiff > 0.5) pctDiff -= 1;

    if (Math.abs(pctDiff) >= SAMPLE_INTERVAL_PCT) {
      this.points.push({ x: this.x, y: this.y, pct: lapDistPct });
      this.lastPct = lapDistPct;
    }

    // Check if lap is complete.
    // Use wrapCount to handle starting near pct=0: without it, when startPct≈0 and
    // lapDistPct wraps back to ~0, totalPct resets to 0 requiring a second full lap.
    const totalPct = lapDistPct - this.startPct + this.wrapCount;
    if (totalPct >= 0.99 && this.points.length > 50) {
      // Close the loop
      this.points.push({ x: this.points[0].x, y: this.points[0].y, pct: 1 });
      this.complete = true;
      this.recording = false;
    }
  }

  /**
   * Build an SVG path and viewBox from recorded points.
   */
  buildSvgPath(): { svgPath: string; viewBox: string } {
    if (this.points.length < 3) {
      return { svgPath: '', viewBox: '0 0 100 100' };
    }

    // Normalize points to fit in a viewBox
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const p of this.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }

    const width = maxX - minX || 1;
    const height = maxY - minY || 1;
    const padding = Math.max(width, height) * 0.05;

    const vbX = minX - padding;
    const vbY = minY - padding;
    const vbW = width + padding * 2;
    const vbH = height + padding * 2;

    // Build SVG path with smooth curves (catmull-rom → cubic bezier)
    const pts = this.points;
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;

    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
    }

    return {
      svgPath: d,
      viewBox: `${vbX.toFixed(0)} ${vbY.toFixed(0)} ${vbW.toFixed(0)} ${vbH.toFixed(0)}`,
    };
  }

  getPoints(): TrackPoint[] {
    return [...this.points];
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
  let p = pct % 1;
  if (p < 0) p += 1;

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
  const segLen = b.pct - a.pct + (b.pct < a.pct ? 1 : 0);

  if (segLen <= 0) return { x: a.x, y: a.y };

  let t = (p - a.pct) / segLen;
  if (t < 0) t += 1 / segLen;
  t = Math.max(0, Math.min(1, t));

  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
};
