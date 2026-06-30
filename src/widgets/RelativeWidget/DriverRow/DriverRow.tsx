import { observer } from 'mobx-react-lite';
import {
  abbreviateName,
  formatCarNumber,
  TRACK_SURFACE_IN_PIT_STALL,
  TRACK_SURFACE_OFF_TRACK,
} from '@utils/widget/widget-utils';
import { parseDriverFlags } from '@utils/formatters/flags-utils';
import { DriverStatusBadge } from '@/components/shared/DriverStatusBadge/DriverStatusBadge';
import { DriverFlagBadge } from '@/components/shared/DriverFlagBadge/DriverFlagBadge';
import { LicBadge } from '@/components/shared/RatingBadge/LicBadge';
import { formatIr } from '@/components/shared/RatingBadge/LicBadge.utils';
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

  const isOut = driver.trackSurface === 'NotInWorld';
  const isOffTrack = !isOut && driver.trackSurface === TRACK_SURFACE_OFF_TRACK;

  const isPit =
    !isOut &&
    (driver.trackSurface === TRACK_SURFACE_IN_PIT_STALL || driver.onPitRoad);

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
    settings.rowPadding === 'narrow' ? styles.rowPaddingNarrow : '',
    settings.rowPadding === 'medium' ? styles.rowPaddingMedium : '',
    settings.rowPadding === 'wide' ? styles.rowPaddingWide : '',
    driver.isPlayer ? styles.driverRowPlayer : '',
    index % 2 !== 0 ? styles.rowOdd : '',
    isOffTrack ? styles.driverRowOffTrack : '',
    isOut ? styles.driverRowOut : '',
  ]
    .filter(Boolean)
    .join(' ');

  const formattedCarNumber = formatCarNumber(driver.carNumber);

  const gridTemplate = buildRelativeGridTemplate(settings);

  // Player row: fill with the user-chosen color and stack the same color in a
  // thin band at the top/bottom edges. Layering the color over the fill makes
  // those edges brighter in the same hue — a glow that reads like a border.
  const playerRowStyle = driver.isPlayer
    ? {
        background: `linear-gradient(to bottom, ${settings.playerRowColor}, transparent 2px), linear-gradient(to top, ${settings.playerRowColor}, transparent 2px), ${settings.playerRowColor}`,
      }
    : undefined;

  return (
    <div
      className={rowClass}
      style={{ gridTemplateColumns: gridTemplate, ...playerRowStyle }}
      data-relative-row
    >
      <div
        className={styles.posBlock}
        style={{
          borderLeft: `3px solid ${driver.carClassColor}`,
          background: driver.isPlayer
            ? undefined
            : `linear-gradient(to right, color-mix(in srgb, ${driver.carClassColor} 20%, transparent), transparent)`,
        }}
      >
        <span
          className={`${styles.driverPosition} ${driver.isPlayer ? styles.driverPositionPlayer : ''}`}
          style={
            driver.isPlayer ? { color: settings.playerAccentColor } : undefined
          }
        >
          {driver.classPosition || driver.position}
        </span>
      </div>

      <div className={styles.carNumberCell}>
        <span
          className={styles.driverCarNumber}
          style={
            driver.isPlayer ? { color: settings.playerAccentColor } : undefined
          }
        >
          #{formattedCarNumber}
        </span>
      </div>

      <div className={styles.infoBlock}>
        {settings.showDriverFlags && flagType !== 'none' && (
          <DriverFlagBadge type={flagType} />
        )}

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

        {flagType === 'dq' && <DriverStatusBadge status="dnf" />}
        {isOut && flagType !== 'dq' && <DriverStatusBadge status="out" />}
        {isOffTrack && flagType !== 'dq' && (
          <DriverStatusBadge status="off_track" />
        )}
        {settings.showPitIndicator && isPit && flagType !== 'dq' && (
          <DriverStatusBadge
            status={
              pitState === 'in'
                ? 'pit_in'
                : pitState === 'exit'
                  ? 'pit_exit'
                  : 'pit'
            }
          />
        )}
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
