import { type CSSProperties, type ReactNode } from 'react';
import { HotkeyRecorder } from '../../../../../components/shared/HotkeyRecorder/HotkeyRecorder';
import { widgetSettingsStore } from '../../../../../store/widget-settings.store';
import styles from '../WidgetSettings.module.scss';

interface CardProps {
  title?: string;
  children: ReactNode;
}

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

export const Card = ({ title, children }: CardProps) => (
  <div className={styles.card}>
    {title && <h3 className={styles.cardTitle}>{title}</h3>}
    <div className={styles.cardContent}>{children}</div>
  </div>
);

export const HotkeyRecorderWrapper = ({
  widgetId,
  currentHotkey,
}: {
  widgetId: string;
  currentHotkey: string;
}) => {
  return (
    <HotkeyRecorder
      label="Toggle Hotkey"
      currentHotkey={currentHotkey}
      onApply={(key: string) =>
        widgetSettingsStore.updateUserSettings(widgetId, { hotkey: key })
      }
    />
  );
};
