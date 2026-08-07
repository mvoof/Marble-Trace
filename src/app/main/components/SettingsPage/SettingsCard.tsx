import type { ReactNode } from 'react';
import styles from './SettingsPage.module.scss';

interface SettingsCardProps {
  title?: string;
  children: ReactNode;
}

export const SettingsCard = ({ title, children }: SettingsCardProps) => (
  <div className={styles.card}>
    {title && <h3 className={styles.cardTitle}>{title}</h3>}

    <div className={styles.cardContent}>{children}</div>
  </div>
);
