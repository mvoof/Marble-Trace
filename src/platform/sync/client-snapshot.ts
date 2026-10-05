import { pitStrategyOf } from '@store/settings/app-settings.store';
import { widgetsOnMonitor } from '@store/settings/virtual-desktop';
import { cloneMonitor } from '@utils/remote-screen';
import type { MainRoot } from '@store/main-root';
import type { OverlaySnapshot } from '@/types/client-protocol';

/**
 * What one overlay draws, as main holds it: the monitor named, the widgets
 * standing on it in the live layout, and the app-level values those widgets
 * read. Null when the live layout has no such monitor — the window is about to
 * be closed, and there is nothing for it to draw meanwhile.
 *
 * Reads the live layout, never the edited one: an overlay draws what is on
 * screen, which the editor may be holding apart from what it works on.
 */
export const overlaySnapshotFor = (
  root: MainRoot,
  monitorName: string
): OverlaySnapshot | null => {
  const layout = root.layouts.liveLayout;
  const monitor = layout?.monitors.find((entry) => entry.name === monitorName);

  if (!layout || !monitor) return null;

  const settings = root.appSettings.appSettings;

  return {
    layoutId: layout.id,
    layoutName: layout.name,
    monitor: cloneMonitor(monitor),
    widgets: widgetsOnMonitor(root.liveWidgets.liveWidgets, monitorName),
    hideAllWidgets: settings.hideAllWidgets,
    hideWidgetsWhenGameClosed: settings.hideWidgetsWhenGameClosed,
    hidesOffTrack:
      settings.autoSwitchLayouts && !root.layouts.sessionLayouts.Garage,
    units: root.units.unitSystem,
    language: settings.language,
    steeringLock: settings.steeringLock,
    carLength: settings.carLength,
    pitStrategy: pitStrategyOf(settings),
    interactHotkeyMode: settings.interactHotkeyMode,
    // Overrides, not the effective map: the overlay layers the same registry
    // defaults underneath.
    bindings: root.bindings.overrides,
    streamChatHideCommands: settings.streamChatHideCommands,
    streamChatIgnoredBots: settings.streamChatIgnoredBots,
    settingsLocked: root.appSettings.settingsLocked,
  };
};
