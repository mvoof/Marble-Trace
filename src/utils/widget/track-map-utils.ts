import type { TrackPoint } from '@/types';

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
