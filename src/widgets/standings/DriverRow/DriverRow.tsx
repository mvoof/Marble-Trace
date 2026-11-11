import { observer } from 'mobx-react-lite';

import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { useBackendComputedStore } from '@entities/cars/computed-context';
import { CarNumberBadge } from '@entities/cars/driver-table/CarNumberBadge';
import { DriverNameContent } from '@entities/cars/driver-table/DriverNameContent';
import { driverRowStateOf } from '@entities/cars/driver-table/driver-row-state';
import { DriverRowShell } from '@entities/cars/driver-table/DriverRowShell';
import { RatingCells } from '@entities/cars/driver-table/RatingCells';
import { usePlayerStore } from '@entities/player/player-context';
import { TowTime } from '@entities/player/TowTime/TowTime';
import { useSessionStore } from '@entities/session/session-context';
import { useReactiveDomWrite } from '@shared/hooks/useReactiveDomWrite';
import { writeText } from '@shared/ui/live/live-parts';
import { cx } from '@shared/lib/class-names';
import { formatBrand } from '@shared/lib/driver';
import { isSessionEnded } from '@shared/lib/timer-utils';
import { CountryFlag } from '@shared/ui/CountryFlag/CountryFlag';
import {
  isPitStatus,
  type DriverStatus,
} from '@shared/ui/StatChip/driver-status';
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
  isPersonalBestLastLap,
  resolveBestLapDisplay,
  type LapDeltaTone,
  type StandingsColumn,
  type StandingsGapInfo,
} from '@widgets/standings/standings-utils';
import { useStandingsWidgetStore } from '@widgets/standings/standings.store';

import type { StandingsWidgetSettings } from '../settings-schema';
import { IrChangeCell } from './IrChangeCell';
import { PitStopTime } from './PitStopTime';
import { PosChange } from './PosChange';
import { PositionCell } from './PositionCell';
import styles from './DriverRow.module.scss';

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

  const className = gapInfo.isEmpty
    ? `${styles.gapEmpty} ${styles.cellEmpty}`
    : valueClass;

  if (element.className !== className) {
    element.className = className;
  }

  writeText(element, gapInfo.value);
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
      cx(styles.cell, blockEnds.has(column) ? styles.blockEnd : '', ...extra);

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

        const isRaceSession = session.currentSessionType === 'Race';

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

    const state = driverRowStateOf(driver, {
      isSessionEnded: isSessionEnded(session.session?.session_state ?? null),
      isPlayerTowing: player.isTowing,
    });
    const isPit = state.isPit;

    // Every row of a team event takes the second line, an unnamed team too, so
    // the table keeps one row height while teams come and go.
    const showsTeamNames =
      settings.showTeamName && session.sessionInfo?.teamRacing === true;

    const rowClass = cx(
      showsTeamNames && styles.driverRowWithTeam,
      !driver.isPlayer && styles.driverRowHoverable,
      startsPlayerWindow && styles.driverRowWindowStart,
      standingsWidget.hoveredClassId === driver.carClassId &&
        styles.driverRowScrollTarget
    );

    const classBest = standingsWidget.classBestLapMap.get(driver.carClassId);
    const isClassBestLap =
      driver.bestLapTime !== null &&
      classBest !== undefined &&
      driver.bestLapTime === classBest;

    const bestLap = resolveBestLapDisplay(driver);

    const lastLapText = isPit ? EMPTY_VALUE : formatLapCell(driver.lastLapTime);

    const bestLapText = formatLapCell(bestLap.time);
    const isPersonalBest = !isPit && isPersonalBestLastLap(driver);

    const lapDeltaDisplay = formatLapDelta(
      standingsWidget.lapDeltas.get(carIdx)
    );

    // What rides on a chip's dark half: the time on pit road, the tow.
    const chipDetail = (status: DriverStatus) => {
      if (!settings.showPitStopTime) {
        return undefined;
      }

      if (status === 'tow') {
        return driver.isPlayer && player.isTowing ? <TowTime /> : undefined;
      }

      return isPitStatus(status) ? <PitStopTime carIdx={carIdx} /> : undefined;
    };

    return (
      <DriverRowShell
        classes={styles}
        gridTemplate={gridTemplate}
        classColor={driver.carClassColor}
        rowPadding={settings.rowPadding}
        isPlayer={driver.isPlayer}
        isOdd={index % 2 !== 0}
        state={state}
        playerRowColor={settings.playerRowColor}
        className={rowClass}
        data-driver-row
        data-row-key={carIdx}
      >
        <PositionCell carIdx={carIdx} />

        <div className={cellClass('carNumber', styles.carNumberCell)}>
          <CarNumberBadge
            carNumber={driver.carNumber}
            classColor={driver.carClassColor}
          />
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
          <DriverNameContent
            driver={driver}
            state={state}
            abbreviate={settings.abbreviateNames}
            showDriverFlags={settings.showDriverFlags}
            showRadioMark={settings.showRadioMark}
            showPitIndicator={settings.showPitIndicator}
            teamName={showsTeamNames ? driver.teamName : undefined}
            chipDetail={chipDetail}
          />
        </div>

        <RatingCells
          driver={driver}
          settings={settings}
          cellClassName={(column) => cellClass(column, styles.cellCenter)}
        />

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
              className={`${styles.lastLap} ${isPersonalBest ? styles.lastLapPersonalBest : ''} ${dimClass} ${lastLapText === EMPTY_VALUE ? styles.cellEmpty : ''}`}
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
                className={
                  isPersonalBest ? styles.bestLapPersonalBest : undefined
                }
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
                className={styles.brandChip}
              />
            </span>
          </div>
        )}

        {settings.showTire && (
          <div className={cellClass('tire', styles.cellCenter)}>
            <TireBadge tire={driver.tireCompound} />
          </div>
        )}
      </DriverRowShell>
    );
  }
);
