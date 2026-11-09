import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import type { CSSProperties } from 'react';
import { observer } from 'mobx-react-lite';
import {
  abbreviateName,
  formatBrand,
  formatCarNumber,
  TRACK_SURFACE_IN_PIT_STALL,
  TRACK_SURFACE_OFF_TRACK,
} from '@shared/lib/driver';
import { parseDriverFlags } from '@shared/lib/driver';
import { isSessionEnded } from '@shared/lib/timer-utils';
import {
  isPitStatus,
  resolveDriverStatuses,
} from '@shared/ui/StatChip/driver-status';
import { RadioMark } from '@entities/cars/RadioMark/RadioMark';
import { getContrastTextColor, playerRowStyle } from '@shared/lib/colors';
import { CountryFlag } from '@shared/ui/CountryFlag/CountryFlag';
import { DriverFlagBadge } from '@shared/ui/DriverFlagBadge/DriverFlagBadge';
import {
  formatIr,
  iRatingChars,
  licenseTone,
  safetyRatingLabel,
} from '@shared/ui/StatChip/rating';
import { StatChip, writeStatChip } from '@shared/ui/StatChip/StatChip';
import { TireBadge } from '@shared/ui/TireBadge/TireBadge';
import {
  buildBlockEndColumns,
  buildGridTemplate,
  calculateLapsBehind,
  EMPTY_VALUE,
  formatLapCell,
  formatLapDelta,
  getStandingsGap,
  getStandingsInterval,
  resolveBestLapDisplay,
  type LapDeltaTone,
  type StandingsColumn,
  type StandingsGapInfo,
} from '@widgets/standings/standings-utils';
import { PosChange } from './PosChange';
import { PositionCell } from './PositionCell';
import { IrChangeCell } from './IrChangeCell';
import { PitStopTime } from './PitStopTime';

import styles from './DriverRow.module.scss';
import { useReactiveDomWrite } from '@shared/hooks/useReactiveDomWrite';
import { useBackendComputedStore } from '@entities/cars/computed-context';
import { useSessionStore } from '@entities/session/session-context';
import { usePlayerStore } from '@entities/player/player-context';
import { TowTime } from '@entities/player/TowTime/TowTime';
import { useStandingsWidgetStore } from '@widgets/standings/standings.store';
import type { StandingsWidgetSettings } from '../settings-schema';

// The leader and a lapped car read as chips — a state, not a distance; a
// distance stays a plain number. Laps down are the only gap written "N L".
const isLapsDown = (gapInfo: StandingsGapInfo): boolean =>
  gapInfo.value.endsWith(' L');

const writeGap = (
  element: HTMLSpanElement,
  gapInfo: StandingsGapInfo,
  valueClass: string
) => {
  if (gapInfo.isLeader) {
    writeStatChip(element, 'accent', 'label', gapInfo.value);

    return;
  }

  if (isLapsDown(gapInfo)) {
    writeStatChip(element, 'lapped', 'number', gapInfo.value);

    return;
  }

  element.className = gapInfo.isEmpty
    ? `${styles.gapEmpty} ${styles.cellEmpty}`
    : valueClass;
  element.textContent = gapInfo.value;
};

