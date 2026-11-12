import { observer } from 'mobx-react-lite';

import { useSessionStore } from '@entities/session/session-context';
import { REDLINE_BLINK, type RpmDigitColors } from '@shared/lib/car-signals';
import { cx } from '@shared/lib/class-names';
import { useBlinkHandle } from '@shared/hooks/useBlink';
import { useReactiveDomWrite } from '@shared/hooks/useReactiveDomWrite';
import { writeStyle, writeText } from '@shared/ui/live/live-parts';
import { formatGear } from '@shared/lib/telemetry-format';

import { usePlayerStore } from '../player-context';
import { readEngine, type EngineReading } from './engine-reading';
import styles from './ShiftDigit.module.scss';

const RPM_PERCENT_BASE = 100;

/** What the digit shows: the gear, the revs, or the revs as a share of the range. */
export type ShiftDigitFormat = 'gear' | 'rpm' | 'rpmPercent';

const TEXT_OF: Record<ShiftDigitFormat, (reading: EngineReading) => string> = {
  gear: (reading) => formatGear(reading.gear),
  rpm: (reading) => String(reading.rpm),
  rpmPercent: (reading) => `${Math.round(reading.pct * RPM_PERCENT_BASE)}%`,
};

interface ShiftDigitProps {
  format: ShiftDigitFormat;
  /** The zone colors, or `null` to keep the widget's own color. */
  zoneColors: RpmDigitColors | null;
  /** Flash at the shift point. */
  blink: boolean;
  /** The widget's look: font, size, its own color. */
  className?: string;
}

/**
 * A gear or rev readout painted by the rev zone, flashing at the shift point —
 * the one implementation every dash takes. The value moves on every physics
 * tick, so it is written straight to the span, and only when it changed; the
 * flash runs on a timer, never a CSS animation (ADR-0009). See
 * `docs/rendering.md`.
 */
export const ShiftDigit = observer(
  ({ format, zoneColors, blink, className }: ShiftDigitProps) => {
    const player = usePlayerStore();
    const session = useSessionStore();
    const shiftBlink = useBlinkHandle();

    const digitRef = useReactiveDomWrite<HTMLSpanElement>(
      (element, scheduleWrite) => {
        const reading = readEngine(player, session, { zoneColors, blink });
        const text = TEXT_OF[format](reading);

        scheduleWrite(() => {
          writeText(element, text);
          writeStyle(element, 'color', reading.color);

          element.classList.toggle(styles.blinkPulse, reading.isBlink);
          shiftBlink.attach(element);
          shiftBlink.run(reading.isBlink ? REDLINE_BLINK : null);
        });
      },
      [player, session, format, zoneColors, blink, shiftBlink]
    );

    return <span ref={digitRef} className={cx(styles.digit, className)} />;
  }
);
