import { WidgetPanel } from '../primitives/WidgetPanel';

import styles from './SessionWidget.module.scss';

interface SessionWidgetProps {
  sessionTypeLabel: string;
  contextLabel: string;
  contextValue: string;
}

export const SessionWidget = ({
  sessionTypeLabel,
  contextLabel,
  contextValue,
}: SessionWidgetProps) => (
  <WidgetPanel direction="column" gap={4} minWidth={200}>
    <div className={styles.header}>
      <span className={styles.sessionType}>{sessionTypeLabel}</span>
    </div>

    <div className={styles.body}>
      <span className={styles.contextLabel}>{contextLabel}</span>
      <span className={styles.contextValue}>{contextValue}</span>
    </div>
  </WidgetPanel>
);
