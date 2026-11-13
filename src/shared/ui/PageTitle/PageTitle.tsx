import type { ReactNode } from 'react';

import styles from './PageTitle.module.scss';

interface PageTitleProps {
  title: ReactNode;
  /** A short muted note beside the title: a count, what the page is for. */
  subtitle?: ReactNode;
  /** Controls at the right end of the title row. */
  actions?: ReactNode;
}

/** A main-window page's title row: the name, a note beside it, actions at the right. */
export const PageTitle = ({ title, subtitle, actions }: PageTitleProps) => (
  <div className={styles.row}>
    <h1 className={styles.title}>{title}</h1>

    {subtitle !== undefined && (
      <span className={styles.subtitle}>{subtitle}</span>
    )}

    {actions !== undefined && <div className={styles.actions}>{actions}</div>}
  </div>
);
