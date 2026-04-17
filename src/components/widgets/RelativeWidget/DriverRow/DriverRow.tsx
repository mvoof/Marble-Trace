import React from 'react';
import { observer } from 'mobx-react-lite';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { TRACK_SURFACE_IN_PIT_STALL } from '../../widget-utils';
import { formatIRating } from '../../widget-utils';
import type { RelativeWidgetSettings } from '../../../../store/widget-settings.store';
import type { DriverEntry } from '../../widget-utils';

import styles from './DriverRow.module.scss';

const LICENSE_CLASS_MAP: Record<string, string> = {
  A: styles.licA,
  B: styles.licB,
  C: styles.licC,
  D: styles.licD,
  R: styles.licR,
};

const LicenseBadge = ({ licString }: { licString: string }) => {
  const parts = licString.split(' ');
  const licClass = parts[0] ?? '';
  const rating = parts[1] ?? '';
  const classStyle = LICENSE_CLASS_MAP[licClass] ?? styles.licR;

  return (
    <span className={styles.licenseBadge}>
      <span className={`${styles.licenseClass} ${classStyle}`}>{licClass}</span>
      <span className={styles.licenseRating}>{rating}</span>
    </span>
  );
};

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

    const relativeGap =
      driver.isPlayer || !player ? 0 : driver.f2Time - player.f2Time;

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
          <span
            className={`${styles.driverPosition} ${driver.isPlayer ? styles.driverPositionPlayer : ''}`}
          >
            {driver.position}
          </span>
          <span className={styles.driverCarNumber}>{driver.carNumber}</span>
        </div>

        <div className={styles.infoBlock}>
          <span
            className={`${styles.driverName} ${driver.isPlayer ? styles.driverNamePlayer : ''}`}
          >
            {driver.userName.toUpperCase()}
          </span>

          <div className={styles.details}>
            {settings.showPitIndicator && isPit && (
              <span className={styles.pitTag}>PIT</span>
            )}

            {settings.showClassBadge && (
              <span
                className={styles.classBadge}
                style={{ backgroundColor: driver.carClassColor }}
              >
                {driver.carClassShortName}
              </span>
            )}

            {settings.showIRatingBadge && (
              <>
                <span className={styles.metaSeparator}>|</span>
                <LicenseBadge licString={driver.licString} />
                <span className={styles.irInfo}>
                  {formatIRating(driver.iRating)}
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
