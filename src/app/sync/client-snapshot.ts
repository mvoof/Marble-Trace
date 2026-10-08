import { pitStrategyOf } from '@entities/app-settings/app-settings.store';
import { widgetsOnMonitor } from '@entities/layout/virtual-desktop';
import { cloneMonitor } from '@shared/lib/remote-screen';
import type { MainRoot } from '@app/roots/main-root';
import type { ClientSnapshot } from '@shared/contracts/client-protocol';
import type {
  LayoutMonitor,
  SavedLayout,
} from '@shared/contracts/widget-settings';

/**
 * What one client draws, as main holds it: one screen of one layout, the
 * widgets standing on it, and the app-level values those widgets read. The
 * same for an overlay and a remote screen (ADR-0007) — which screen, and which
 * layout, is the caller's to say.
 */
export const clientSnapshotFor = (
  root: MainRoot,
  layout: SavedLayout,
  monitor: LayoutMonitor
): ClientSnapshot => {
  const settings = root.appSettings.appSettings;

  return {
    layoutId: layout.id,
    layoutName: layout.name,
    monitor: cloneMonitor(monitor),
    widgets: widgetsOnMonitor(layout.widgets, monitor.name),
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

/**
 * An overlay's snapshot: its monitor of the live layout. Null when the live
 * layout has no such monitor — the window is about to be closed, and there is
 * nothing for it to draw meanwhile.
 *
 * The live layout, never the edited one: an overlay draws what is on screen,
 * which the editor may be holding apart from what it works on.
 */
export const overlaySnapshotFor = (
  root: MainRoot,
  monitorName: string
): ClientSnapshot | null => {
  const layout = root.layouts.liveLayout;
  const monitor = layout?.monitors.find((entry) => entry.name === monitorName);

  return layout && monitor ? clientSnapshotFor(root, layout, monitor) : null;
};

/**
 * Everything a snapshot reads that no settings token moves, for the reactions
 * that republish: a change to any of these, or to `changeToken`, is a new
 * snapshot for every client.
 */
export const snapshotAppInputs = (root: MainRoot): unknown[] => {
  const settings = root.appSettings.appSettings;

  return [
    root.layouts.liveLayoutId,
    settings.hideAllWidgets,
    settings.hideWidgetsWhenGameClosed,
    settings.autoSwitchLayouts,
    root.layouts.sessionLayouts.Garage,
    root.units.unitSystem,
    settings.language,
    settings.steeringLock,
    settings.carLength,
    pitStrategyOf(settings),
    settings.interactHotkeyMode,
    root.bindings.mutationId,
    settings.streamChatHideCommands,
    settings.streamChatIgnoredBots,
  ];
};
