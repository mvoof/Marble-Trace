import { useMemo } from 'react';
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
import { useCarIdx, useSession } from '../../../hooks/useIracingData';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { formatLapTime } from '../../../utils/telemetry-format';
import type { Driver } from '../../../types/bindings';

import styles from './StandingsWidget.module.scss';

interface DriverEntry {
  carIdx: number;
  userName: string;
  carNumber: string;
  carClass: string;
  carClassShortName: string;
  carClassColor: string;
  position: number;
  classPosition: number;
  startPos: number;
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

const formatIRating = (ir: number): string => {
  if (ir >= 10000) return `${(ir / 1000).toFixed(1)}k`;
  if (ir >= 1000) return `${(ir / 1000).toFixed(1)}k`;
  return ir.toString();
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
  const carIdx = useCarIdx();
  const { sessionInfo, driverInfo } = useSession();
  const settings = widgetSettingsStore.getStandingsSettings();

  const playerCarIdx = driverInfo?.DriverCarIdx ?? -1;
  const drivers = useMemo(
    (): Driver[] => driverInfo?.Drivers ?? [],
    [driverInfo?.Drivers]
  );

  const driverEntries = useMemo((): DriverEntry[] => {
    if (!carIdx || drivers.length === 0) return [];

    return drivers
      .filter((d) => {
        const idx = d.CarIdx;
        if (d.CarIsPaceCar === 1 || d.IsSpectator === 1) return false;
        if (idx >= carIdx.car_idx_position.length) return false;
        if (carIdx.car_idx_position[idx] <= 0) return false;
        return true;
      })
      .map((d): DriverEntry => {
        const idx = d.CarIdx;

        return {
          carIdx: idx,
          userName: d.UserName,
          carNumber: d.CarNumber,
          carClass: d.CarClassShortName ?? 'Unknown',
          carClassShortName: d.CarClassShortName ?? '?',
          carClassColor: d.CarClassColor
            ? `#${d.CarClassColor.replace(/^0x/i, '')}`
            : '#888888',
          position: carIdx.car_idx_position[idx] ?? 0,
          classPosition: carIdx.car_idx_class_position[idx] ?? 0,
          startPos: d.CarIdx,
          lap: carIdx.car_idx_lap?.[idx] ?? 0,
          lapDistPct: carIdx.car_idx_lap_dist_pct[idx] ?? 0,
          lastLapTime: carIdx.car_idx_last_lap_time?.[idx] ?? -1,
          bestLapTime: carIdx.car_idx_best_lap_time?.[idx] ?? -1,
          f2Time: carIdx.car_idx_f2_time?.[idx] ?? 0,
          trackSurface: carIdx.car_idx_track_surface?.[idx] ?? -1,
          iRating: d.IRating ?? 0,
          licString: d.LicString ?? 'R 0.00',
          licColor: d.LicColor ?? '000000',
          incidents: d.CurDriverIncidentCount ?? 0,
          isPlayer: idx === playerCarIdx,
          onPitRoad: carIdx.car_idx_on_pit_road[idx] ?? false,
        };
      })
      .sort((a, b) => a.position - b.position);
  }, [carIdx, drivers, playerCarIdx]);

  const displayGroups = useMemo((): DriverGroup[] => {
    if (driverEntries.length === 0) return [];

    const groupByClass =
      settings.groupMode === 'class' && settings.viewMode !== 'around-player';

    let groups: DriverGroup[];

    if (groupByClass) {
      const classMap = new Map<string, DriverEntry[]>();

      for (const d of driverEntries) {
        const existing = classMap.get(d.carClass);

        if (existing) {
          existing.push(d);
        } else {
          classMap.set(d.carClass, [d]);
        }
      }

      groups = Array.from(classMap.entries()).map(([cls, driversInClass]) => ({
        className: cls,
        classShortName: driversInClass[0]?.carClassShortName ?? cls,
        classColor: driversInClass[0]?.carClassColor ?? '#888',
        totalDrivers: driversInClass.length,
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
          drivers: [...driverEntries],
        },
      ];
    }

    if (settings.viewMode === 'around-player') {
      const allDrivers = [...driverEntries];
      const playerIdx = allDrivers.findIndex((d) => d.isPlayer);

      if (playerIdx === -1) return [];

      const start = Math.max(0, playerIdx - settings.aroundPlayerCount);
      const end = Math.min(
        allDrivers.length,
        playerIdx + settings.aroundPlayerCount + 1
      );

      return [
        {
          className: 'Overall',
          classShortName: '',
          classColor: '',
          totalDrivers: allDrivers.length,
          drivers: allDrivers.slice(start, end),
        },
      ];
    }

    if (settings.viewMode === 'limit-pin') {
      groups = groups.map((group) => {
        const driversOnly = group.drivers.filter(
          (d) => !isSeparator(d)
        ) as DriverEntry[];

        if (driversOnly.length <= settings.maxRowsPerClass) return group;

        const playerIdx = driversOnly.findIndex((d) => d.isPlayer);
        const visible: (DriverEntry | SeparatorEntry)[] = driversOnly.slice(
          0,
          settings.maxRowsPerClass
        );

        if (playerIdx >= settings.maxRowsPerClass) {
          visible.push({ isSeparator: true, id: `sep-${group.className}` });
          visible.push(driversOnly[playerIdx]);
        }

        return { ...group, drivers: visible };
      });
    }

    return groups;
  }, [driverEntries, settings]);

  const weekendInfo = sessionInfo?.WeekendInfo;
  const sessionData = sessionInfo?.SessionInfo;
  const currentSession =
    sessionData?.Sessions?.[sessionData.CurrentSessionNum ?? 0];
  const showGroupHeaders =
    settings.groupMode === 'class' && settings.viewMode !== 'around-player';

  return (
    <WidgetPanel className={styles.standings} gap={0}>
      {settings.showSessionHeader && (
        <div className={styles.sessionHeader}>
          <div className={styles.sessionLeft}>
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

            {settings.showSOF && weekendInfo?.MinDrivers != null && (
              <span className={styles.sofValue}>
                SOF: {weekendInfo.MinDrivers}
              </span>
            )}
          </div>
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          {settings.showColumnHeaders && (
            <thead className={styles.thead}>
              <tr>
                <th className={styles.th}>Pos</th>
                {settings.showPosChange && (
                  <th className={`${styles.th} ${styles.thCenter}`}>+/-</th>
                )}
                <th className={styles.th}>#</th>
                <th className={styles.th}>Driver</th>
                {!showGroupHeaders && (
                  <th className={`${styles.th} ${styles.thCenter}`}>Class</th>
                )}
                <th className={`${styles.th} ${styles.thCenter}`}>Lic / iR</th>
                <th className={`${styles.th} ${styles.thCenter}`}>Inc</th>
                {settings.showPitStops && (
                  <th className={`${styles.th} ${styles.thCenter}`}>Pit</th>
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
  }: {
    group: DriverGroup;
    showGroupHeader: boolean;
    settings: ReturnType<typeof widgetSettingsStore.getStandingsSettings>;
  }) => (
    <>
      {showGroupHeader && group.classColor && (
        <tr className={styles.classHeader}>
          <td colSpan={100}>
            <div
              className={styles.classHeaderInner}
              style={{
                background: `linear-gradient(90deg, ${group.classColor}25 0%, rgba(10,10,15,0.5) 40%, transparent 100%)`,
                borderLeft: `3px solid ${group.classColor}`,
              }}
            >
              <div className={styles.classHeaderLeft}>
                <span
                  className={styles.className}
                  style={{ color: group.classColor }}
                >
                  {group.classShortName}
                </span>

                <span className={styles.classBadge}>
                  <Trophy size={10} style={{ color: group.classColor }} />
                  <span className={styles.classBadgeValue}>
                    {group.totalDrivers}
                  </span>
                </span>

                <span className={styles.classBadge}>
                  <Users size={10} />
                  <span className={styles.classBadgeValue}>
                    {group.totalDrivers}
                  </span>
                </span>
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
  }: {
    driver: DriverEntry;
    showGroupHeaders: boolean;
    settings: ReturnType<typeof widgetSettingsStore.getStandingsSettings>;
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
            className={`${styles.posCell} ${driver.isPlayer ? styles.posCellPlayer : ''}`}
          >
            {pos}
          </span>
        </td>

        {settings.showPosChange && (
          <td className={`${styles.td} ${styles.tdCenter}`}>
            <PosChange position={pos} startPos={driver.startPos} />
          </td>
        )}

        <td className={styles.td}>
          <span
            className={`${styles.carNumber} ${driver.isPlayer ? styles.carNumberPlayer : ''}`}
          >
            {driver.carNumber}
          </span>
        </td>

        <td className={styles.td}>
          <div className={styles.driverNameCell}>
            <span
              className={`${styles.driverName} ${driver.isPlayer ? styles.driverNamePlayer : ''}`}
            >
              {driver.userName}
            </span>

            {isPit && <span className={styles.pitBadge}>Pit</span>}
          </div>
        </td>

        {!showGroupHeaders && (
          <td className={`${styles.td} ${styles.tdCenter}`}>
            <span
              className={styles.classBadgeInline}
              style={{ backgroundColor: driver.carClassColor }}
            >
              {driver.carClassShortName}
            </span>
          </td>
        )}

        <td className={`${styles.td} ${styles.tdCenter}`}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            <LicenseBadge licString={driver.licString} />
            <span className={styles.irating}>
              {formatIRating(driver.iRating)}
            </span>
          </span>
        </td>

        <td className={`${styles.td} ${styles.tdCenter}`}>
          <span className={nearDQ ? styles.incidentsNearDQ : styles.incidents}>
            {driver.incidents}x
          </span>
        </td>

        {settings.showPitStops && (
          <td className={`${styles.td} ${styles.tdCenter}`}>
            <span className={styles.incidents}>{isPit ? 'In' : '-'}</span>
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
