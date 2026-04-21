import { WidgetPanel } from '../primitives/WidgetPanel';

import styles from './TimerWidget.module.scss';

export type FlagState = 'green' | 'final' | 'checkered';

const FLAG_LABEL: Record<FlagState, string> = {
  green: 'GREEN',
  final: 'FINAL 5 MIN',
  checkered: 'CHECKERED',
};

const FLAG_CLASS: Record<FlagState, string> = {
  green: styles.flagGreen,
  final: styles.flagFinal,
  checkered: styles.flagCheckered,
};

interface TimerWidgetProps {
  sessionTypeLabel: string;
  flagState: FlagState;
  timeMain: string;
  timeSeconds: string;
  currentLap: number | null;
  totalLaps: string | null;
  position: number | null;
  totalDrivers: number | null;
}

const formatLapCount = (
  current: number | null,
  total: string | null
): string => {
  const cur = current !== null ? current : '—';
  const tot = total && total.toLowerCase() !== 'unlimited' ? total : '∞';
  return `LAP ${cur}/${tot}`;
};

const formatPosition = (pos: number | null, total: number | null): string => {
  if (pos === null) return 'POS —';
  const totStr = total !== null ? `/${total}` : '';
  return `POS P${pos}${totStr}`;
};

export const TimerWidget = ({
  sessionTypeLabel,
  flagState,
  timeMain,
  timeSeconds,
  currentLap,
  totalLaps,
  position,
  totalDrivers,
}: TimerWidgetProps) => (
  <WidgetPanel direction="column" gap={0} minWidth={180}>
    <div className={styles.header}>
      <span className={styles.sessionLabel}>{sessionTypeLabel}</span>
      <span className={`${styles.flagLabel} ${FLAG_CLASS[flagState]}`}>
        ● {FLAG_LABEL[flagState]}
      </span>
    </div>

    <div className={styles.timeDisplay}>
      <span className={styles.timeMain}>{timeMain}</span>
      <span className={styles.timeSeconds}>{timeSeconds}</span>
    </div>

    <div className={styles.footer}>
      <span className={styles.footerItem}>
        {formatLapCount(currentLap, totalLaps)}
      </span>
      <span className={styles.footerItem}>
        {formatPosition(position, totalDrivers)}
      </span>
    </div>
  </WidgetPanel>
);
