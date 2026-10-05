import { runInAction } from 'mobx';

import {
  listenTo,
  type MonitorWidgetsPayload,
  type StreamChatFilters,
  type TrackRotationPayload,
  type UnlistenFn,
} from '@platform/services/events.service';
import type { AppLanguage, UnitSystem } from '@/types';
import type { PitStrategy } from '@/types/pit-strategy';
import type { SessionContext } from '@/types/widget-settings';
import type { RendererCore } from '@store/renderer-core';
import {
  standingsHotkeyTargets,
  streamChatHotkeyTargets,
} from '@store/hotkeys/hotkey-targets';
import type { OverlayRoot } from '@store/overlay-root';
import type { BindingMap } from '@/types/input-bindings';
import type { OverlayModes } from '@/types/bindings';
import { getOverlayModes } from '@platform/services/hotkeys.service';
import {
  OVERLAY_MODES_EVENT,
  PIT_SERVICE_TOGGLE_EVENT,
  STANDINGS_CLASS_STEP_EVENT,
  STANDINGS_SCROLL_EVENT,
  STREAM_CHAT_SCROLL_EVENT,
} from './sim-events';

/**
 * Subscribes a window's stores to the events the other one sends. The transport
 * itself lives in `services/events.service.ts`; this is the wiring that knows
 * which store each payload belongs to.
 */

type SessionLayoutMap = Record<SessionContext, string | null>;

export const setupMainListeners = async (
  root: RendererCore
): Promise<UnlistenFn[]> => {
  const unlistens: UnlistenFn[] = [];

  unlistens.push(await listenOverlayModes(root));
  unlistens.push(await listenTrackRotation(root));

  return unlistens;
};

/**
 * Drag and interact mode belong to the hotkey dispatcher in the backend; every
 * window mirrors them. Subscribed before the current value is read, so a
 * change in between is not lost.
 */
const listenOverlayModes = async (root: RendererCore) => {
  const unlisten = await listenTo<OverlayModes>(OVERLAY_MODES_EVENT, (e) => {
    runInAction(() => root.appSettings.applyOverlayModes(e.payload));
  });

  const modes = await getOverlayModes();

  runInAction(() => root.appSettings.applyOverlayModes(modes));

  return unlisten;
};

/**
 * The map is turned in whichever window shows it — an overlay in drag mode, or
 * the layout editor in main — and both windows draw the same angle afterwards.
 */
const listenTrackRotation = (root: RendererCore) =>
  listenTo<TrackRotationPayload>('track-rotation-changed', (e) => {
    runInAction(() =>
      root.trackMapWidget.applyTrackRotation(
        e.payload.trackId,
        e.payload.rotation
      )
    );
  });

export const setupOverlayListeners = async (
  root: OverlayRoot
): Promise<UnlistenFn[]> => {
  const unlistens: UnlistenFn[] = [];

  unlistens.push(await listenOverlayModes(root));
  unlistens.push(await listenTrackRotation(root));

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
    await listenTo<PitStrategy>('pit-strategy-changed', (e) => {
      runInAction(() => root.appSettings.setPitStrategy(e.payload));
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
      if (e.payload.monitorName !== root.liveWidgets.ownMonitorName) return;

      if (e.payload.layoutId !== undefined) {
        runInAction(() => {
          root.liveWidgets.syncedLayoutId = e.payload.layoutId ?? null;
        });
      }

      if (e.payload.monitors) {
        root.liveWidgets.applyMonitorsSync(e.payload.monitors);
      }

      // Only a list that claims to be the whole layout may remove a widget;
      // anything else is a patch of what its sender just edited.
      if (e.payload.complete) {
        root.liveWidgets.syncWidgetSet(e.payload.widgets);
      } else {
        root.liveWidgets.applySettingsSync(e.payload.widgets);
      }
    })
  );

  unlistens.push(
    await listenTo<number>(STANDINGS_CLASS_STEP_EVENT, (e) => {
      runInAction(() => {
        for (const table of standingsHotkeyTargets(root)) {
          table.stepClass(e.payload);
        }
      });
    })
  );

  // Scroll travels as a delta rather than an offset: only the overlay knows how
  // many rows fit and how long the target list is, so only it can clamp.
  unlistens.push(
    await listenTo<number>(STANDINGS_SCROLL_EVENT, (e) => {
      runInAction(() => {
        for (const table of standingsHotkeyTargets(root)) {
          table.scrollByRows(e.payload);
        }
      });
    })
  );

  unlistens.push(
    await listenTo<number>(STREAM_CHAT_SCROLL_EVENT, (e) => {
      runInAction(() => {
        for (const chat of streamChatHotkeyTargets(root)) {
          chat.scrollByRows(e.payload);
        }
      });
    })
  );

  unlistens.push(
    await listenTo(PIT_SERVICE_TOGGLE_EVENT, () => {
      runInAction(() => root.pitServiceWidget.panel.toggleManualShow());
    })
  );

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
      runInAction(() => root.liveWidgets.showLayoutActivatedToast(e.payload));
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
