import React from 'react';
import { observer } from 'mobx-react-lite';
import { ChevronUp, ChevronDown } from 'lucide-react';
import {
  abbreviateName,
  TRACK_SURFACE_IN_PIT_STALL,
} from '@utils/widget/widget-utils';
import { PitBadge } from '@/components/shared/primitives/PitBadge/PitBadge';
import { ClassBadge } from '@/components/shared/primitives/ClassBadge/ClassBadge';
import { RatingBadge } from '@/components/shared/primitives/RatingBadge/RatingBadge';
import { computeRelativeGap } from '@utils/widget/relative-utils';
import { computedStore } from '@store/iracing/computed.store';
import { widgetSettingsStore } from '@store/widget-settings.store';
import type { DriverEntry } from '@/types/bindings';

import styles from './DriverRow.module.scss';

interface DriverRowProps {
  driver: DriverEntry;
  trendDelta: number;
}

export const DriverRow = observer(({ driver, trendDelta }: DriverRowProps) => {
  const settings = widgetSettingsStore.getRelativeSettings();
  const player =
    computedStore.relativeEntries.find((entry) => entry.isPlayer) ?? null;
  const isPit =
    driver.trackSurface === TRACK_SURFACE_IN_PIT_STALL || driver.onPitRoad;

  const relativeGap = player ? computeRelativeGap(driver, player) : 0;

  const lapDiff = player
    ? driver.lap + driver.lapDistPct - (player.lap + player.lapDistPct)
    : 0;

  const isLappedBehind = !driver.isPlayer && lapDiff < -0.5;

  const isLappingUs = !driver.isPlayer && lapDiff > 0.5;

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

  if (
    settings.showTrendIcon &&
    !driver.isPlayer &&
    Math.abs(trendDelta) > 0.00005
  ) {
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
          className={[
            styles.driverName,
            driver.isPlayer ? styles.driverNamePlayer : '',
            isLappedBehind ? styles.driverNameLappedBehind : '',
            isLappingUs ? styles.driverNameLappingUs : '',
          ]
            .filter(Boolean)
            .join(' ')}
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
            className={styles.badgeFull}
          />
        )}
      </div>

      <div className={styles.colLic}>
        {settings.showIRatingBadge && (
          <RatingBadge
            licString={driver.licString}
            iRating={driver.iRating}
            className={styles.badgeFull}
          />
        )}
      </div>

      <div className={styles.f2Block}>
        <span className={styles.trendSlot}>{trendIcon}</span>
        <span className={`${styles.f2Time} ${f2Class}`}>
          {driver.isPlayer ? '-' : f2TimeStr}
        </span>
      </div>
    </div>
  );
});
