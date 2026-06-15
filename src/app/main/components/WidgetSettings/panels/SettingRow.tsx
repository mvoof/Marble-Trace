import { type CSSProperties, type ReactNode } from 'react';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';

interface SettingRowProps {
  title: string;
  desc?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export const SettingRow = ({
  title,
  desc,
  style,
  children,
}: SettingRowProps) => (
  <div className={styles.fieldRow} style={style}>
    <div className={styles.fieldTexts}>
      <div className={styles.fieldTitle}>{title}</div>
      {desc && <div className={styles.fieldDesc}>{desc}</div>}
    </div>
    {children}
  </div>
);
