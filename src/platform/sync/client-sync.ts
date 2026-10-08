import { runInAction } from 'mobx';

import type { TrackRotationPayload } from '@shared/api/events.service';
import {
  standingsHotkeyTargets,
  streamChatHotkeyTargets,
} from '@features/hotkey-bindings/hotkey-targets';
import type { RendererCore } from '@store/roots/renderer-core';
import type {
  ClientSnapshot,
  ControlMessage,
} from '@shared/contracts/client-protocol';

/**
 * The client of ADR-0007, whatever carries it: an overlay hears main over
 * Tauri events (`overlay-sync.ts`), a remote screen over its socket
 * (`remote-sync.ts`). Both hand what arrives to the two functions here, so a
 * snapshot or a signal means the same thing on a monitor and on a tablet.
 *
 * Kept free of `@tauri-apps/*`: the remote page is a plain browser page and
 * imports this module.
 */

/**
 * Installs main's snapshot of the client's screen. It replaces what the
 * window held: the screen and its widgets, and every app-level value its
 * widgets read.
 *
 * Assigned directly, never through a setter: a setter is main's — it bumps
 * `changeToken`, and some reach the backend, which main has already told.
 */
export const applyClientSnapshot = (
  core: RendererCore,
  snapshot: ClientSnapshot
) => {
  runInAction(() => {
    Object.assign(core.appSettings.appSettings, {
      hideAllWidgets: snapshot.hideAllWidgets,
      hideWidgetsWhenGameClosed: snapshot.hideWidgetsWhenGameClosed,
      steeringLock: snapshot.steeringLock,
      carLength: snapshot.carLength,
      interactHotkeyMode: snapshot.interactHotkeyMode,
      streamChatHideCommands: snapshot.streamChatHideCommands,
      streamChatIgnoredBots: snapshot.streamChatIgnoredBots,
      ...snapshot.pitStrategy,
    });

    core.appSettings.hidesOffTrack = snapshot.hidesOffTrack;
    core.appSettings.settingsLocked = snapshot.settingsLocked;
    core.units.setSystem(snapshot.units);

    core.liveWidgets.applyClientScreen({
      layoutId: snapshot.layoutId,
      layoutName: snapshot.layoutName,
      monitor: snapshot.monitor,
      widgets: snapshot.widgets,
    });
  });

  // Switching the language reloads every translated string; done only when
  // it actually changed, not on every drag main reports.
  if (core.appSettings.appSettings.language !== snapshot.language) {
    core.appSettings.setLanguage(snapshot.language);
  }
};

const unhandledControl = (kind: never) => {
  console.warn('[client-sync] unknown control message:', kind);
};

/**
 * Runs one signal on this client's widgets. Exhaustive over
 * `RemoteControlKind`: a kind added in Rust without a case here does not
 * compile.
 *
 * A hotkey acts on the mounted instances marked for hotkeys, which only this
 * window knows — so a scroll travels as a delta, and only the client clamps it.
 */
export const applyControl = (core: RendererCore, message: ControlMessage) => {
  const kind = message.type;

  runInAction(() => {
    switch (kind) {
      case 'standings-class-step': {
        for (const table of standingsHotkeyTargets(core)) {
          table.stepClass(message.data as number);
        }

        return;
      }

      case 'standings-scroll': {
        for (const table of standingsHotkeyTargets(core)) {
          table.scrollByRows(message.data as number);
        }

        return;
      }

      case 'stream-chat-scroll': {
        for (const chat of streamChatHotkeyTargets(core)) {
          chat.scrollByRows(message.data as number);
        }

        return;
      }

      // Main owns the angle; this replaces the one shown in advance.
      case 'track-rotation': {
        const { trackId, rotation } = message.data as TrackRotationPayload;

        core.trackMapWidget.applyTrackRotation(trackId, rotation);

        return;
      }

      case 'pit-service-toggle': {
        core.pitServiceWidget.panel.toggleManualShow();

        return;
      }

      // The connectors live in main, so only main knows the feed was shut
      // down; the client drops its own buffer.
      case 'stream-chat-cleared': {
        core.chat.reset();

        return;
      }

      case 'layout-activated': {
        core.liveWidgets.showLayoutActivatedToast(message.data as string);

        return;
      }

      case 'track-map-cleared': {
        core.trackMapWidget.clearTrackShape();

        return;
      }

      default: {
        unhandledControl(kind);
      }
    }
  });
};
