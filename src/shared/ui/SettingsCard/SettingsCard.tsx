import type { ReactNode } from 'react';
import styles from './SettingsCard.module.scss';

interface SettingsCardProps {
  title?: string;
  /** Controls beside the title: a filter, an import button. */
  extra?: ReactNode;
  children: ReactNode;
}

export const SettingsCard = ({ title, extra, children }: SettingsCardProps) => (
  <div className={styles.card}>
    {(title || extra) && (
      <div className={styles.cardHeader}>
        {title && <h3 className={styles.cardTitle}>{title}</h3>}

        {extra}
      </div>
    )}

    <div className={styles.cardContent}>{children}</div>
  </div>
);
