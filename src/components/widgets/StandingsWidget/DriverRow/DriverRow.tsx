import { observer } from 'mobx-react-lite';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { formatLapTime } from '../../../../utils/telemetry-format';
import {
  formatBrand,
  TRACK_SURFACE_IN_PIT_STALL,
  TRACK_SURFACE_OFF_TRACK,
} from '../../widget-utils';
import { PitBadge } from '../../../shared/primitives/PitBadge/PitBadge';
import { ClassBadge } from '../../../shared/primitives/ClassBadge/ClassBadge';
import { RatingBadge } from '../../../shared/primitives/RatingBadge/RatingBadge';
import { TireBadge } from '../../../shared/primitives/TireBadge/TireBadge';
import { computedStore } from '../../../../store/iracing/computed.store';
import type { StandingsWidgetSettings } from '../../../../types/widget-settings';

import styles from './DriverRow.module.scss';

const abbreviateName = (fullName: string): string => {
  const parts = fullName.trim().split(/\s+/);

  if (parts.length < 2) return fullName;

  return `${parts[0].charAt(0)}. ${parts.slice(1).join(' ')}`;
};

const PosChange = ({
  position,
  startPos,
}: {
  position: number;
  startPos: number;
}) => {
  if (startPos === 0) {
    return <span className={styles.posChangeNeutral}>-</span>;
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

  return <span className={styles.posChangeNeutral}>-</span>;
};

const IrChangeCell = ({ delta }: { delta: number | undefined }) => {
  if (delta == null || delta === 0) {
    return <span className={styles.irChange}>-</span>;
  }

  const cls =
    delta > 0
      ? `${styles.irChange} ${styles.irChangeUp}`
      : `${styles.irChange} ${styles.irChangeDown}`;

  return (
    <span className={cls}>
      {delta > 0 ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      {Math.abs(delta)}
    </span>
  );
};

interface DriverRowProps {
  carIdx: number;
  settings: StandingsWidgetSettings;
  gridTemplate: string;
}

export const DriverRow = observer(
  ({ carIdx, settings, gridTemplate }: DriverRowProps) => {
    const driver = computedStore.driverMap.get(carIdx);

    if (!driver) return null;

    const irDelta = driver.estimatedIrDelta ?? undefined;
    const effectiveStartPos = computedStore.getEffectiveStartPos(carIdx);

    const isPit =
      driver.trackSurface === TRACK_SURFACE_IN_PIT_STALL || driver.onPitRoad;

    const isOffTrack = driver.trackSurface === TRACK_SURFACE_OFF_TRACK;

    const pos = settings.enableClassCycling
      ? driver.classPosition
      : driver.position;

    const startPos = settings.enableClassCycling
      ? effectiveStartPos.class
      : effectiveStartPos.overall;

    const isLeader = pos === 1;

    const rowClass = [
      styles.driverRow,
      driver.isPlayer ? styles.driverRowPlayer : '',
      isOffTrack ? styles.driverRowOffTrack : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div
        className={rowClass}
        style={{ gridTemplateColumns: gridTemplate }}
        data-driver-row
      >
        <div className={styles.cell}>
          <span
            className={`${styles.posCell} ${driver.isPlayer ? styles.posCellPlayer : ''}`}
          >
            {pos}
          </span>
        </div>

        <div
          className={`${styles.cell} ${styles.carNumberCell}`}
          style={{
            borderLeft: `3px solid ${driver.carClassColor}`,
            background: `linear-gradient(to right, ${driver.carClassColor}33, transparent)`,
          }}
        >
          <span
            className={`${styles.carNumber} ${driver.isPlayer ? styles.carNumberPlayer : ''}`}
          >
            {driver.carNumber}
          </span>
        </div>

        <div className={`${styles.cell} ${styles.nameCell}`}>
          <span
            className={`${styles.driverName} ${driver.isPlayer ? styles.driverNamePlayer : ''}`}
          >
            {settings.abbreviateNames
              ? abbreviateName(driver.userName)
              : driver.userName}
          </span>

          {isPit && <PitBadge />}
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

        {!settings.enableClassCycling && settings.showClassBadge && (
          <div className={`${styles.cell} ${styles.cellCenter}`}>
            <ClassBadge
              color={driver.carClassColor}
              label={driver.carClassShortName}
              className={styles.classBadgeFull}
            />
          </div>
        )}

        {settings.showIRatingBadge && (
          <div className={`${styles.cell} ${styles.cellCenter}`}>
            <RatingBadge
              licString={driver.licString}
              iRating={driver.iRating}
              className={styles.ratingBadge}
            />
          </div>
        )}

        {settings.showIrChange && (
          <div className={`${styles.cell} ${styles.cellCenter}`}>
            <IrChangeCell delta={irDelta} />
          </div>
        )}

        {settings.showLapsCompleted && (
          <div className={`${styles.cell} ${styles.cellCenter}`}>
            <span className={styles.lapsCompleted}>{driver.lap}</span>
          </div>
        )}

        {settings.showPosChange && (
          <div className={`${styles.cell} ${styles.cellCenter}`}>
            <PosChange position={pos} startPos={startPos} />
          </div>
        )}

        <div className={`${styles.cell} ${styles.cellRight}`}>
          {isLeader ? (
            <span className={styles.gapLeader}>-</span>
          ) : driver.f2Time > 0 ? (
            <span className={styles.gapValue}>+{driver.f2Time.toFixed(1)}</span>
          ) : (
            <span className={styles.gapLeader}>+--.-</span>
          )}
        </div>

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
          <span className={styles.bestLap}>
            {formatLapTime(driver.bestLapTime > 0 ? driver.bestLapTime : null)}
          </span>
        </div>
      </div>
    );
  }
);
