import { type CSSProperties, type ReactNode } from 'react';
import styles from '@features/widget-settings/WidgetSettings.module.scss';

interface SettingRowProps {
  title: string;
  desc?: string;
  /** Control below the texts rather than beside them, for a narrow column. */
  stacked?: boolean;
  style?: CSSProperties;
  children: ReactNode;
}

export const SettingRow = ({
  title,
  desc,
  stacked = false,
  style,
  children,
}: SettingRowProps) => (
  <div
    className={`${styles.fieldRow} ${stacked ? styles.fieldRowStacked : ''}`}
    style={style}
  >
    <div className={styles.fieldTexts}>
      <div className={styles.fieldTitle}>{title}</div>
      {desc && <div className={styles.fieldDesc}>{desc}</div>}
    </div>
    {children}
  </div>
);
