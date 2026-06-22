import { observer } from 'mobx-react-lite';
import { formatLapTime } from '@utils/formatters/telemetry-format';
import {
  abbreviateName,
  formatBrand,
  formatCarNumber,
  TRACK_SURFACE_IN_PIT_STALL,
  TRACK_SURFACE_OFF_TRACK,
} from '@utils/widget/widget-utils';
import { parseDriverFlags } from '@utils/formatters/flags-utils';
import { PitBadge } from '@/components/shared/PitBadge/PitBadge';
import { DriverFlagBadge } from '@/components/shared/DriverFlagBadge/DriverFlagBadge';
import { LicBadge } from '@/components/shared/RatingBadge/LicBadge';
import { formatIr } from '@/components/shared/RatingBadge/LicBadge.utils';
import { TireBadge } from '@/components/shared/TireBadge/TireBadge';
import {
  buildGridTemplate,
  calculateLapsBehind,
  getStandingsGap,
} from '@utils/widget/standings-utils';
import { PosChange } from './PosChange';
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
}

export const DriverRow = observer(({ carIdx, index }: DriverRowProps) => {
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

  const isPit =
    driver.trackSurface === TRACK_SURFACE_IN_PIT_STALL || driver.onPitRoad;

  const pitState = driver.pitState;
  const flagType = parseDriverFlags(driver.rawFlags);

  const isOffTrack = driver.trackSurface === TRACK_SURFACE_OFF_TRACK;

  const useClassPos = settings.viewMode !== 'all';

  const pos = useClassPos ? driver.classPosition : driver.position;

  const isLeader = pos === 1;

  const rowClass = [
    styles.driverRow,
    driver.isPlayer ? styles.driverRowPlayer : '',
    index % 2 !== 0 ? styles.rowOdd : '',
    isOffTrack ? styles.driverRowOffTrack : '',
  ]
    .filter(Boolean)
    .join(' ');

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

  const gapInfo = getStandingsGap(driver, leader, isRace, isLeader, lapsBehind);

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
      style={{ gridTemplateColumns: gridTemplate }}
      data-driver-row
    >
      <div
        className={`${styles.cell} ${styles.posCell}`}
        style={{
          borderLeft: `3px solid ${driver.carClassColor}`,
          background: `linear-gradient(to right, color-mix(in srgb, ${driver.carClassColor} 20%, transparent), transparent)`,
        }}
      >
        <span
          className={`${styles.posNumber} ${driver.isPlayer ? styles.posNumberPlayer : ''}`}
        >
          {pos}
        </span>
      </div>

      {settings.showPosChange && (
        <div className={`${styles.cell} ${styles.cellCenter}`}>
          <PosChange carIdx={carIdx} />
        </div>
      )}

      <div className={`${styles.cell} ${styles.carNumberCell}`}>
        <span className={styles.carNumber}>#{formattedCarNumber}</span>
      </div>

      <div className={`${styles.cell} ${styles.nameCell}`}>
        {settings.showDriverFlags && flagType !== 'none' && (
          <DriverFlagBadge type={flagType} />
        )}

        <span
          className={`${styles.driverName} ${driver.isPlayer ? styles.driverNamePlayer : ''}`}
        >
          {settings.abbreviateNames
            ? abbreviateName(driver.userName)
            : driver.userName}
        </span>

        {isPit && <PitBadge state={pitState} />}
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
            : formatLapTime(driver.lastLapTime > 0 ? driver.lastLapTime : null)}
        </span>
      </div>

      <div className={`${styles.cell} ${styles.cellRight}`}>
        <span className={styles.bestLap}>
          {formatLapTime(driver.bestLapTime > 0 ? driver.bestLapTime : null)}
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
});
