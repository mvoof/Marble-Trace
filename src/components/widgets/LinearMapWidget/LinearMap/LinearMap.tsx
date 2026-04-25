import { observer } from 'mobx-react-lite';
import { TRACK_SURFACE_ON_TRACK } from '../../widget-utils';
import { CarDot } from '../../primitives';
import type { DriverEntry } from '../../../../types/bindings';

import styles from './LinearMap.module.scss';

interface LinearMapProps {
  entries: DriverEntry[];
  player: DriverEntry | null;
  isHorizontal: boolean;
}

export const LinearMap = observer(
  ({ entries, player, isHorizontal }: LinearMapProps) => {
    const sizeClass = isHorizontal
      ? styles.linearMapHorizontal
      : styles.linearMapVertical;

    return (
      <div className={`${styles.linearMap} ${sizeClass}`}>
        <div
          className={`${styles.mapCenterLine} ${isHorizontal ? styles.mapCenterLineH : styles.mapCenterLineV}`}
        />

        {player &&
          entries.map((d) => {
            if (d.trackSurface !== TRACK_SURFACE_ON_TRACK && !d.isPlayer)
              return null;

            let diff = d.lapDistPct - player.lapDistPct;
            if (diff < -0.5) diff += 1;
            if (diff > 0.5) diff -= 1;

            const pct = diff * 100 + 50;
            const left = isHorizontal ? `${pct}%` : '50%';
            const top = isHorizontal ? '50%' : `${50 - diff * 100}%`;

            return (
              <CarDot
                key={d.carIdx}
                carNumber={d.carNumber}
                carClassColor={d.carClassColor}
                isPlayer={d.isPlayer}
                left={left}
                top={top}
              />
            );
          })}
      </div>
    );
  }
);
