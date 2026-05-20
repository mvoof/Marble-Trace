import { observer } from 'mobx-react-lite';
import { formatLapTime } from '@utils/formatters/telemetry-format';
import {
  abbreviateName,
  formatBrand,
  TRACK_SURFACE_IN_PIT_STALL,
  TRACK_SURFACE_OFF_TRACK,
} from '@utils/widget/widget-utils';
import { PitBadge } from '@/components/shared/primitives/PitBadge/PitBadge';
import { ClassBadge } from '@/components/shared/primitives/ClassBadge/ClassBadge';
import { RatingBadge } from '@/components/shared/primitives/RatingBadge/RatingBadge';
import { TireBadge } from '@/components/shared/primitives/TireBadge/TireBadge';
import { computedStore } from '@store/iracing/computed.store';
import { widgetSettingsStore } from '@store/widget-settings.store';
import { buildGridTemplate } from '@utils/widget/standings-utils';
import { PosChange } from './PosChange';
import { IrChangeCell } from './IrChangeCell';

import styles from './DriverRow.module.scss';

interface DriverRowProps {
  carIdx: number;
}

export const DriverRow = observer(({ carIdx }: DriverRowProps) => {
  const driver = computedStore.driverMap.get(carIdx);
  const settings = widgetSettingsStore.getStandingsSettings();
  const gridTemplate = buildGridTemplate(settings);

  if (!driver) {
    return null;
  }

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
            : formatLapTime(driver.lastLapTime > 0 ? driver.lastLapTime : null)}
        </span>
      </div>

      <div className={`${styles.cell} ${styles.cellRight}`}>
        <span className={styles.bestLap}>
          {formatLapTime(driver.bestLapTime > 0 ? driver.bestLapTime : null)}
        </span>
      </div>
    </div>
  );
});
