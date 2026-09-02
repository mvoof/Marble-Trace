import type { CSSProperties } from 'react';
import { observer } from 'mobx-react-lite';
import {
  abbreviateName,
  formatCarNumber,
  TRACK_SURFACE_IN_PIT_STALL,
  TRACK_SURFACE_OFF_TRACK,
} from '@utils/driver';
import { parseDriverFlags } from '@utils/driver';
import { DriverStatusBadges } from '@ui/shared/DriverStatusBadge/DriverStatusBadges';
import { getContrastTextColor, playerRowStyle } from '@utils/colors';
import { CountryFlag } from '@ui/shared/CountryFlag/CountryFlag';
import { DriverFlagBadge } from '@ui/shared/DriverFlagBadge/DriverFlagBadge';
import { LicBadge } from '@ui/shared/RatingBadge/LicBadge';
import { formatIr } from '@ui/shared/RatingBadge/LicBadge.utils';
import {
  computeRelativeGap,
  buildRelativeGridTemplate,
  resolveRowPosition,
} from '@ui/widgets/RelativeWidget/relative-utils';
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

  const position = resolveRowPosition(driver, settings.useLivePositions);

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

  const rowFill = playerRowStyle(driver.isPlayer, settings.playerRowColor);

  // The stripe is painted by a pseudo-element, so the class color reaches it
  // through a variable — the same marker Standings rows carry.
  const rowStyle = {
    gridTemplateColumns: gridTemplate,
    ...rowFill,
    '--row-class-marker': driver.carClassColor,
  } as CSSProperties;

  return (
    <div className={rowClass} style={rowStyle} data-relative-row>
      <div className={styles.posBlock}>
        <span
          className={`${styles.driverPosition} ${driver.isPlayer ? styles.driverPositionPlayer : ''}`}
          style={
            driver.isPlayer ? { color: settings.playerAccentColor } : undefined
          }
        >
          {position}
        </span>
      </div>

      <div className={styles.carNumberCell}>
        <span
          className={styles.driverCarNumber}
          style={{
            backgroundColor: driver.carClassColor,
            color: getContrastTextColor(driver.carClassColor),
          }}
        >
          {formattedCarNumber}
        </span>
      </div>

      {settings.showCountryFlag && (
        <div className={styles.countryFlagCell}>
          <CountryFlag flairId={driver.flairId} isAi={driver.isAi} />
        </div>
      )}

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

        <DriverStatusBadges
          flagType={flagType}
          isTowed={driver.isTowed}
          isOut={isOut}
          isOffTrack={isOffTrack}
          isPit={isPit}
          pitState={pitState}
          showPit={settings.showPitIndicator}
        />
      </div>

      {settings.showLicBadge ? (
        <div className={styles.colLic}>
          <LicBadge
            licString={driver.licString}
            showLetter={settings.showLicenseLetter}
          />
        </div>
      ) : null}

      {settings.showIRating ? (
        <div className={styles.colIr}>
          <span>{formatIr(driver.iRating, settings.abbreviateIRating)}</span>
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
