import React from 'react';
import { observer } from 'mobx-react-lite';
import { TRACK_SURFACE_ON_TRACK } from '../relative-utils';
import type { RelativeEntry } from '../types';

import styles from './LinearMap.module.scss';

interface LinearMapProps {
  entries: RelativeEntry[];
  player: RelativeEntry | null;
  position: string;
  isHorizontal: boolean;
}

export const LinearMap = observer(
  ({ entries, player, position, isHorizontal }: LinearMapProps) => {
    const borderClass =
      {
        top: styles.linearMapBorderTop,
        bottom: styles.linearMapBorderBottom,
        left: styles.linearMapBorderLeft,
        right: styles.linearMapBorderRight,
      }[position] ?? '';

    const sizeClass = isHorizontal
      ? styles.linearMapHorizontal
      : styles.linearMapVertical;

    return (
      <div className={`${styles.linearMap} ${sizeClass} ${borderClass}`}>
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
            const style: React.CSSProperties = {
              backgroundColor: d.carClassColor,
              transform: 'translate(-50%, -50%)',
            };

            if (isHorizontal) {
              style.left = `${pct}%`;
              style.top = '50%';
            } else {
              style.top = `${50 - diff * 100}%`;
              style.left = '50%';
            }

            return (
              <div
                key={d.carIdx}
                className={`${styles.mapDot} ${d.isPlayer ? styles.mapDotPlayer : ''}`}
                style={style}
              >
                <span className={styles.mapDotNumber}>{d.carNumber}</span>
              </div>
            );
          })}
      </div>
    );
  }
);
