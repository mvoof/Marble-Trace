import { runInAction } from 'mobx';

import {
  listenTo,
  type TrackRotationPayload,
  type UnlistenFn,
} from '@platform/services/events.service';
import type { RendererCore } from '@store/renderer-core';
import {
  standingsHotkeyTargets,
  streamChatHotkeyTargets,
} from '@store/hotkeys/hotkey-targets';
import type { OverlayRoot } from '@store/overlay-root';
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
 * Subscribes a window's stores to the signals the other one sends. The
 * settings themselves reach an overlay as a snapshot (`overlay-sync.ts`); what
 * is left here is what a snapshot cannot carry — a scroll, a toast, a reset.
 * The transport lives in `services/events.service.ts`; this is the wiring that
 * knows which store each payload belongs to.
 */

export const setupMainListeners = async (
  root: RendererCore
): Promise<UnlistenFn[]> => {
  const unlistens: UnlistenFn[] = [];

  unlistens.push(await listenOverlayModes(root));

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
 * Main owns the angle (`TrackRotationStore`); an overlay mirrors every turn it
 * broadcasts, its own included, which replaces the angle shown in advance.
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

  // The connectors live in main, so only main knows when the feed was shut
  // down; the overlay drops its own buffer on that signal.
  unlistens.push(
    await listenTo('stream-chat-cleared', () => {
      runInAction(() => root.chat.reset());
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
    await listenTo<string>('layout-activated', (e) => {
      runInAction(() => root.liveWidgets.showLayoutActivatedToast(e.payload));
    })
  );

  return unlistens;
};
