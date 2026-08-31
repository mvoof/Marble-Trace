import type { CSSProperties } from 'react';
import { observer } from 'mobx-react-lite';
import { formatLapTime } from '@utils/telemetry-format';
import {
  abbreviateName,
  formatBrand,
  formatCarNumber,
  TRACK_SURFACE_IN_PIT_STALL,
  TRACK_SURFACE_OFF_TRACK,
} from '@utils/driver';
import { parseDriverFlags } from '@utils/driver';
import { isSessionEnded } from '@utils/timer-utils';
import { DriverStatusBadges } from '@ui/shared/DriverStatusBadge/DriverStatusBadges';
import { getContrastTextColor, playerRowStyle } from '@utils/colors';
import { CountryFlag } from '@ui/shared/CountryFlag/CountryFlag';
import { DriverFlagBadge } from '@ui/shared/DriverFlagBadge/DriverFlagBadge';
import { LicBadge } from '@ui/shared/RatingBadge/LicBadge';
import { formatIr } from '@ui/shared/RatingBadge/LicBadge.utils';
import { TireBadge } from '@ui/shared/TireBadge/TireBadge';
import {
  buildGridTemplate,
  calculateLapsBehind,
  getStandingsGap,
  resolveBestLapDisplay,
} from '@ui/widgets/StandingsWidget/standings-utils';
import { PosChange } from './PosChange';
import { PositionCell } from './PositionCell';
import { IrChangeCell } from './IrChangeCell';

