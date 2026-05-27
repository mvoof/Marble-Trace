import { type CSSProperties, type ReactNode } from 'react';
import { HotkeyRecorder } from '@app/main/components/HotkeyRecorder/HotkeyRecorder';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { useWidgetSettingsStore } from '@store/root-store-context';
import type { LapDeltaReference } from '@/types/widget-settings';

export const DELTA_REFERENCE_DESC: Record<LapDeltaReference, string> = {
  personal_best: 'Your best clean lap this session.',
  personal_optimal:
    'Your theoretical best — fastest sector from each of your laps combined.',
  session_best: 'Fastest lap set by any driver in the current session.',
  session_optimal:
    'Theoretical best — fastest sector from any driver in the session combined.',
  session_last: 'Last fully completed lap by any driver in the session.',
};

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
  const widgetSettings = useWidgetSettingsStore();

  return (
    <HotkeyRecorder
      label="Toggle Hotkey"
      currentHotkey={currentHotkey}
      onApply={(key: string) =>
        widgetSettings.updateUserSettings(widgetId, { hotkey: key })
      }
    />
  );
};
