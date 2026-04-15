import { useEffect } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { widgetSettingsStore } from '../../store/widget-settings.store';
import { unitsStore } from '../../store/units.store';
import { appSettingsStore } from '../../store/app-settings.store';
import { useWidgetTelemetry } from '../../hooks/useWidgetTelemetry';
import { OverlayCanvas } from '../../components/OverlayCanvas';

export const OverlayPage = () => {
  useWidgetTelemetry();

  useEffect(() => {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';

    // Immediately pass clicks through to the game by default.
    // OverlayCanvas will toggle this when drag mode changes.
    getCurrentWebviewWindow().setIgnoreCursorEvents(true).catch(console.error);

    const init = async () => {
      await widgetSettingsStore.loadSettings();
      await unitsStore.loadSettings();
      await widgetSettingsStore.initOverlayListener();
      await unitsStore.initOverlayListener();
      await appSettingsStore.initOverlayListener();
    };

    init();

    return () => {
      widgetSettingsStore.disposeOverlayListener();
      unitsStore.disposeOverlayListener();
      appSettingsStore.disposeOverlayListener();
    };
  }, []);

  return <OverlayCanvas />;
};
