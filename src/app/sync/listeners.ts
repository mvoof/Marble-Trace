import { runInAction } from 'mobx';

import { listenTo, type UnlistenFn } from '@shared/api/events.service';
import type { RendererCore } from '@app/roots/renderer-core';
import type { OverlayRoot } from '@app/roots/overlay-root';
import type { OverlayModes } from '@shared/contracts/bindings';
import type { ControlMessage } from '@shared/contracts/client-protocol';
import { getOverlayModes } from '@shared/api/hotkeys.service';
import { applyControl } from './client-sync';
import {
  CLIENT_CONTROL_EVENT,
  OVERLAY_MODES_EVENT,
} from '@shared/api/sim-events';

/**
 * Subscribes a window's stores to the signals sent to it. The settings reach an
 * overlay as a snapshot (`overlay-sync.ts`); what is left here is the overlay
 * modes and the signals a snapshot cannot carry — a scroll, a toast, a reset —
 * which `client-sync.ts` runs, as it does on a remote screen.
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

export const setupOverlayListeners = async (
  root: OverlayRoot
): Promise<UnlistenFn[]> => [
  await listenOverlayModes(root),
  // Every signal to the widgets, the remote screens' own vocabulary: a
  // hotkey's scroll, the track map turned, the chat cleared, a layout
  // switched in.
  await listenTo<ControlMessage>(CLIENT_CONTROL_EVENT, (e) =>
    applyControl(root, e.payload)
  ),
];
