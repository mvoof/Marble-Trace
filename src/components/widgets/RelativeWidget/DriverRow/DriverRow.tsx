import React from 'react';
import { observer } from 'mobx-react-lite';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { TRACK_SURFACE_IN_PIT_STALL, formatIRating } from '../../widget-utils';

const abbreviateName = (fullName: string): string => {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return fullName;
  return `${parts[0].charAt(0)}. ${parts.slice(1).join(' ')}`;
};
import { PitBadge, ClassBadge, LicenseBadge } from '../../primitives';
import type { RelativeWidgetSettings } from '../../../../types/widget-settings';
import type { DriverEntry } from '../../../../types/bindings';

import styles from './DriverRow.module.scss';

interface DriverRowProps {
  driver: DriverEntry;
  player: DriverEntry | null;
  trendDelta: number;
  settings: RelativeWidgetSettings;
}

export const DriverRow = observer(
  ({ driver, player, trendDelta, settings }: DriverRowProps) => {
    const isPit =
      driver.trackSurface === TRACK_SURFACE_IN_PIT_STALL || driver.onPitRoad;

    const relativeGap = (() => {
      if (driver.isPlayer || !player) return 0;

      const isAhead = driver.relativeLapDist > 0;
      const aheadClassLapTime = isAhead
        ? driver.classEstLapTime || driver.bestLapTime
        : player.classEstLapTime || player.bestLapTime;
      const behindClassLapTime = isAhead
        ? player.classEstLapTime || player.bestLapTime
        : driver.classEstLapTime || driver.bestLapTime;

      if (!aheadClassLapTime || !behindClassLapTime) {
        return driver.estTime - player.estTime;
      }

      const scalingRatio = behindClassLapTime / aheadClassLapTime;
      const aheadEstTime = isAhead ? driver.estTime : player.estTime;
      const behindEstTime = isAhead ? player.estTime : driver.estTime;
      const aheadTimeScaled = aheadEstTime * scalingRatio;
      const referenceLapTime = behindClassLapTime;

      let delta = aheadTimeScaled - behindEstTime;
      if (isAhead) {
        if (delta < -referenceLapTime / 2) delta += referenceLapTime;
      } else {
        delta = -delta;
        if (delta > referenceLapTime / 2) delta -= referenceLapTime;
      }

      return delta;
    })();

    const f2TimeStr =
      relativeGap > 0
        ? `+${relativeGap.toFixed(1)}`
        : relativeGap < 0
          ? relativeGap.toFixed(1)
          : '0.0';

    const f2Class = driver.isPlayer
      ? styles.f2Player
      : relativeGap > 0
        ? styles.f2Positive
        : relativeGap < 0
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
      settings.showIRatingBadge ? styles.driverRowWithIRating : '',
      driver.isPlayer ? styles.driverRowPlayer : '',
      isPit ? styles.driverRowPit : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={rowClass} data-relative-row>
        <div className={styles.posBlock}>
          <span
            className={`${styles.driverPosition} ${driver.isPlayer ? styles.driverPositionPlayer : ''}`}
          >
            {driver.position}
          </span>
        </div>

        <div
          className={styles.carNumberCell}
          style={{
            borderLeft: `4px solid ${driver.carClassColor}`,
            background: `linear-gradient(to right, ${driver.carClassColor}33, transparent)`,
          }}
        >
          <span
            className={`${styles.driverCarNumber} ${driver.isPlayer ? styles.driverCarNumberPlayer : ''}`}
          >
            #{driver.carNumber}
          </span>
        </div>

        <div className={styles.infoBlock}>
          <span
            className={`${styles.driverName} ${driver.isPlayer ? styles.driverNamePlayer : ''}`}
          >
            {settings.abbreviateNames
              ? abbreviateName(driver.userName)
              : driver.userName}
          </span>
        </div>

        <div className={styles.colPit}>
          {settings.showPitIndicator && isPit && <PitBadge />}
        </div>

        <div className={styles.colClass}>
          {settings.showClassBadge && (
            <ClassBadge
              color={driver.carClassColor}
              label={driver.carClassShortName}
            />
          )}
        </div>

        <div className={styles.colLic}>
          {settings.showIRatingBadge && (
            <LicenseBadge
              licString={driver.licString}
              className={styles.licBadge}
            />
          )}
        </div>

        {settings.showIRatingBadge && (
          <span className={styles.irInfo}>{formatIRating(driver.iRating)}</span>
        )}

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
