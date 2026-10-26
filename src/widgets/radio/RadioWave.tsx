import { useBlink, type BlinkCycle } from '@shared/hooks/useBlink';
import styles from './RadioWidget.module.scss';

/**
 * The wave's four frames, eight a second. A timer steps them rather than a CSS
 * animation, which would redraw the overlay on every display refresh for as
 * long as somebody talks (ADR-0009); this costs eight frames a second, and
 * none at all off the air.
 */
const TALKING_CYCLE: BlinkCycle = { stepMs: 125, steps: 4 };

/** Keep in step with `$wave-envelope` in the stylesheet. */
const BAR_COUNT = 15;
const BAR_KEYS = Array.from({ length: BAR_COUNT }, (_, index) => index);

interface RadioWaveProps {
  isTalking: boolean;
}

export const RadioWave = ({ isTalking }: RadioWaveProps) => {
  const blinkRef = useBlink<HTMLDivElement>(isTalking ? TALKING_CYCLE : null);

  return (
    <div ref={blinkRef} className={styles.bars} aria-hidden="true">
      {BAR_KEYS.map((barKey) => (
        <span key={barKey} className={styles.bar} />
      ))}
    </div>
  );
};
