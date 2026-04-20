import { ChevronUp, ChevronDown, Minus } from 'lucide-react';
import { formatLapTime } from '../../../../utils/telemetry-format';
import {
  formatBrand,
  TRACK_SURFACE_IN_PIT_STALL,
  TRACK_SURFACE_OFF_TRACK,
  NEAR_DQ_INCIDENT_THRESHOLD,
} from '../../widget-utils';
import { PitBadge, ClassBadge, LicenseBadge } from '../../primitives';
import type { DriverEntry } from '../../widget-utils';
import type { StandingsWidgetSettings } from '../../../../store/widget-settings.store';

import styles from './DriverRow.module.scss';

const TIRE_CLASS_MAP: Record<string, string> = {
  S: styles.tireSoft,
  M: styles.tireMed,
  H: styles.tireHard,
  W: styles.tireWet,
};

const TireBadge = ({ tire }: { tire: string }) => {
  if (!tire) return <span className={styles.tireEmpty}>-</span>;
  const code = tire.charAt(0).toUpperCase();
  const cls = TIRE_CLASS_MAP[code] ?? styles.tireMed;
  return <span className={`${styles.tireBadge} ${cls}`}>{code}</span>;
};

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

const formatIRating = (ir: number): string => {
  if (ir >= 1000) return `${(ir / 1000).toFixed(1)}k`;
  return ir.toString();
};

interface DriverRowProps {
  driver: DriverEntry;
  showGroupHeaders: boolean;
  settings: StandingsWidgetSettings;
  irDelta: number | undefined;
  playerPitStops: number;
}

export const DriverRow = ({
  driver,
  showGroupHeaders,
  settings,
  irDelta,
  playerPitStops,
}: DriverRowProps) => {
  const isPit =
    driver.trackSurface === TRACK_SURFACE_IN_PIT_STALL || driver.onPitRoad;
  const isOffTrack = driver.trackSurface === TRACK_SURFACE_OFF_TRACK;
  const nearDQ = driver.incidents >= NEAR_DQ_INCIDENT_THRESHOLD;
  const pos = showGroupHeaders ? driver.classPosition : driver.position;
  const isLeader = showGroupHeaders
    ? driver.classPosition === 1
    : driver.position === 1;

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

          {isPit && <PitBadge />}
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
          <ClassBadge
            color={driver.carClassColor}
            label={driver.carClassShortName}
          />
        </td>
      )}

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
