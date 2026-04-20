import { WidgetPanel } from '../primitives/WidgetPanel';

import styles from './TimerWidget.module.scss';

interface TimerWidgetProps {
  displayTime: string;
  sessionTypeLabel: string;
  isCountdown: boolean;
}

export const TimerWidget = ({
  displayTime,
  sessionTypeLabel,
  isCountdown,
}: TimerWidgetProps) => (
  <WidgetPanel direction="column" gap={2} minWidth={180}>
    <div className={styles.timeRow}>
      <span className={styles.countdownLabel}>
        {isCountdown ? 'REMAINING' : 'ELAPSED'}
      </span>
      <span className={styles.time}>{displayTime}</span>
    </div>
    <span className={styles.sessionLabel}>{sessionTypeLabel}</span>
  </WidgetPanel>
);
