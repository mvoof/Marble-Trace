const PERCENT = 100;
const BYTES_PER_MEGABYTE = 1024 * 1024;

/** A 0–1 fraction as a whole percent. */
export const toPercent = (fraction: number): number =>
  Math.round(fraction * PERCENT);

/** A byte count as whole megabytes. */
export const toMegabytes = (bytes: number): number =>
  Math.round(bytes / BYTES_PER_MEGABYTE);