import type { StandingsWidgetSettings } from '@/types/widget-settings';
import styles from './DriverRow.module.scss';
import {
  useStandingsWidgetStore,
  useSessionStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

interface DriverRowProps {
  carIdx: number;
  index: number;
  /** First row of the "around the player" block — gets the separator above it. */
  startsPlayerWindow?: boolean;
}

export const DriverRow = observer(
  ({ carIdx, index, startsPlayerWindow = false }: DriverRowProps) => {
    const standingsWidget = useStandingsWidgetStore();
    const session = useSessionStore();
    const widgetSettings = useWidgetSettingsStore();

    const driver = standingsWidget.driverMap.get(carIdx);
    const settings =
      widgetSettings.getSettings<StandingsWidgetSettings>('standings');
    const gridTemplate = buildGridTemplate(settings);

    if (!driver) {
      return null;
    }

    const isInGarage = driver.trackSurface === 'NotInWorld';

    // Once the session is over everybody drops to the garage, so leaving the world
    // is no longer a status worth flagging — only a sim-confirmed retirement is.
    const isOut =
      driver.isRetired ||
      (isInGarage && !isSessionEnded(session.session?.session_state ?? null));

    const isPit =
      !isOut &&
      (driver.trackSurface === TRACK_SURFACE_IN_PIT_STALL || driver.onPitRoad);

    const pitState = driver.pitState;
    const flagType = parseDriverFlags(driver.rawFlags);

    // Latched in the backend once the car crosses the line under the checkered
    // flag, so this outlives the drive back to the garage.
    const isFinished = driver.isFinished && !driver.isRetired;

    // The tow truck has the car: it left the world without going through the pit
    // lane, which OUT alone would not tell apart from a garage exit.
    const isTowed = driver.isTowed && !isFinished;

    const isOffTrack = driver.trackSurface === TRACK_SURFACE_OFF_TRACK;

    const useClassPos = settings.viewMode !== 'all';

    const isLeader =
      (useClassPos ? driver.liveClassPosition : driver.livePosition) === 1;

    const rowClass = [
      styles.driverRow,
      settings.rowPadding === 'narrow' ? styles.rowPaddingNarrow : '',
      settings.rowPadding === 'medium' ? styles.rowPaddingMedium : '',
      settings.rowPadding === 'wide' ? styles.rowPaddingWide : '',
      driver.isPlayer ? styles.driverRowPlayer : '',
      index % 2 !== 0 ? styles.rowOdd : '',
      isOffTrack ? styles.driverRowOffTrack : '',
      isOut ? styles.driverRowOut : '',
      startsPlayerWindow ? styles.driverRowWindowStart : '',
      standingsWidget.hoveredClassId === driver.carClassId
        ? styles.driverRowScrollTarget
        : '',
    ]
      .filter(Boolean)
      .join(' ');

    const rowFill = playerRowStyle(driver.isPlayer, settings.playerRowColor);

    // The stripe is painted by a pseudo-element, so the class color reaches it
    // through a variable — the same 3px marker the class header carries.
    const rowStyle = {
      gridTemplateColumns: gridTemplate,
      ...rowFill,
      '--row-class-marker': driver.carClassColor,
    } as CSSProperties;

    const formattedCarNumber = formatCarNumber(driver.carNumber);

    // Get leader of current class/group from cached store for gap/deficit calculation
    const leader = useClassPos
      ? (standingsWidget.classLeaders.get(driver.carClassId) ?? null)
      : standingsWidget.overallLeader;

    const lapsBehind = calculateLapsBehind(leader, driver);

    const sessionInfoData = session.sessionInfo;
    const sessions = sessionInfoData?.sessions;
    const currentSession = sessions?.[sessionInfoData?.currentSessionNum ?? 0];
    const isRace = currentSession?.sessionType === 'Race';

    const classBest = standingsWidget.classBestLapMap.get(driver.carClassId);
    const isClassBestLap =
      driver.bestLapTime > 0 &&
      classBest !== undefined &&
      driver.bestLapTime === classBest;

    const bestLap = resolveBestLapDisplay(driver);

    const gapInfo = getStandingsGap(
      driver,
      leader,
      isRace,
      isLeader,
      lapsBehind
    );

    const gapContent = gapInfo.isLeader ? (
      <span className={styles.gapLeader}>{gapInfo.value}</span>
    ) : gapInfo.isEmpty ? (
      <span className={styles.gapLeader}>{gapInfo.value}</span>
    ) : (
      <span className={styles.gapValue}>{gapInfo.value}</span>
    );

    return (
      <div
        className={rowClass}
        style={rowStyle}
        data-driver-row
        data-row-key={carIdx}
      >
        <PositionCell carIdx={carIdx} />

        <div className={`${styles.cell} ${styles.carNumberCell}`}>
          <span
            className={styles.carNumber}
            style={{
              backgroundColor: driver.carClassColor,
              color: getContrastTextColor(driver.carClassColor),
            }}
          >
            {formattedCarNumber}
          </span>
        </div>

        {settings.showPosChange && (
          <div className={`${styles.cell} ${styles.cellCenter}`}>
            <PosChange carIdx={carIdx} />
          </div>
        )}

        {settings.showCountryFlag && (
          <div className={`${styles.cell} ${styles.cellCenter}`}>
            <CountryFlag flairId={driver.flairId} isAi={driver.isAi} />
          </div>
        )}

        <div className={`${styles.cell} ${styles.nameCell}`}>
          {settings.showDriverFlags &&
            (isFinished ? (
              <DriverFlagBadge type="checkered" />
            ) : (
              flagType !== 'none' && <DriverFlagBadge type={flagType} />
            ))}

          <span
            className={`${styles.driverName} ${driver.isPlayer ? styles.driverNamePlayer : ''}`}
          >
            {settings.abbreviateNames
              ? abbreviateName(driver.userName)
              : driver.userName}
          </span>

          <DriverStatusBadges
            flagType={flagType}
            isTowed={isTowed}
            isOut={isOut}
            isOffTrack={isOffTrack}
            isPit={isPit}
            pitState={pitState}
            isFinished={isFinished}
          />
        </div>

        {settings.showLicBadge && (
          <div className={`${styles.cell} ${styles.cellRating}`}>
            <LicBadge licString={driver.licString} />
          </div>
        )}

        {settings.showIRating && (
          <div className={`${styles.cell} ${styles.cellRight}`}>
            <span className={styles.irValue}>{formatIr(driver.iRating)}</span>
          </div>
        )}

        {settings.showIrChange && (
          <div className={`${styles.cell} ${styles.cellCenter}`}>
            <IrChangeCell carIdx={carIdx} />
          </div>
        )}

        {settings.showLapsCompleted && (
          <div className={`${styles.cell} ${styles.cellCenter}`}>
            <span className={styles.lapsCompleted}>{driver.lap}</span>
          </div>
        )}

        <div className={`${styles.cell} ${styles.cellRight}`}>{gapContent}</div>

        <div className={`${styles.cell} ${styles.cellRight}`}>
          <span className={styles.lastLap}>
            {isPit
              ? '-'
              : formatLapTime(
                  driver.lastLapTime > 0 ? driver.lastLapTime : null
                )}
          </span>
        </div>

        <div className={`${styles.cell} ${styles.cellRight}`}>
          <span
            className={`${styles.bestLap} ${isClassBestLap ? styles.bestLapFastest : ''} ${bestLap.isQualifying ? styles.bestLapQualifying : ''}`}
          >
            {formatLapTime(bestLap.time)}
          </span>
        </div>

        {settings.showBrand && (
          <div className={`${styles.cell} ${styles.cellCenter}`}>
            <span className={styles.brandLabel} title={driver.carScreenName}>
              {formatBrand(driver.carScreenName)}
            </span>
          </div>
        )}

        {settings.showTire && (
          <div className={`${styles.cell} ${styles.cellCenter}`}>
            <TireBadge tire={driver.tireCompound} />
          </div>
        )}
      </div>
    );
  }
);
