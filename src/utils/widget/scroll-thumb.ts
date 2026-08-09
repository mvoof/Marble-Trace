/** How much a list holds against how much of it is on screen. */
export type ScrollMetrics = { total: number; windowSize: number };

/** Thumb geometry in percent of its track. */
export type ScrollThumb = { heightPercent: number; topPercent: number };

/**
 * Where a zero offset parks the window: chat counts up from the newest message
 * at the bottom, the standings table counts down from the leader at the top.
 */
export type ScrollAnchor = 'top' | 'bottom';

// A thumb thinner than this stops reading as a handle on a long list.
const MIN_THUMB_PERCENT = 12;

/**
 * Thumb for a list that is windowed in a store rather than by a scroll
 * container, or null while the whole list is on screen and there is nothing to
 * indicate. The size floor keeps the thumb grabbable-looking on a long list, so
 * the offset is mapped onto the leftover track rather than onto the raw count.
 */
export const scrollThumbFor = (
  metrics: ScrollMetrics | undefined,
  offset: number,
  anchor: ScrollAnchor = 'top'
): ScrollThumb | null => {
  if (!metrics) {
    return null;
  }

  const { total, windowSize } = metrics;
  const maxOffset = Math.max(0, total - windowSize);

  if (maxOffset === 0 || windowSize <= 0) {
    return null;
  }

  const heightPercent = Math.max(MIN_THUMB_PERCENT, (windowSize / total) * 100);
  const progress = Math.min(1, Math.max(0, offset) / maxOffset);
  const travelled = anchor === 'bottom' ? 1 - progress : progress;

  return {
    heightPercent,
    topPercent: (100 - heightPercent) * travelled,
  };
};
