import type { ReactNode } from 'react';
import { cx } from '@shared/lib/class-names';
import styles from './SettingsCard.module.scss';

interface SettingsCardProps {
  title?: ReactNode;
  /** Controls at the right of the title strip: a filter, an import button. */
  extra?: ReactNode;
  /** In a `CardGrid`, spans the whole row: a list or a table. */
  wide?: boolean;
  children: ReactNode;
}

/** A main-window card: the title in a strip across its top, the content below. */
export const SettingsCard = ({
  title,
  extra,
  wide = false,
  children,
}: SettingsCardProps) => (
  <section className={cx(styles.card, wide && styles.wide)}>
    {(title !== undefined || extra !== undefined) && (
      <header className={styles.cardHeader}>
        {title !== undefined && <h3 className={styles.cardTitle}>{title}</h3>}

        {extra !== undefined && <div className={styles.cardExtra}>{extra}</div>}
      </header>
    )}

    <div className={styles.cardContent}>{children}</div>
  </section>
);
