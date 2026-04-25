import { ChevronUp, ChevronDown, Minus } from 'lucide-react';

const abbreviateName = (fullName: string): string => {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return fullName.toUpperCase();
  return `${parts[0].charAt(0)}. ${parts.slice(1).join(' ')}`.toUpperCase();
};
import { formatLapTime } from '../../../../utils/telemetry-format';
import {
  formatBrand,
  formatIRating,
  TRACK_SURFACE_IN_PIT_STALL,
  TRACK_SURFACE_OFF_TRACK,
  NEAR_DQ_INCIDENT_THRESHOLD,
} from '../../widget-utils';
import {
  PitBadge,
  ClassBadge,
  LicenseBadge,
  TireBadge,
} from '../../primitives';
import type { DriverEntry } from '../../../../types/bindings';
import type { StandingsWidgetSettings } from '../../../../types/widget-settings';

import styles from './DriverRow.module.scss';

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

interface DriverRowProps {
  driver: DriverEntry;
  settings: StandingsWidgetSettings;
  irDelta: number | undefined;
  playerPitStops: number;
}

export const DriverRow = ({
  driver,
  settings,
  irDelta,
  playerPitStops,
}: DriverRowProps) => {
  const isPit =
    driver.trackSurface === TRACK_SURFACE_IN_PIT_STALL || driver.onPitRoad;
  const isOffTrack = driver.trackSurface === TRACK_SURFACE_OFF_TRACK;
  const nearDQ = driver.incidents >= NEAR_DQ_INCIDENT_THRESHOLD;

  const pos = settings.enableClassCycling
    ? driver.classPosition
    : driver.position;
  const startPos = settings.enableClassCycling
    ? driver.startPosClass
    : driver.startPosOverall;
  const isLeader = pos === 1;

  const rowClass = [
    styles.driverRow,
    driver.isPlayer ? styles.driverRowPlayer : '',
    isOffTrack ? styles.driverRowOffTrack : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <tr className={rowClass} data-driver-row>
      <td className={styles.td}>
        <span
          className={`${styles.posCell} ${driver.isPlayer ? styles.posCellPlayer : ''}`}
        >
          {pos}
        </span>
      </td>

      {settings.showPosChange && (
        <td className={`${styles.td} ${styles.tdCenter}`}>
          <PosChange position={pos} startPos={startPos} />
        </td>
      )}

      <td className={`${styles.td} ${styles.tdDriverName}`}>
        <div className={styles.driverNameCell}>
          <span
            className={`${styles.driverName} ${driver.isPlayer ? styles.driverNamePlayer : ''}`}
          >
            {settings.abbreviateNames
              ? abbreviateName(driver.userName)
              : driver.userName}
          </span>

          {isPit && <PitBadge />}
        </div>
      </td>

      <td className={styles.td}>
        <span
          className={`${styles.carNumber} ${driver.isPlayer ? styles.carNumberPlayer : ''}`}
        >
          {driver.carNumber}
        </span>
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

      {!settings.enableClassCycling && settings.showClassBadge && (
        <td className={`${styles.td} ${styles.tdCenter}`}>
          <ClassBadge
            color={driver.carClassColor}
            label={driver.carClassShortName}
            className={styles.classBadgeFull}
          />
        </td>
      )}

      {settings.showIRatingBadge && (
        <td className={`${styles.td} ${styles.tdCenter}`}>
          <span className={styles.licWrap}>
            <LicenseBadge
              licString={driver.licString}
              className={styles.licBadge}
            />
            <span className={styles.irating}>
              {formatIRating(driver.iRating)}
            </span>
          </span>
        </td>
      )}

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

      {settings.showLapsCompleted && (
        <td className={`${styles.td} ${styles.tdCenter}`}>
          <span className={styles.lapsCompleted}>{driver.lap}</span>
        </td>
      )}

      <td className={`${styles.td} ${styles.tdRight}`}>
        {isLeader ? (
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
            : formatLapTime(driver.lastLapTime > 0 ? driver.lastLapTime : null)}
        </span>
      </td>

      <td className={`${styles.td} ${styles.tdRight}`}>
        <span className={styles.bestLap}>
          {formatLapTime(driver.bestLapTime > 0 ? driver.bestLapTime : null)}
        </span>
      </td>
    </tr>
  );
};
