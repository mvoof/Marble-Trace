import type { TrackPoint } from '@/types';

const FULL_LAP_PCT = 1.0;

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

  let p = pct % FULL_LAP_PCT;
  if (p < 0) p += FULL_LAP_PCT;

  let lo = 0;
  let hi = points.length - 1;

  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (points[mid].pct <= p) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const a = points[lo];
  const b = points[hi];
  const segLen = b.pct - a.pct + (b.pct < a.pct ? FULL_LAP_PCT : 0);

  if (segLen <= 0) return { x: a.x, y: a.y };

  let t = (p - a.pct) / segLen;

  if (t < 0) {
    t += FULL_LAP_PCT / segLen;
  }

  const tClamped = Math.max(0, Math.min(FULL_LAP_PCT, t));

  return {
    x: a.x + (b.x - a.x) * tClamped,
    y: a.y + (b.y - a.y) * tClamped,
  };
};

/**
 * Rotates a set of track coordinates by a given angle in degrees.
 */
export const rotatePoints = (
  points: TrackPoint[],
  angle: number
): TrackPoint[] => {
  if (angle === 0) return points;
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return points.map((p) => ({
    ...p,
    x: p.x * cos - p.y * sin,
    y: p.x * sin + p.y * cos,
  }));
};

/**
 * Re-calculates the SVG path and padded viewBox for a set of points.
 */
export const buildSvgPathAndViewBox = (
  pts: TrackPoint[]
): { svgPath: string; viewBox: string } => {
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
  const padding = Math.max(width, height) * 0.02; // 2% padding matching track-recorder

  const vbX = minX - padding;
  const vbY = minY - padding;
  const vbW = width + padding * 2;
  const vbH = height + padding * 2;

  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;

  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
  }

  d += ' Z';

  return {
    svgPath: d,
    viewBox: `${vbX.toFixed(0)} ${vbY.toFixed(0)} ${vbW.toFixed(0)} ${vbH.toFixed(0)}`,
  };
};
