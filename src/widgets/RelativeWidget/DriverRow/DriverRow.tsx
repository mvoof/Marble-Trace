import { observer } from 'mobx-react-lite';
import {
  abbreviateName,
  formatCarNumber,
  TRACK_SURFACE_IN_PIT_STALL,
} from '@utils/widget/widget-utils';
import { parseDriverFlags } from '@utils/formatters/flags-utils';
import { PitBadge } from '@/components/shared/PitBadge/PitBadge';
import { DriverFlagBadge } from '@/components/shared/DriverFlagBadge/DriverFlagBadge';
import { LicBadge, formatIr } from '@/components/shared/RatingBadge/LicBadge';
import {
  computeRelativeGap,
  buildRelativeGridTemplate,
} from '@utils/widget/relative-utils';
import type { DriverEntry } from '@/types/bindings';
import type { RelativeWidgetSettings } from '@/types/widget-settings';

import styles from './DriverRow.module.scss';
import {
  useBackendComputedStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

interface DriverRowProps {
  driver: DriverEntry;
  index: number;
}

export const DriverRow = observer(({ driver, index }: DriverRowProps) => {
  const computed = useBackendComputedStore();
  const { relativeEntries } = computed;
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<RelativeWidgetSettings>('relative');

  const player = relativeEntries.find((entry) => entry.isPlayer) ?? null;

  const isPit =
    driver.trackSurface === TRACK_SURFACE_IN_PIT_STALL || driver.onPitRoad;

  const pitState = driver.pitState;
  const flagType = parseDriverFlags(driver.rawFlags);

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

  const rowClass = [
    styles.driverRow,
    driver.isPlayer ? styles.driverRowPlayer : '',
    index % 2 !== 0 ? styles.rowOdd : '',
    isPit ? styles.driverRowPit : '',
  ]
    .filter(Boolean)
    .join(' ');

  const formattedCarNumber = formatCarNumber(driver.carNumber);

  const gridTemplate = buildRelativeGridTemplate(settings);

  return (
    <div
      className={rowClass}
      style={{ gridTemplateColumns: gridTemplate }}
      data-relative-row
    >
      <div className={styles.posBlock}>
        <span
          className={`${styles.driverPosition} ${driver.isPlayer ? styles.driverPositionPlayer : ''}`}
        >
          {driver.classPosition || driver.position}
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
          #{formattedCarNumber}
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

        {settings.showDriverFlags && flagType !== 'none' && (
          <DriverFlagBadge type={flagType} />
        )}
        {settings.showPitIndicator && isPit && <PitBadge state={pitState} />}
      </div>

      {settings.showLicBadge ? (
        <div className={styles.colLic}>
          <LicBadge licString={driver.licString} />
        </div>
      ) : null}

      {settings.showIRating ? (
        <div className={styles.colIr}>
          <span>{formatIr(driver.iRating)}</span>
        </div>
      ) : null}

      <div className={styles.f2Block}>
        <span className={`${styles.f2Time} ${f2Class}`}>
          {driver.isPlayer ? '-' : f2TimeStr}
        </span>
      </div>
    </div>
  );
});
