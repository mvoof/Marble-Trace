import { type ReactNode } from 'react';
import { HotkeyRecorder } from '../../../../../components/shared/HotkeyRecorder';
import { widgetSettingsStore } from '../../../../../store/widget-settings.store';
import styles from '../WidgetSettings.module.scss';

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
        widgetSettingsStore.updateField(widgetId, 'hotkey', key)
      }
    />
  );
};
