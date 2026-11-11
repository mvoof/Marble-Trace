import { observer } from 'mobx-react-lite';

import type { UnitSystem } from '@shared/contracts/domain';
import { useReactiveDomWrite } from '@shared/hooks/useReactiveDomWrite';
import { writeStyle, writeText } from '@shared/ui/live/live-parts';
import { formatSpeed } from '@shared/lib/telemetry-format';

import { usePlayerStore } from '../player-context';

interface LiveSpeedProps {
  unitSystem: UnitSystem;
  /**
   * The color for a speed, or `null` for the widget's own — the corner target
   * colour, read inside the write so its observables are followed.
   */
  colorOf?: (speedMs: number) => string | null;
  className?: string;
}

/**
 * The car's speed in the driver's units, written straight to the span on every
 * physics tick — and only when the text or its colour changed. See
 * `docs/rendering.md`.
 */
export const LiveSpeed = observer(
  ({ unitSystem, colorOf, className }: LiveSpeedProps) => {
    const player = usePlayerStore();

    const speedRef = useReactiveDomWrite<HTMLSpanElement>(
      (element, scheduleWrite) => {
        const speed = player.carDynamics?.speed ?? 0;
        const text = formatSpeed(speed, unitSystem);
        const color = colorOf?.(speed) ?? null;

        scheduleWrite(() => {
          writeText(element, text);
          writeStyle(element, 'color', color);
        });
      },
      [player, unitSystem, colorOf]
    );

    return <span ref={speedRef} className={className} />;
  }
);
