import type { ReactNode } from 'react';
import styles from './SettingsCard.module.scss';

interface SettingsCardProps {
  title?: ReactNode;
  /** Controls at the right of the title strip: a filter, an import button. */
  extra?: ReactNode;
  children: ReactNode;
}

/** A main-window card: the title in a strip across its top, the content below. */
export const SettingsCard = ({ title, extra, children }: SettingsCardProps) => (
  <section className={styles.card}>
    {(title !== undefined || extra !== undefined) && (
      <header className={styles.cardHeader}>
        {title !== undefined && <h3 className={styles.cardTitle}>{title}</h3>}

        {extra !== undefined && <div className={styles.cardExtra}>{extra}</div>}
      </header>
    )}

    <div className={styles.cardContent}>{children}</div>
  </section>
);
