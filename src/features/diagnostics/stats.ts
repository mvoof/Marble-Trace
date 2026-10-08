/**
 * Summary statistics for one diagnostics cell.
 *
 * Deliberately median-based rather than mean-based: a single sample taken while
 * the sim streamed a new car model or the OS scheduled something else skews a
 * mean and leaves a median untouched, and such samples are unavoidable in a
 * live session.
 */
export interface SampleStats {
  samples: number;
  median: number;
  low: number;
  high: number;
}

const LOW_PERCENTILE = 0.05;
const HIGH_PERCENTILE = 0.95;

const percentileOf = (sorted: number[], fraction: number): number => {
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.round(fraction * (sorted.length - 1)))
  );

  return sorted[index];
};

export const summarize = (values: number[]): SampleStats | null => {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((first, second) => first - second);

  return {
    samples: sorted.length,
    median: percentileOf(sorted, 0.5),
    low: percentileOf(sorted, LOW_PERCENTILE),
    high: percentileOf(sorted, HIGH_PERCENTILE),
  };
};
