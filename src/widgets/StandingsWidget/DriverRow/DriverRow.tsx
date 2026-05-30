import { observer } from 'mobx-react-lite';
import { formatLapTime } from '@utils/formatters/telemetry-format';
import {
  abbreviateName,
  formatBrand,
  TRACK_SURFACE_IN_PIT_STALL,
  TRACK_SURFACE_OFF_TRACK,
} from '@utils/widget/widget-utils';
import { PitBadge } from '@/components/shared/PitBadge/PitBadge';
import { ClassBadge } from '@/components/shared/ClassBadge/ClassBadge';
import { RatingBadge } from '@/components/shared/RatingBadge/RatingBadge';
import { TireBadge } from '@/components/shared/TireBadge/TireBadge';
import { buildGridTemplate } from '@utils/widget/standings-utils';
import { PosChange } from './PosChange';
import { IrChangeCell } from './IrChangeCell';

import type { StandingsWidgetSettings } from '@/types/widget-settings';
import styles from './DriverRow.module.scss';
import {
  useBackendComputedStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

interface DriverRowProps {
  carIdx: number;
  index: number;
}

export const DriverRow = observer(({ carIdx, index }: DriverRowProps) => {
  const computed = useBackendComputedStore();
  const widgetSettings = useWidgetSettingsStore();

  const driver = computed.driverMap.get(carIdx);
  const settings =
    widgetSettings.getSettings<StandingsWidgetSettings>('standings');
  const gridTemplate = buildGridTemplate(settings);

  if (!driver) {
    return null;
  }

  const isPit =
    driver.trackSurface === TRACK_SURFACE_IN_PIT_STALL || driver.onPitRoad;

  const isOffTrack = driver.trackSurface === TRACK_SURFACE_OFF_TRACK;

  const pos = settings.enableClassCycling
    ? driver.classPosition
    : driver.position;

  const isLeader = pos === 1;

  const rowClass = [
    styles.driverRow,
    driver.isPlayer ? styles.driverRowPlayer : '',
    index % 2 !== 0 ? styles.rowOdd : '',
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
          <IrChangeCell carIdx={carIdx} />
        </div>
      )}

      {settings.showLapsCompleted && (
        <div className={`${styles.cell} ${styles.cellCenter}`}>
          <span className={styles.lapsCompleted}>{driver.lap}</span>
        </div>
      )}

      {settings.showPosChange && (
        <div className={`${styles.cell} ${styles.cellCenter}`}>
          <PosChange carIdx={carIdx} />
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
