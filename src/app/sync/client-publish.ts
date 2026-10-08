import { comparer, observable, reaction, runInAction } from 'mobx';

import {
  emitSnapshotToClient,
  listenToClients,
} from '@shared/api/events.service';
import { listOverlayWindowLabels, monitorLabel } from './overlay-labels';
import { overlaySnapshotFor, snapshotAppInputs } from './client-snapshot';
import type { MainRoot } from '@app/roots/main-root';
import type { RejectedCommand } from '@shared/contracts/bindings';
import type {
  ClientCommand,
  CommandMessage,
} from '@shared/contracts/client-protocol';

/**
 * Main's half of the client protocol (ADR-0007): main holds the settings, each
 * overlay is sent a snapshot of its own monitor — on `hello`, and again on
 * every change, coalesced over one frame — and an overlay changes a setting
 * only by sending a command, which is applied here.
 */

/** One frame: a drag in the editor coalesces into one snapshot per overlay. */
const PUBLISH_DEBOUNCE_MS = 16;

/** What main remembers of one client between its snapshots. */
interface ClientState {
  lastHandledCommandNo: number;
  /** Refusals not yet reported in a snapshot. */
  rejected: RejectedCommand[];
}

/** The monitor of the live layout a client draws, by its window label. */
const monitorOfClient = (root: MainRoot, clientId: string) =>
  root.layouts.liveLayout?.monitors.find(
    (monitor) => monitorLabel(monitor.name) === clientId
  )?.name;

/**
 * Whether a command addressing one widget may touch it: the widget stands in
 * the live layout, on the monitor of the client that sent it. A window speaks
 * only for its own screen; a widget main has just moved elsewhere is not its
 * to change any more.
 */
const isClientsWidget = (
  root: MainRoot,
  widgetId: string,
  monitorName: string
): boolean =>
  root.liveWidgets.applyClientCommand(
    () => root.liveWidgets.getWidget(widgetId)?.monitor === monitorName
  );

/**
 * Runs one command, or says why it cannot. Applied through the editor's own
 * methods in client-command mode: against the live layout, no undo step.
 */
const runCommand = (
  root: MainRoot,
  command: ClientCommand,
  monitorName: string
): string | null => {
  const { liveWidgets } = root;

  switch (command.kind) {
    case 'setGeometry': {
      if (!isClientsWidget(root, command.widgetId, monitorName)) {
        return 'the widget is not on this monitor';
      }

      liveWidgets.applyClientCommand(() => {
        if (command.width !== undefined && command.height !== undefined) {
          liveWidgets.updateSize(
            command.widgetId,
            command.width,
            command.height
          );
        }

        liveWidgets.updatePosition(command.widgetId, command.x, command.y);
      });

      return null;
    }

    case 'setEnabled': {
      if (!isClientsWidget(root, command.widgetId, monitorName)) {
        return 'the widget is not on this monitor';
      }

      liveWidgets.applyClientCommand(() =>
        liveWidgets.setWidgetEnabled(command.widgetId, command.enabled)
      );

      return null;
    }

    case 'enableTypeOnMonitor': {
      if (command.monitor !== monitorName) {
        return 'a client adds only to its own monitor';
      }

      liveWidgets.applyClientCommand(() =>
        liveWidgets.setTypeEnabledOnMonitor(command.type, command.monitor, true)
      );

      return null;
    }

    case 'patchSettings': {
      if (!isClientsWidget(root, command.widgetId, monitorName)) {
        return 'the widget is not on this monitor';
      }

      liveWidgets.applyClientCommand(() =>
        liveWidgets.updateUserSettings(command.widgetId, command.partial)
      );

      return null;
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
  // Observable so that handling a command — a refusal changes no setting —
  // still sends the client the snapshot that acknowledges it.
  const clients = observable.map<string, ClientState>();

  const stateOf = (clientId: string): ClientState => {
    const known = clients.get(clientId);

    if (known) return known;

    const fresh: ClientState = { lastHandledCommandNo: 0, rejected: [] };

    clients.set(clientId, fresh);

    return clients.get(clientId)!;
  };

  const publishTo = (clientId: string) => {
    const monitorName = monitorOfClient(root, clientId);
    const snapshot = monitorName ? overlaySnapshotFor(root, monitorName) : null;

    if (!snapshot) return;

    const state = stateOf(clientId);
    const { lastHandledCommandNo, rejected } = state;

    runInAction(() => {
      state.rejected = [];
    });

    void emitSnapshotToClient({
      kind: 'snapshot',
      clientId,
      lastHandledCommandNo,
      rejected,
      snapshot,
    }).catch((error: unknown) =>
      console.error(`[client-publish] snapshot to ${clientId} failed:`, error)
    );
  };

  const publishAll = async () => {
    const labels = await listOverlayWindowLabels();

    for (const clientId of labels) {
      publishTo(clientId);
    }
  };

  const reject = (message: CommandMessage, reason: string) => {
    console.warn(
      `[client-publish] command ${message.commandNo} from ${message.clientId} refused: ${reason}`
    );

    stateOf(message.clientId).rejected.push({
      commandNo: message.commandNo,
      reason,
    });
  };

  const handleCommand = (message: CommandMessage) => {
    const monitorName = monitorOfClient(root, message.clientId);

    runInAction(() => {
      if (message.layoutId !== root.layouts.liveLayoutId || !monitorName) {
        reject(message, 'its layout is no longer on screen');
      } else {
        const reason = runCommand(root, message.command, monitorName);

        if (reason) {
          reject(message, reason);
        }
      }

      stateOf(message.clientId).lastHandledCommandNo = message.commandNo;
    });
  };

  const unlisten = await listenToClients((message) => {
    switch (message.kind) {
      case 'hello': {
        // A window that starts over counts from 1 again; a number left from
        // before its reload must not acknowledge its new commands.
        runInAction(() => {
          clients.set(message.clientId, {
            lastHandledCommandNo: 0,
            rejected: [],
          });
        });

        publishTo(message.clientId);

        return;
      }

      case 'command': {
        handleCommand(message);

        return;
      }
    }
  });

  const disposePublishing = reaction(
    () => [
      root.settingsMutations.changeToken,
      ...snapshotAppInputs(root),
      Array.from(clients.values(), (state) => state.lastHandledCommandNo),
    ],
    () => void publishAll(),
    { delay: PUBLISH_DEBOUNCE_MS, equals: comparer.structural }
  );

  return {
    publishAll,
    dispose: () => {
      unlisten();
      disposePublishing();
    },
  };
};
