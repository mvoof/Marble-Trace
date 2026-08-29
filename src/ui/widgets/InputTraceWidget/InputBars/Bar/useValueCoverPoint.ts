import { useEffect, useState, type RefObject } from 'react';

const FULLY_COVERED = 1;

/**
 * The fill level at which the bar's fill reaches the middle of the readout.
 *
 * The label is a fixed number of pixels tall while the track's height follows
 * the widget's size, so the level where the digits stop sitting on the track
 * and start sitting on the fill is different at every scale — it has to be
 * measured rather than assumed. Recomputed whenever the track resizes.
 */
export const useValueCoverPoint = (
  trackRef: RefObject<HTMLElement | null>,
  labelRef: RefObject<HTMLElement | null>
): number => {
  const [coverPoint, setCoverPoint] = useState(FULLY_COVERED);

  useEffect(() => {
    const track = trackRef.current;

    if (!track) {
      return;
    }

    const measure = () => {
      const label = labelRef.current;
      const trackHeight = track.offsetHeight;

      if (!label || trackHeight <= 0) {
        return;
      }

      const labelMiddle = label.offsetTop + label.offsetHeight / 2;

      setCoverPoint(
        Math.max(0, Math.min(1, (trackHeight - labelMiddle) / trackHeight))
      );
    };

    measure();

    const resizeObserver = new ResizeObserver(measure);

    resizeObserver.observe(track);

    return () => resizeObserver.disconnect();
  }, [trackRef, labelRef]);

  return coverPoint;
};
