import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
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
import type { RelativeWidgetSettings } from '@/types/widget-settings';
import { useReactiveDomWrite } from '@ui/hooks/useReactiveDomWrite';

import styles from './DriverRow.module.scss';
import { useBackendComputedStore } from '@store/root-store-context';

interface DriverRowProps {
  carIdx: number;
  index: number;
}

/**
 * One car of the strip. Everything it draws but the gap changes at most once a
 * lap, so the row is rendered from the identity and the gap — which moves every
 * tick, along with the lapped-and-lapping colouring that rides on it — is
 * written straight to its span. See `docs/rendering.md`.
 */
export const DriverRow = observer(({ carIdx, index }: DriverRowProps) => {
  const computed = useBackendComputedStore();

  const settings = useWidgetSettings<RelativeWidgetSettings>('relative');

  const driver = computed.relativeIdentities.find(
    (identity) => identity.carIdx === carIdx
  );

  const gapRef = useReactiveDomWrite<HTMLSpanElement>(
    (element, scheduleWrite) => {
      const entries = computed.relativeEntries;
      const liveDriver = entries.find((entry) => entry.carIdx === carIdx);
      const livePlayer = entries.find((entry) => entry.isPlayer) ?? null;

      if (!liveDriver) {
        return;
      }

      const relativeGap = livePlayer
        ? computeRelativeGap(liveDriver, livePlayer)
        : 0;

      const gapText =
        relativeGap > 0
          ? `+${relativeGap.toFixed(1)}`
          : relativeGap < 0
            ? relativeGap.toFixed(1)
            : '0.0';

      const gapClass = liveDriver.isPlayer
        ? styles.f2Player
        : relativeGap > 0
          ? styles.f2Positive
          : relativeGap < 0
            ? styles.f2Negative
            : styles.f2Player;

      const lapDiff = livePlayer
        ? liveDriver.lap +
          liveDriver.lapDistPct -
          (livePlayer.lap + livePlayer.lapDistPct)
        : 0;

      scheduleWrite(() => {
        element.classList.remove(
          styles.f2Player,
          styles.f2Positive,
          styles.f2Negative
        );
        element.classList.add(gapClass);
        element.textContent = liveDriver.isPlayer ? '-' : gapText;

        const row = element.closest('[data-relative-row]');
        const name = row?.querySelector(`.${styles.driverName}`);

        if (name instanceof HTMLElement) {
          name.classList.toggle(
            styles.driverNameLappedBehind,
            !liveDriver.isPlayer && lapDiff < -0.5
          );
          name.classList.toggle(
            styles.driverNameLappingUs,
            !liveDriver.isPlayer && lapDiff > 0.5
          );
        }
      });
    },
    [computed, carIdx]
  );

  if (!driver) {
    return null;
  }

  const isOut = driver.trackSurface === 'NotInWorld';
  const isOffTrack = !isOut && driver.trackSurface === TRACK_SURFACE_OFF_TRACK;

  const isPit =
    !isOut &&
    (driver.trackSurface === TRACK_SURFACE_IN_PIT_STALL || driver.onPitRoad);

  const pitState = driver.pitState;
  const flagType = parseDriverFlags(driver.rawFlags);

  const position = resolveRowPosition(driver, settings.useLivePositions);

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
        <span ref={gapRef} className={styles.f2Time} />
      </div>
    </div>
  );
});
