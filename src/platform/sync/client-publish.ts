import { comparer, reaction } from 'mobx';

import {
  emitSnapshotToClient,
  listenToClients,
} from '@platform/services/events.service';
import { pitStrategyOf } from '@store/settings/app-settings.store';
import { listOverlayWindowLabels, monitorLabel } from './overlay-labels';
import { overlaySnapshotFor } from './client-snapshot';
import type { MainRoot } from '@store/main-root';
import type { CommandMessage } from '@/types/client-protocol';

/**
 * Main's half of the client protocol (ADR-0007): main holds the settings, and
 * each overlay is sent a snapshot of its own monitor — on `hello`, and again on
 * every change, coalesced over one frame.
 *
 * An overlay's own drags still come back over `widget-settings-updated` and
 * are applied by `applySettingsSyncForMonitor`, which moves `syncToken` rather
 * than `changeToken` — so they are not echoed back to the overlay mid-drag.
 */

/** One frame: a drag in the editor coalesces into one snapshot per overlay. */
const PUBLISH_DEBOUNCE_MS = 16;

/** The monitor of the live layout a client draws, by its window label. */
const monitorOfClient = (root: MainRoot, clientId: string) =>
  root.layouts.liveLayout?.monitors.find(
    (monitor) => monitorLabel(monitor.name) === clientId
  )?.name;

const publishTo = (root: MainRoot, clientId: string) => {
  const monitorName = monitorOfClient(root, clientId);
  const snapshot = monitorName ? overlaySnapshotFor(root, monitorName) : null;

  if (!snapshot) return;

  void emitSnapshotToClient({ kind: 'snapshot', clientId, snapshot }).catch(
    (error: unknown) =>
      console.error(`[client-publish] snapshot to ${clientId} failed:`, error)
  );
};

const publishToEveryClient = async (root: MainRoot) => {
  const labels = await listOverlayWindowLabels();

  for (const clientId of labels) {
    publishTo(root, clientId);
  }
};

const rejectCommand = (message: CommandMessage, reason: string) => {
  console.warn(
    `[client-publish] command ${message.commandNo} from ${message.clientId} refused: ${reason}`
  );
};

/**
 * Runs one overlay command. Applied without an undo step — the editor's
 * history is the editor's — and only to the live layout the overlay draws.
 */
const applyCommand = (root: MainRoot, message: CommandMessage) => {
  const { liveLayoutId, editingLayoutId } = root.layouts;

  if (message.layoutId !== liveLayoutId) {
    rejectCommand(message, 'its layout is no longer on screen');

    return;
  }

  // The widget store edits the layout the editor holds. While that is another
  // one, the overlay's layout cannot be reached through it.
  if (editingLayoutId !== liveLayoutId) {
    rejectCommand(message, 'the editor holds another layout');

    return;
  }

  const { command } = message;

  switch (command.kind) {
    case 'enableTypeOnMonitor': {
      if (command.monitor !== monitorOfClient(root, message.clientId)) {
        rejectCommand(message, 'a client adds only to its own monitor');

        return;
      }

      root.liveWidgets.setTypeEnabledOnMonitor(
        command.type,
        command.monitor,
        true,
        { recordUndo: false }
      );

      return;
    }
  }
};

/**
 * Listens for the overlays and keeps them supplied. Returns `publishAll` — for
 * the overlays already open when main starts, and for a monitor rearrangement,
 * which changes bounds without touching a settings token — and the disposer.
 *
 * Registered before any overlay window is opened, so no `hello` goes unheard.
 */
export const registerClientPublishing = async (root: MainRoot) => {
  const unlisten = await listenToClients((message) => {
    switch (message.kind) {
      case 'hello': {
        publishTo(root, message.clientId);

        return;
      }

      case 'command': {
        applyCommand(root, message);

        return;
      }
    }
  });

  const disposePublishing = reaction(
    () => {
      const settings = root.appSettings.appSettings;

      return [
        root.settingsMutations.changeToken,
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
    },
    () => void publishToEveryClient(root),
    { delay: PUBLISH_DEBOUNCE_MS, equals: comparer.structural }
  );

  return {
    publishAll: () => publishToEveryClient(root),
    dispose: () => {
      unlisten();
      disposePublishing();
    },
  };
};
