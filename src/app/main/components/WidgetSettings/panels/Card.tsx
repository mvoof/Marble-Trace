import { type ReactNode } from 'react';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';

interface CardProps {
  title?: string;
  children: ReactNode;
}

export const Card = ({ title, children }: CardProps) => (
  <div className={styles.card}>
    {title && <h3 className={styles.cardTitle}>{title}</h3>}
    <div className={styles.cardContent}>{children}</div>
  </div>
);
