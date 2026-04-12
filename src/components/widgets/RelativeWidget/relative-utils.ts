export const TRACK_SURFACE_IN_PIT_STALL = 1;
export const TRACK_SURFACE_ON_TRACK = 3;
export const TREND_SAMPLE_INTERVAL_MS = 2000;

export const formatIRating = (ir: number): string => {
  if (ir >= 1000) return `${(ir / 1000).toFixed(1)}k`;
  return ir.toString();
};
