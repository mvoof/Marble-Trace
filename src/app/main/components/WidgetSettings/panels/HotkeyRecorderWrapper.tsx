import { HotkeyRecorder } from '@app/main/components/HotkeyRecorder/HotkeyRecorder';
import { useWidgetSettingsStore } from '@store/root-store-context';

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
