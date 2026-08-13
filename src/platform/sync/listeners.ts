import { runInAction } from 'mobx';

import {
  listenTo,
  type HalvesTakenOver,
  type MonitorWidgetsPayload,
  type StreamChatFilters,
  type UnlistenFn,
} from '@platform/services/events.service';
import type { AppLanguage, UnitSystem } from '@/types';
import type { SessionContext } from '@/types/widget-settings';
import type { RootStore } from '@store/root-store';
import type { BindingMap } from '@/types/input-bindings';

/**
 * Subscribes a window's stores to the events the other one sends. The transport
 * itself lives in `services/events.service.ts`; this is the wiring that knows
 * which store each payload belongs to.
 */

type SessionLayoutMap = Record<SessionContext, string | null>;

export const setupMainListeners = async (
  root: RootStore
): Promise<UnlistenFn[]> => {
  const unlistens: UnlistenFn[] = [];

  unlistens.push(
    await listenTo<boolean>('drag-mode-changed', (e) => {
      runInAction(() => root.appSettings.setDragMode(e.payload));
    })
  );

  unlistens.push(await listenPitServiceAutoSuspended(root));
  unlistens.push(await listenPitServiceHalvesTakenOver(root));

  return unlistens;
};

/**
 * Auto mode stands down for the rest of a stop as soon as the driver touches
 * the order — and that touch can land in either window: the checkboxes are
 * clicked in the overlay, the hotkeys are registered in main. Both windows
 * mirror the flag so the AUTO / MANUAL badge and the pit entry trigger agree.
 */
const listenPitServiceAutoSuspended = (root: RootStore) =>
  listenTo<boolean>('pit-service-auto-suspended', (e) => {
    runInAction(() => root.pitServiceWidget.setAutoSuspended(e.payload));
  });

/**
 * Which halves of the order are already settled, for the same reason: a fuel
 * nudge from a hotkey in main and a tire checkbox clicked in the overlay each
 * claim one half, and both windows draw the badges off the result.
 */
const listenPitServiceHalvesTakenOver = (root: RootStore) =>
  listenTo<HalvesTakenOver>('pit-service-halves-taken-over', (e) => {
    runInAction(() =>
      root.pitServiceWidget.setHalvesTakenOver(e.payload.fuel, e.payload.tires)
    );
  });

export const setupOverlayListeners = async (
  root: RootStore
): Promise<UnlistenFn[]> => {
  const unlistens: UnlistenFn[] = [];

  unlistens.push(
    await listenTo<boolean>('drag-mode-changed', (e) => {
      runInAction(() => root.appSettings.setDragMode(e.payload));
    })
  );

  unlistens.push(
    await listenTo<boolean>('hide-all-widgets-changed', (e) => {
      runInAction(() => {
        root.appSettings.appSettings.hideAllWidgets = e.payload;
      });
    })
  );

  unlistens.push(
    await listenTo<boolean>('hide-widgets-when-game-closed-changed', (e) => {
      runInAction(() => {
        root.appSettings.appSettings.hideWidgetsWhenGameClosed = e.payload;
      });
    })
  );

  unlistens.push(
    await listenTo<UnitSystem>('units-changed', (e) => {
      runInAction(() => root.units.setSystem(e.payload));
    })
  );

  unlistens.push(
    await listenTo<number>('steering-lock-changed', (e) => {
      runInAction(() => root.appSettings.setSteeringLock(e.payload));
    })
  );

  unlistens.push(
    await listenTo<AppLanguage>('language-changed', (e) => {
      root.appSettings.setLanguage(e.payload);
    })
  );

  // The overlay renders the chat, so it needs the source-level filters even
  // though it never opens a connection itself.
  unlistens.push(
    await listenTo<StreamChatFilters>('stream-chat-filters-changed', (e) => {
      runInAction(() => {
        root.appSettings.setStreamChatHideCommands(e.payload.hideCommands);
        root.appSettings.setStreamChatIgnoredBots(e.payload.ignoredBots);
      });
    })
  );

  // The connectors live in main, so only main knows when the feed was shut
  // down; the overlay drops its own buffer on that signal.
  unlistens.push(
    await listenTo('stream-chat-cleared', () => {
      runInAction(() => root.chat.reset());
    })
  );

  unlistens.push(
    await listenTo<MonitorWidgetsPayload>('widget-settings-updated', (e) => {
      if (e.payload.monitorName !== root.widgetSettings.ownMonitorName) return;

      if (e.payload.monitors) {
        root.widgetSettings.applyMonitorsSync(e.payload.monitors);
      }

      root.widgetSettings.applySettingsSync(e.payload.widgets);
    })
  );

  unlistens.push(
    await listenTo<number>('standings-class-index-changed', (e) => {
      runInAction(() => {
        root.standingsWidget.activeClassIndex = e.payload;
      });
    })
  );

  // Scroll travels as a delta rather than an offset: only the overlay knows how
  // many rows fit and how long the target list is, so only it can clamp.
  unlistens.push(
    await listenTo<number>('standings-scroll', (e) => {
      runInAction(() => root.standingsWidget.scrollByRows(e.payload));
    })
  );

  unlistens.push(
    await listenTo('pit-service-toggle', () => {
      runInAction(() => root.pitServiceWidget.toggleManualShow());
    })
  );

  // The key was pressed in main, where the runner lives; the panel it should
  // pop up renders here.
  unlistens.push(
    await listenTo('pit-service-reveal', () => {
      runInAction(() => root.pitServiceWidget.revealFromCommand());
    })
  );

  unlistens.push(
    await listenTo<boolean>('interact-mode-changed', (e) => {
      runInAction(() => {
        root.appSettings.interactMode = e.payload;
      });
    })
  );

  unlistens.push(await listenPitServiceAutoSuspended(root));
  unlistens.push(await listenPitServiceHalvesTakenOver(root));

  unlistens.push(
    await listenTo<SessionLayoutMap>('session-layouts-changed', (e) => {
      runInAction(() => {
        root.layouts.sessionLayouts = e.payload;
      });
    })
  );

  unlistens.push(
    await listenTo<BindingMap>('bindings-changed', (e) => {
      runInAction(() => root.bindings.applyBindings(e.payload));
    })
  );

  unlistens.push(
    await listenTo<string>('layout-activated', (e) => {
      runInAction(() =>
        root.widgetSettings.showLayoutActivatedToast(e.payload)
      );
    })
  );

  unlistens.push(
    await listenTo<boolean>('auto-switch-layouts-changed', (e) => {
      runInAction(() => {
        root.appSettings.appSettings.autoSwitchLayouts = e.payload;
      });
    })
  );

  return unlistens;
};
