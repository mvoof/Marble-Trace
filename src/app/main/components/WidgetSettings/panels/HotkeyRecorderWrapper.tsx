import { HotkeyRecorder } from '@app/main/components/HotkeyRecorder/HotkeyRecorder';
import { useWidgetEditor } from '../WidgetEditorContext';

export const HotkeyRecorderWrapper = ({
  widgetId,
  currentHotkey,
}: {
  widgetId: string;
  currentHotkey: string;
}) => {
  const widgetSettings = useWidgetEditor();

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