const LAP_DELTA_TONE_CLASS: Record<LapDeltaTone, string> = {
  faster: styles.lastLapDeltaFaster,
  slower: styles.lastLapDeltaSlower,
  even: '',
};

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
    const computed = useBackendComputedStore();
    const player = usePlayerStore();

    const driver = standingsWidget.driverMap.get(carIdx);
    const settings = useWidgetSettings<StandingsWidgetSettings>('standings');
    const gridTemplate = buildGridTemplate(settings);
    const blockEnds = buildBlockEndColumns(settings);

    // One switch mutes every informational column at once, so the row's accent
    // is left to the position, the name and the best lap.
    const dimClass = settings.dimSecondaryColumns ? styles.cellDimmed : '';

    // The cell that closes a group of columns carries the rule after it.
    const cellClass = (column: StandingsColumn, ...extra: string[]): string =>
      [styles.cell, blockEnds.has(column) ? styles.blockEnd : '', ...extra]
        .filter(Boolean)
        .join(' ');

    // The gap is the row's one moving number: it is measured against the leader's
    // live entry and changes on every tick, so it is written straight to its span
    // while the rest of the row is rendered from the identity above. See
    // `docs/rendering.md`.
    const gapRef = useReactiveDomWrite<HTMLSpanElement>(
      (element, scheduleWrite) => {
        const liveDriver = computed.driverEntryOf(carIdx);

        if (!liveDriver) {
          return;
        }

        const byClass = settings.viewMode !== 'all';
        const leaderIdentity = byClass
          ? (standingsWidget.classLeaders.get(liveDriver.carClassId) ?? null)
          : standingsWidget.overallLeader;
        const liveLeader = leaderIdentity
          ? computed.driverEntryOf(leaderIdentity.carIdx)
          : null;

        const sessions = session.sessionInfo?.sessions;
        const isRaceSession =
          sessions?.[session.sessionInfo?.currentSessionNum ?? 0]
            ?.sessionType === 'Race';

        const leads =
          (byClass ? liveDriver.liveClassPosition : liveDriver.livePosition) ===
          1;

        const gapInfo = getStandingsGap(
          liveDriver,
          liveLeader,
          isRaceSession,
          leads,
          calculateLapsBehind(liveLeader, liveDriver)
        );

        scheduleWrite(() =>
          writeGap(element, gapInfo, `${styles.gapValue} ${dimClass}`)
        );
      },
      [computed, standingsWidget, session, settings, carIdx, dimClass]
    );

    // Same measurement as the gap, against the car drawn directly above.
    const intervalRef = useReactiveDomWrite<HTMLSpanElement>(
      (element, scheduleWrite) => {
        const liveDriver = computed.driverEntryOf(carIdx);

        if (!liveDriver) {
          return;
        }

        const aheadIdx = standingsWidget.carAheadMap.get(carIdx);
        const liveAhead =
          aheadIdx === undefined
            ? null
            : (computed.driverEntryOf(aheadIdx) ?? null);

        const intervalInfo = getStandingsInterval(
          liveDriver,
          liveAhead,
          session.currentSessionType === 'Race'
        );

        scheduleWrite(() =>
          writeGap(element, intervalInfo, `${styles.intervalValue} ${dimClass}`)
        );
      },
      [computed, standingsWidget, session, carIdx, dimClass]
    );

    if (!driver) {
      return null;
    }

    const isInGarage = driver.trackSurface === 'NotInWorld';

    // Latched in the backend once the car crosses the line under the checkered
    // flag, so this outlives the drive back to the garage. It outranks retirement
    // too: a driver who takes the flag and then quits the session is reported by
    // the sim with a reason-out, but what he did in the race was finish it.
    const isFinished = driver.isFinished;

    // Once the session is over everybody drops to the garage, so leaving the world
    // is no longer a status worth flagging — only a sim-confirmed retirement is.
    const isOut =
      !isFinished &&
      (driver.isRetired ||
        (isInGarage &&
          !isSessionEnded(session.session?.session_state ?? null)));

    const isPit =
      !isOut &&
      (driver.trackSurface === TRACK_SURFACE_IN_PIT_STALL || driver.onPitRoad);

    const pitState = driver.pitState;
    const flagType = parseDriverFlags(driver.rawFlags);

    // The tow truck has the car: it left the world without going through the pit
    // lane, which OUT alone would not tell apart from a garage exit. A towed
    // player sits in the stall while the tow counts down — that is the tow too,
    // not a stop.
    const isTowed =
      (driver.isTowed || (driver.isPlayer && player.isTowing)) && !isFinished;

    const isOffTrack = driver.trackSurface === TRACK_SURFACE_OFF_TRACK;

    // Every row of a team event takes the second line, an unnamed team too, so
    // the table keeps one row height while teams come and go.
    const showsTeamNames =
      settings.showTeamName && session.sessionInfo?.teamRacing === true;

    const rowClass = [
      styles.driverRow,
      showsTeamNames ? styles.driverRowWithTeam : '',
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

    const classBest = standingsWidget.classBestLapMap.get(driver.carClassId);
    const isClassBestLap =
      driver.bestLapTime !== null &&
      classBest !== undefined &&
      driver.bestLapTime === classBest;

    const bestLap = resolveBestLapDisplay(driver);

    const lastLapText = isPit ? EMPTY_VALUE : formatLapCell(driver.lastLapTime);

    const bestLapText = formatLapCell(bestLap.time);

    const lapDeltaDisplay = formatLapDelta(
      standingsWidget.lapDeltas.get(carIdx)
    );

    // Read from the identity, so the list changes with the row's own render and
    // adds none: a pit stop or a tow is the rare event the row redraws for.
    const statusChips = resolveDriverStatuses({
      flagType,
      isTowed,
      isOut,
      isOffTrack,
      isPit,
      pitState,
      isFinished,
      showPit: settings.showPitIndicator,
    });

    // What rides on a chip's dark half: the time on pit road, the tow.
    const pitDetail = settings.showPitStopTime ? (
      <PitStopTime carIdx={carIdx} />
    ) : undefined;

    const towDetail =
      settings.showPitStopTime && driver.isPlayer && player.isTowing ? (
        <TowTime />
      ) : undefined;

    const driverName = (
      <span
        className={`${styles.driverName} ${driver.isPlayer ? styles.driverNamePlayer : ''}`}
      >
        {settings.abbreviateNames
          ? abbreviateName(driver.userName)
          : driver.userName}
      </span>
    );

    return (
      <div
        className={rowClass}
        style={rowStyle}
        data-driver-row
        data-row-key={carIdx}
      >
        <PositionCell carIdx={carIdx} />

        <div className={cellClass('carNumber', styles.carNumberCell)}>
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
          <div className={cellClass('posChange', styles.cellCenter)}>
            <PosChange carIdx={carIdx} />
          </div>
        )}

        {settings.showCountryFlag && (
          <div className={cellClass('countryFlag', styles.cellCenter)}>
            <CountryFlag flairId={driver.flairId} isAi={driver.isAi} />
          </div>
        )}

        <div className={cellClass('name', styles.nameCell)}>
          {settings.showDriverFlags &&
            (isFinished ? (
              <DriverFlagBadge type="checkered" />
            ) : (
              flagType !== 'none' && <DriverFlagBadge type={flagType} />
            ))}

          {showsTeamNames ? (
            <div className={styles.nameStack}>
              {driverName}
              <span className={styles.teamName}>{driver.teamName}</span>
            </div>
          ) : (
            driverName
          )}

          {settings.showRadioMark && (
            <RadioMark carIdx={driver.carIdx} onPlayerRow={driver.isPlayer} />
          )}

          {statusChips.map((chip) => (
            <StatChip
              key={chip.status}
              lead={chip.label}
              leadVariant={chip.lead}
              tone={chip.tone}
              emphasized={chip.lead === 'solid'}
            >
              {chip.status === 'tow'
                ? towDetail
                : isPitStatus(chip.status)
                  ? pitDetail
                  : undefined}
            </StatChip>
          ))}
        </div>

        {(settings.showLicBadge || settings.showIRating) && (
          <div className={cellClass('rating', styles.cellCenter)}>
            <StatChip
              lead={
                settings.showLicBadge
                  ? safetyRatingLabel(
                      driver.licString,
                      settings.showLicenseLetter
                    )
                  : undefined
              }
              leadKind="number"
              leadVariant={settings.licBadgeStyle === 'dark' ? 'tint' : 'solid'}
              tone={licenseTone(driver.licString)}
              valueChars={iRatingChars(settings.abbreviateIRating)}
            >
              {settings.showIRating
                ? formatIr(driver.iRating, settings.abbreviateIRating)
                : undefined}
            </StatChip>
          </div>
        )}

        {settings.showIrChange && (
          <div className={cellClass('irChange', styles.cellCenter)}>
            <IrChangeCell carIdx={carIdx} />
          </div>
        )}

        {settings.showLapsCompleted && (
          <div className={cellClass('laps', styles.cellCenter)}>
            <span className={`${styles.lapsCompleted} ${dimClass}`}>
              {driver.lap}
            </span>
          </div>
        )}

        {settings.showGap && (
          <div className={cellClass('gap', styles.cellRight)}>
            <span ref={gapRef} />
          </div>
        )}

        {settings.showInterval && (
          <div className={cellClass('interval', styles.cellRight)}>
            <span ref={intervalRef} />
          </div>
        )}

        {settings.showLastLap && (
          <div className={cellClass('lastLap', styles.cellRight)}>
            <span
              className={`${styles.lastLap} ${dimClass} ${lastLapText === EMPTY_VALUE ? styles.cellEmpty : ''}`}
            >
              {lastLapText}
            </span>
          </div>
        )}

        {settings.showLapDelta && (
          <div className={cellClass('lapDelta', styles.cellRight)}>
            <span
              className={`${styles.lastLapDelta} ${LAP_DELTA_TONE_CLASS[lapDeltaDisplay.tone]} ${lapDeltaDisplay.value === EMPTY_VALUE ? styles.cellEmpty : ''}`}
            >
              {lapDeltaDisplay.value}
            </span>
          </div>
        )}

        {settings.showBestLap && (
          <div className={cellClass('bestLap', styles.cellRight)}>
            {bestLapText === EMPTY_VALUE ? (
              <span className={`${styles.bestLap} ${styles.cellEmpty}`}>
                {bestLapText}
              </span>
            ) : isClassBestLap ? (
              <StatChip lead={bestLapText} leadKind="number" tone="special" />
            ) : (
              <StatChip
                lead={bestLapText}
                leadKind="number"
                tone={bestLap.isQualifying ? 'muted' : 'neutral'}
              />
            )}
          </div>
        )}

        {settings.showBrand && (
          <div className={cellClass('brand', styles.cellCenter)}>
            <span title={driver.carScreenName}>
              <StatChip
                lead={formatBrand(driver.carScreenName)}
                leadKind="number"
                tone="muted"
              />
            </span>
          </div>
        )}

        {settings.showTire && (
          <div className={cellClass('tire', styles.cellCenter)}>
            <TireBadge tire={driver.tireCompound} />
          </div>
        )}
      </div>
    );
  }
);
