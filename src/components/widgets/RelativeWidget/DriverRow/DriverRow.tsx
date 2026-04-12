import React from 'react';
import { observer } from 'mobx-react-lite';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { TRACK_SURFACE_IN_PIT_STALL, formatIRating } from '../relative-utils';
import type { RelativeEntry } from '../types';

import styles from './DriverRow.module.scss';

interface DriverRowProps {
  driver: RelativeEntry;
  player: RelativeEntry | null;
  trendDelta: number;
}

export const DriverRow = observer(
  ({ driver, player, trendDelta }: DriverRowProps) => {
    const isPit =
      driver.trackSurface === TRACK_SURFACE_IN_PIT_STALL || driver.onPitRoad;

    let lapStatus: 'lapping' | 'lapped' | null = null;

    if (!driver.isPlayer && player) {
      if (driver.lap > player.lap) lapStatus = 'lapping';
      else if (driver.lap < player.lap) lapStatus = 'lapped';
    }

    const f2TimeStr =
      driver.f2Time > 0
        ? `+${driver.f2Time.toFixed(1)}`
        : driver.f2Time < 0
          ? driver.f2Time.toFixed(1)
          : '0.0';

    const f2Class = driver.isPlayer
      ? styles.f2Player
      : driver.f2Time > 0
        ? styles.f2Positive
        : driver.f2Time < 0
          ? styles.f2Negative
          : styles.f2Player;

    let trendIcon: React.ReactNode = null;

    if (!driver.isPlayer && Math.abs(trendDelta) > 0.00005) {
      trendIcon =
        trendDelta < 0 ? (
          <ChevronUp size={16} className={styles.trendUp} />
        ) : (
          <ChevronDown size={16} className={styles.trendDown} />
        );
    }

    const rowClass = [
      styles.driverRow,
      driver.isPlayer ? styles.driverRowPlayer : '',
      isPit ? styles.driverRowPit : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={rowClass} data-relative-row>
        <div
          className={styles.classStripe}
          style={{ backgroundColor: driver.carClassColor }}
        />

        <div className={styles.posBlock}>
          <span className={styles.driverPosition}>{driver.position}</span>
          <span
            className={styles.driverCarNumber}
            style={{ color: driver.carClassColor }}
          >
            {driver.carNumber}
          </span>
        </div>

        <div className={styles.infoBlock}>
          <span
            className={`${styles.driverName} ${driver.isPlayer ? styles.driverNamePlayer : ''}`}
          >
            {driver.userName.toUpperCase()}
          </span>

          <div className={styles.details}>
            {isPit && <span className={styles.pitTag}>PIT</span>}

            <span
              className={styles.classLabel}
              style={{ color: driver.carClassColor }}
            >
              {driver.carClassShortName}
            </span>

            <span className={styles.metaSeparator}>|</span>
            <span className={styles.licInfo}>{driver.licString}</span>
            <span className={styles.irInfo}>
              {formatIRating(driver.iRating)}
            </span>

            {lapStatus && (
              <>
                <span className={styles.metaSeparator}>|</span>
                <span
                  className={
                    lapStatus === 'lapping'
                      ? styles.lapStatusLapping
                      : styles.lapStatusLapped
                  }
                >
                  {lapStatus === 'lapping' ? 'LAPPING' : 'LAPPED'}
                </span>
              </>
            )}
          </div>
        </div>

        <div className={styles.f2Block}>
          {trendIcon}
          <span className={`${styles.f2Time} ${f2Class}`}>
            {driver.isPlayer ? '-' : f2TimeStr}
          </span>
        </div>
      </div>
    );
  }
);
