import { useMemo } from 'react';
import { useVisibleRowCount } from '../../../hooks/useVisibleRowCount';
import { observer } from 'mobx-react-lite';
import {
  ChevronUp,
  ChevronDown,
  Minus,
  MoreHorizontal,
  Users,
  Trophy,
} from 'lucide-react';

import { WidgetPanel } from '../primitives';
import { telemetryStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { pitStopsStore } from '../../../store/pit-stops.store';
import { formatLapTime } from '../../../utils/telemetry-format';
import {
  parseClassColor,
  fallbackClassColor,
} from '../../../utils/class-color';
import { computeProjectedIrDelta } from '../../../utils/iracing-irating';
import type { Driver } from '../../../types/bindings';

import styles from './StandingsWidget.module.scss';

interface DriverEntry {
  carIdx: number;
  userName: string;
  carNumber: string;
  carClassId: number;
  carClassShortName: string;
  carClassColor: string;
  carScreenName: string;
  /** TireCompoundType label resolved via DriverInfo.DriverTires (e.g. Soft/Wet) */
  tireCompound: string;
  position: number;
  classPosition: number;
  startPosOverall: number;
  startPosClass: number;
  lap: number;
  lapDistPct: number;
  lastLapTime: number;
  bestLapTime: number;
  f2Time: number;
  trackSurface: number;
  iRating: number;
  licString: string;
  licColor: string;
  incidents: number;
  isPlayer: boolean;
  onPitRoad: boolean;
}

interface DriverGroup {
  className: string;
  classShortName: string;
  classColor: string;
  totalDrivers: number;
  classSof: number;
  drivers: (DriverEntry | SeparatorEntry)[];
}

interface SeparatorEntry {
  isSeparator: true;
  id: string;
}

const isSeparator = (
  entry: DriverEntry | SeparatorEntry
): entry is SeparatorEntry => 'isSeparator' in entry && entry.isSeparator;

const LICENSE_CLASS_MAP: Record<string, string> = {
  A: styles.licA,
  B: styles.licB,
  C: styles.licC,
  D: styles.licD,
  R: styles.licR,
};

const TRACK_SURFACE_OFF_TRACK = 0;
const TRACK_SURFACE_IN_PIT_STALL = 1;
const NEAR_DQ_INCIDENT_THRESHOLD = 15;

const shortenClassName = (name: string): string => {
  if (name.length <= 6) return name;
  return name.split(' ')[0] ?? name;
};

const formatIRating = (ir: number): string => {
  if (ir >= 1000) return `${(ir / 1000).toFixed(1)}k`;
  return ir.toString();
};

const computeClassSof = (drivers: DriverEntry[]): number => {
  if (drivers.length === 0) return 0;
  const total = drivers.reduce((sum, d) => sum + d.iRating, 0);
  return Math.round(total / drivers.length);
};

const TIRE_CLASS_MAP: Record<string, string> = {
  S: styles.tireSoft,
  M: styles.tireMed,
  H: styles.tireHard,
  W: styles.tireWet,
};

const TireBadge = ({ tire }: { tire: string }) => {
  if (!tire) return <span className={styles.tireEmpty}>-</span>;
  // First char of compound type ("Soft" → S, "Wet" → W, "Hard" → H, …).
  const code = tire.charAt(0).toUpperCase();
  const cls = TIRE_CLASS_MAP[code] ?? styles.tireMed;
  return <span className={`${styles.tireBadge} ${cls}`}>{code}</span>;
};

// Pull a short brand label out of the full car screen name (e.g.
// "Ferrari 488 GT3 Evo 2020" → "Ferrari").
const formatBrand = (screenName: string): string => {
  if (!screenName) return '';
  return screenName.split(' ')[0] ?? screenName;
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

export const StandingsWidget = observer(() => {
  const carIdx = telemetryStore.carIdx;
  const { sessionInfo, driverInfo, weekendInfo } = telemetryStore;
  const settings = widgetSettingsStore.getStandingsSettings();
  const { ref: tableWrapRef, count: visibleRowCount } =
    useVisibleRowCount<HTMLDivElement>(2, 5, `tbody tr.${styles.driverRow}`);

  const playerCarIdx = driverInfo?.DriverCarIdx ?? -1;
  const drivers = useMemo(
    (): Driver[] => driverInfo?.Drivers ?? [],
    [driverInfo?.Drivers]
  );

  const startPositions = telemetryStore.startPositions;

  const driverEntries = useMemo((): DriverEntry[] => {
    if (!carIdx || drivers.length === 0) return [];

    const driverTires = driverInfo?.DriverTires ?? [];

    return drivers
      .filter((driver) => {
        const idx = driver.CarIdx;
        if (driver.CarIsPaceCar === 1 || driver.IsSpectator === 1) return false;
        if (idx >= carIdx.car_idx_position.length) return false;
        // Always keep the player even when they have no race position yet.
        if (idx === playerCarIdx) return true;
        // Show drivers that have a position OR are on track (lap dist > 0).
        // Before the green flag, positions may be 0 but cars are already on grid.
        const pos = carIdx.car_idx_position[idx] ?? 0;
        const lapDistPct = carIdx.car_idx_lap_dist_pct[idx] ?? -1;
        if (pos > 0) return true;
        if (lapDistPct >= 0) return true;
        return false;
      })
      .map((driver): DriverEntry => {
        const idx = driver.CarIdx;
        return {
          carIdx: idx,
          userName: driver.UserName,
          carNumber: driver.CarNumber ?? '',
          carClassId: driver.CarClassID ?? -1,
          carClassShortName: driver.CarClassShortName ?? '',
          carClassColor: driver.CarClassColor
            ? parseClassColor(driver.CarClassColor)
            : fallbackClassColor(driver.CarClassID ?? -1),
          carScreenName: driver.CarScreenName ?? '',
          tireCompound: ((): string => {
            const tireIdx = carIdx.car_idx_tire_compound?.[idx] ?? -1;
            if (tireIdx < 0) return '';
            return (
              driverTires.find((t) => t.TireIndex === tireIdx)
                ?.TireCompoundType ?? ''
            );
          })(),
          position: carIdx.car_idx_position[idx] ?? 0,
          classPosition: carIdx.car_idx_class_position[idx] ?? 0,
          startPosOverall: startPositions.get(idx)?.overall ?? 0,
          startPosClass: startPositions.get(idx)?.class ?? 0,
          lap: carIdx.car_idx_lap?.[idx] ?? 0,
          lapDistPct: carIdx.car_idx_lap_dist_pct[idx] ?? 0,
          lastLapTime: carIdx.car_idx_last_lap_time?.[idx] ?? -1,
          bestLapTime: carIdx.car_idx_best_lap_time?.[idx] ?? -1,
          f2Time: carIdx.car_idx_f2_time?.[idx] ?? 0,
          trackSurface: carIdx.car_idx_track_surface?.[idx] ?? -1,
          iRating: driver.IRating ?? 0,
          licString: driver.LicString ?? 'R 0.00',
          licColor: driver.LicColor ?? '000000',
          incidents: driver.CurDriverIncidentCount ?? 0,
          isPlayer: idx === playerCarIdx,
          onPitRoad: carIdx.car_idx_on_pit_road[idx] ?? false,
        };
      })
      .sort((a, b) => {
        // When positions are assigned, sort by position.
        // Before the green flag (pos 0), fall back to qualify/grid position.
        const posA = a.position > 0 ? a.position : a.startPosOverall || 999;
        const posB = b.position > 0 ? b.position : b.startPosOverall || 999;
        return posA - posB;
      });
  }, [carIdx, drivers, playerCarIdx, startPositions, driverInfo?.DriverTires]);

  const overallSof = useMemo(
    () => computeClassSof(driverEntries),
    [driverEntries]
  );

  // Projected iR change (Elo estimate). Only computed when the column is on.
  const irDeltaMap = useMemo(() => {
    if (!settings.showIrChange) return new Map<number, number>();
    return computeProjectedIrDelta(
      driverEntries.map((d) => ({
        carIdx: d.carIdx,
        classId: d.carClassId,
        classPosition: d.classPosition,
        iRating: d.iRating,
      }))
    );
  }, [driverEntries, settings.showIrChange]);

  const displayGroups = useMemo((): DriverGroup[] => {
    if (driverEntries.length === 0) return [];

    // `around-player` always overrides class grouping (matches the example).
    const groupByClass =
      settings.groupByClass && settings.filterMode !== 'around-player';

    let groups: DriverGroup[];

    if (groupByClass) {
      const classMap = new Map<number, DriverEntry[]>();

      for (const d of driverEntries) {
        const existing = classMap.get(d.carClassId);

        if (existing) {
          existing.push(d);
        } else {
          classMap.set(d.carClassId, [d]);
        }
      }

      groups = Array.from(classMap.entries()).map(([, driversInClass]) => ({
        className: driversInClass[0]?.carClassShortName ?? 'Class',
        classShortName: driversInClass[0]?.carClassShortName ?? 'Class',
        classColor: driversInClass[0]?.carClassColor ?? '#888',
        totalDrivers: driversInClass.length,
        classSof: computeClassSof(driversInClass),
        drivers: driversInClass.sort(
          (a, b) => a.classPosition - b.classPosition
        ),
      }));
    } else {
      groups = [
        {
          className: 'Overall',
          classShortName: '',
          classColor: '',
          totalDrivers: driverEntries.length,
          classSof: overallSof,
          drivers: [...driverEntries],
        },
      ];
    }

    if (settings.filterMode === 'around-player') {
      const allDrivers = [...driverEntries];
      const playerIdx = allDrivers.findIndex((d) => d.isPlayer);

      if (playerIdx === -1) return [];

      const total = visibleRowCount;
      const half = Math.floor(total / 2);
      let start = Math.max(0, playerIdx - half);
      let end = Math.min(allDrivers.length, start + total);
      start = Math.max(0, end - total);

      return [
        {
          className: 'Overall',
          classShortName: '',
          classColor: '',
          totalDrivers: allDrivers.length,
          classSof: overallSof,
          drivers: allDrivers.slice(start, end),
        },
      ];
    }

    // "all" mode: cap rows to visibleRowCount, distribute budget
    // proportionally across classes. If player is not in the visible
    // portion of their class, pin them at the bottom with a separator.
    const totalBudget = visibleRowCount;
    const totalDrivers = groups.reduce(
      (sum, g) =>
        sum +
        (g.drivers.filter((d) => !isSeparator(d)) as DriverEntry[]).length,
      0
    );

    if (totalDrivers > totalBudget && groups.length > 0) {
      groups = groups.map((group) => {
        const driversOnly = group.drivers.filter(
          (d) => !isSeparator(d)
        ) as DriverEntry[];

        const share =
          groups.length === 1
            ? totalBudget
            : Math.max(
                1,
                Math.floor((driversOnly.length / totalDrivers) * totalBudget)
              );

        if (driversOnly.length <= share) return group;

        const playerIdx = driversOnly.findIndex((d) => d.isPlayer);
        const visible: (DriverEntry | SeparatorEntry)[] = driversOnly.slice(
          0,
          share
        );

        if (playerIdx >= share) {
          visible.push({ isSeparator: true, id: `sep-${group.className}` });
          visible.push(driversOnly[playerIdx]);
        }

        return { ...group, drivers: visible };
      });
    }

    return groups;
  }, [driverEntries, settings, overallSof, visibleRowCount]);

  const sessionData = sessionInfo?.SessionInfo;
  const currentSession =
    sessionData?.Sessions?.[sessionData.CurrentSessionNum ?? 0];
  const showGroupHeaders =
    settings.groupByClass && settings.filterMode !== 'around-player';
  const trackName = weekendInfo?.TrackDisplayName ?? '';

  return (
    <WidgetPanel className={styles.standings} gap={0}>
      {settings.showSessionHeader && (
        <div className={styles.sessionHeader}>
          <div className={styles.sessionLeft}>
            {trackName && <span>{trackName}</span>}

            {currentSession && (
              <span>{currentSession.SessionType?.toUpperCase()}</span>
            )}

            {currentSession?.SessionLaps && (
              <span>Laps: {currentSession.SessionLaps}</span>
            )}
          </div>

          <div className={styles.sessionRight}>
            {settings.showTotalDrivers && (
              <span className={styles.sessionDriverCount}>
                <Users size={10} />
                <span className={styles.sessionDriverCountValue}>
                  {driverEntries.length}
                </span>
              </span>
            )}

            {settings.showWeather && weekendInfo?.TrackAirTemp && (
              <span>Air: {weekendInfo.TrackAirTemp}</span>
            )}

            {settings.showWeather && weekendInfo?.TrackSurfaceTemp && (
              <span>Trk: {weekendInfo.TrackSurfaceTemp}</span>
            )}

            {settings.showSOF && (
              <span className={styles.sofValue}>
                SOF: {formatIRating(overallSof)}
              </span>
            )}
          </div>
        </div>
      )}

      <div ref={tableWrapRef} className={styles.tableWrap}>
        <table className={styles.table}>
          <colgroup>
            <col className={styles.colPos} />
            {settings.showPosChange && <col className={styles.colPosChange} />}
            <col className={styles.colNum} />
            <col className={styles.colName} />{' '}
            {/* Driver name — takes remaining space */}
            {settings.showBrand && <col className={styles.colBrand} />}
            {settings.showTire && <col className={styles.colTire} />}
            {!showGroupHeaders && <col className={styles.colClass} />}
            <col className={styles.colLic} />
            {settings.showIrChange && <col className={styles.colIrChange} />}
            <col className={styles.colInc} />
            {settings.showPitStops && <col className={styles.colStops} />}
            <col className={styles.colGap} />
            <col className={styles.colLap} />
            <col className={styles.colLap} />
          </colgroup>

          {settings.showColumnHeaders && (
            <thead className={styles.thead}>
              <tr>
                <th className={styles.th}>Pos</th>

                {settings.showPosChange && (
                  <th className={`${styles.th} ${styles.thCenter}`}>+/-</th>
                )}

                <th className={styles.th}>#</th>
                <th className={styles.th}>Driver</th>

                {settings.showBrand && (
                  <th className={`${styles.th} ${styles.thCenter}`}>Brand</th>
                )}

                {settings.showTire && (
                  <th className={`${styles.th} ${styles.thCenter}`}>Tire</th>
                )}

                {!showGroupHeaders && (
                  <th className={`${styles.th} ${styles.thCenter}`}>Class</th>
                )}

                <th className={`${styles.th} ${styles.thCenter}`}>Lic / iR</th>

                {settings.showIrChange && (
                  <th
                    className={`${styles.th} ${styles.thCenter}`}
                    title="Projected iR change (Elo estimate, not real iRacing data)"
                  >
                    ΔiR*
                  </th>
                )}

                <th className={`${styles.th} ${styles.thCenter}`}>Inc</th>

                {settings.showPitStops && (
                  <th
                    className={`${styles.th} ${styles.thCenter}`}
                    title="Pit stops (player only — iRacing does not expose this per-driver)"
                  >
                    Stops
                  </th>
                )}

                <th className={`${styles.th} ${styles.thRight}`}>Gap</th>
                <th className={`${styles.th} ${styles.thRight}`}>Last</th>
                <th className={`${styles.th} ${styles.thRight}`}>Best</th>
              </tr>
            </thead>
          )}

          <tbody>
            {displayGroups.map((group) => (
              <ClassGroup
                key={group.className}
                group={group}
                showGroupHeader={showGroupHeaders}
                settings={settings}
                irDeltaMap={irDeltaMap}
                playerPitStops={pitStopsStore.playerStops}
              />
            ))}
          </tbody>
        </table>
      </div>
    </WidgetPanel>
  );
});

const ClassGroup = observer(
  ({
    group,
    showGroupHeader,
    settings,
    irDeltaMap,
    playerPitStops,
  }: {
    group: DriverGroup;
    showGroupHeader: boolean;
    settings: ReturnType<typeof widgetSettingsStore.getStandingsSettings>;
    irDeltaMap: Map<number, number>;
    playerPitStops: number;
  }) => (
    <>
      {showGroupHeader && (
        <tr className={styles.classHeader}>
          <td colSpan={100}>
            <div
              className={styles.classHeaderInner}
              style={{
                background: `linear-gradient(90deg, ${group.classColor}25 0%, rgba(24,24,27,0.5) 40%, transparent 100%)`,
                borderLeft: `3px solid ${group.classColor}`,
              }}
            >
              <div className={styles.classHeaderLeft}>
                <span
                  className={styles.className}
                  style={{
                    color: group.classColor,
                    textShadow: `0 0 12px ${group.classColor}80`,
                  }}
                >
                  {group.classShortName}
                </span>

                <div className={styles.classStats}>
                  <span className={styles.classBadge}>
                    <Trophy size={14} style={{ color: group.classColor }} />
                    SOF
                    <span className={styles.classBadgeValue}>
                      {formatIRating(group.classSof)}
                    </span>
                  </span>

                  <span className={styles.classBadge}>
                    <Users size={14} />
                    <span className={styles.classBadgeValue}>
                      {group.totalDrivers}
                    </span>
                  </span>
                </div>
              </div>

              <div className={styles.classHeaderLine} />
            </div>
          </td>
        </tr>
      )}

      {group.drivers.map((entry) => {
        if (isSeparator(entry)) {
          return (
            <tr key={entry.id} className={styles.separatorRow}>
              <td colSpan={100}>
                <div className={styles.separatorInner}>
                  <div className={styles.separatorLine}>
                    <div className={styles.separatorLineInner} />
                  </div>

                  <div className={styles.separatorDots}>
                    <MoreHorizontal size={16} />
                  </div>
                </div>
              </td>
            </tr>
          );
        }

        return (
          <DriverRow
            key={entry.carIdx}
            driver={entry}
            showGroupHeaders={showGroupHeader}
            settings={settings}
            irDelta={irDeltaMap.get(entry.carIdx)}
            playerPitStops={playerPitStops}
          />
        );
      })}
    </>
  )
);

const DriverRow = observer(
  ({
    driver,
    showGroupHeaders,
    settings,
    irDelta,
    playerPitStops,
  }: {
    driver: DriverEntry;
    showGroupHeaders: boolean;
    settings: ReturnType<typeof widgetSettingsStore.getStandingsSettings>;
    irDelta: number | undefined;
    playerPitStops: number;
  }) => {
    const isPit =
      driver.trackSurface === TRACK_SURFACE_IN_PIT_STALL || driver.onPitRoad;
    const isOffTrack = driver.trackSurface === TRACK_SURFACE_OFF_TRACK;
    const nearDQ = driver.incidents >= NEAR_DQ_INCIDENT_THRESHOLD;
    const pos = showGroupHeaders ? driver.classPosition : driver.position;

    const rowClass = [
      styles.driverRow,
      driver.isPlayer ? styles.driverRowPlayer : '',
      isOffTrack ? styles.driverRowOffTrack : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <tr className={rowClass}>
        <td className={styles.td}>
          <span
            className={`${styles.posCell} ${driver.isPlayer ? styles.posCellPlayer : ''} ${showGroupHeaders ? styles.posCellSmall : ''}`}
          >
            {pos}
          </span>
        </td>

        {settings.showPosChange && (
          <td className={`${styles.td} ${styles.tdCenter}`}>
            <PosChange
              position={pos}
              startPos={
                showGroupHeaders ? driver.startPosClass : driver.startPosOverall
              }
            />
          </td>
        )}

        <td className={styles.td}>
          <span
            className={`${styles.carNumber} ${driver.isPlayer ? styles.carNumberPlayer : ''}`}
          >
            {driver.carNumber}
          </span>
        </td>

        <td className={`${styles.td} ${styles.tdDriverName}`}>
          <div className={styles.driverNameCell}>
            <span
              className={`${styles.driverName} ${driver.isPlayer ? styles.driverNamePlayer : ''}`}
            >
              {driver.userName}
            </span>

            {isPit && <span className={styles.pitBadge}>Pit</span>}
          </div>
        </td>

        {settings.showBrand && (
          <td className={`${styles.td} ${styles.tdCenter}`}>
            <span className={styles.brandLabel} title={driver.carScreenName}>
              {formatBrand(driver.carScreenName)}
            </span>
          </td>
        )}

        {settings.showTire && (
          <td className={`${styles.td} ${styles.tdCenter}`}>
            <TireBadge tire={driver.tireCompound} />
          </td>
        )}

        {!showGroupHeaders && (
          <td className={`${styles.td} ${styles.tdCenter}`}>
            <span
              className={styles.classBadgeInline}
              style={{ backgroundColor: driver.carClassColor }}
            >
              {shortenClassName(driver.carClassShortName)}
            </span>
          </td>
        )}

        <td className={`${styles.td} ${styles.tdCenter}`}>
          <span className={styles.licWrap}>
            <LicenseBadge licString={driver.licString} />
            <span className={styles.irating}>
              {formatIRating(driver.iRating)}
            </span>
          </span>
        </td>

        {settings.showIrChange && (
          <td className={`${styles.td} ${styles.tdCenter}`}>
            <IrChangeCell delta={irDelta} />
          </td>
        )}

        <td className={`${styles.td} ${styles.tdCenter}`}>
          <span className={nearDQ ? styles.incidentsNearDQ : styles.incidents}>
            {driver.incidents}x
          </span>
        </td>

        {settings.showPitStops && (
          <td className={`${styles.td} ${styles.tdCenter}`}>
            {driver.isPlayer ? (
              <span
                className={`${styles.pitStops} ${playerPitStops > 0 ? styles.pitStopsActive : ''}`}
              >
                {playerPitStops}
              </span>
            ) : (
              <span className={styles.pitStops}>—</span>
            )}
          </td>
        )}

        <td className={`${styles.td} ${styles.tdRight}`}>
          {driver.position === 1 ? (
            <span className={styles.gapLeader}>Leader</span>
          ) : driver.f2Time > 0 ? (
            <span className={styles.gapValue}>+{driver.f2Time.toFixed(1)}</span>
          ) : (
            <span className={styles.gapLeader}>-</span>
          )}
        </td>

        <td className={`${styles.td} ${styles.tdRight}`}>
          <span className={styles.lastLap}>
            {isPit
              ? '-'
              : formatLapTime(
                  driver.lastLapTime > 0 ? driver.lastLapTime : null
                )}
          </span>
        </td>

        <td className={`${styles.td} ${styles.tdRight}`}>
          <span className={styles.bestLap}>
            {formatLapTime(driver.bestLapTime > 0 ? driver.bestLapTime : null)}
          </span>
        </td>
      </tr>
    );
  }
);

const PosChange = ({
  position,
  startPos,
}: {
  position: number;
  startPos: number;
}) => {
  if (startPos === 0) {
    return (
      <span className={styles.posChangeNeutral}>
        <Minus size={10} />
      </span>
    );
  }

  const diff = startPos - position;

  if (diff > 0) {
    return (
      <span className={styles.posChangeUp}>
        <ChevronUp size={12} />
        {diff}
      </span>
    );
  }

  if (diff < 0) {
    return (
      <span className={styles.posChangeDown}>
        <ChevronDown size={12} />
        {Math.abs(diff)}
      </span>
    );
  }

  return (
    <span className={styles.posChangeNeutral}>
      <Minus size={10} />
    </span>
  );
};

const IrChangeCell = ({ delta }: { delta: number | undefined }) => {
  if (delta == null || delta === 0) {
    return <span className={styles.irChange}>—</span>;
  }

  const cls =
    delta > 0
      ? `${styles.irChange} ${styles.irChangeUp}`
      : `${styles.irChange} ${styles.irChangeDown}`;

  return (
    <span className={cls}>
      {delta > 0 ? '▲' : '▼'}
      {Math.abs(delta)}
    </span>
  );
};
