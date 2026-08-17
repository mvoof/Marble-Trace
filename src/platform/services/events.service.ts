import {
  emit,
  emitTo,
  listen,
  type EventCallback,
  type UnlistenFn,
} from '@tauri-apps/api/event';

import {
  listOverlayWindowLabels,
  monitorLabel,
} from '@platform/sync/overlay-labels';
import type { AppLanguage, UnitSystem } from '@/types';
import type {
  LayoutMonitor,
  SessionContext,
  WidgetDefaultConfig,
} from '@/types/widget-settings';
import type { BindingMap } from '@/types/input-bindings';
import type { RemoteDevice } from '@/types/bindings';
import { TRACK_MAP_CLEAR } from '@platform/sync/sim-events';

/**
 * The whole frontend↔backend event channel: the only module that imports
 * `@tauri-apps/api/event`.
 *
 * Every event the app sends has a named function here, so the payload shape is
 * declared once and the event name exists in exactly one place. Nothing in this
 * file holds state or imports a store — subscribing handlers live in
 * `platform/sync/listeners.ts`, which wires them to the stores.
 *
 * Hot path: `listenTo` is a typed passthrough with no allocation of its own, so
 * `sim://telemetry/bundle` costs the same as calling `listen` directly.
 */

const MAIN = 'main';

type SessionLayoutMap = Record<SessionContext, string | null>;

// Widget lists always travel with the monitor they belong to. Without it an
// edit made on one screen would overwrite the widgets of another.
export interface MonitorWidgetsPayload {
  monitorName: string;
  widgets: WidgetDefaultConfig[];
  /**
   * The layout's monitors. An overlay window needs them to decide which
   * widgets are its own — the test is a centre point against monitor bounds,
   * so a window that only knew its own name could not place anything.
   */
  monitors?: LayoutMonitor[];
}

export const listenTo = <PayloadType>(
  event: string,
  handler: EventCallback<PayloadType>
): Promise<UnlistenFn> => listen(event, handler);

// Fan-out to every open overlay window. During startup the main window can
// react before any overlay exists, which makes Tauri log "event emitted but no
// listeners found"; overlays hydrate the same values from disk on their own
// boot, so skipping an emit before they are up is harmless.
const emitToOverlays = async (event: string, payload: unknown) => {
  const labels = await listOverlayWindowLabels();

  for (const label of labels) {
    await emitTo(label, event, payload);
  }
};

export const emitDragMode = (val: boolean) => emit('drag-mode-changed', val);

export const emitHideAllWidgets = (val: boolean) =>
  emitToOverlays('hide-all-widgets-changed', val);

export const emitHideWidgetsWhenGameClosed = (val: boolean) =>
  emitToOverlays('hide-widgets-when-game-closed-changed', val);

export const emitUnitsChanged = (system: UnitSystem) =>
  emitToOverlays('units-changed', system);

export const emitSteeringLockChanged = (degrees: number) =>
  emitToOverlays('steering-lock-changed', degrees);

export const emitLanguageChanged = (language: AppLanguage) =>
  emitToOverlays('language-changed', language);

export interface StreamChatFilters {
  hideCommands: boolean;
  ignoredBots: string;
}

export const emitStreamChatFilters = (filters: StreamChatFilters) =>
  emitToOverlays('stream-chat-filters-changed', filters);

export const emitStreamChatCleared = () =>
  emitToOverlays('stream-chat-cleared', null);

export const emitStandingsClassIndex = (index: number) =>
  emitToOverlays('standings-class-index-changed', index);

export const emitPitServiceToggle = () =>
  emitToOverlays('pit-service-toggle', null);

// Broadcast rather than targeted: either window can be the one that suspends.
export const emitPitServiceReveal = () =>
  emitToOverlays('pit-service-reveal', null);

export const emitPitServiceAutoSuspended = (suspended: boolean) =>
  emit('pit-service-auto-suspended', suspended);

export interface HalvesTakenOver {
  fuel: boolean;
  tires: boolean;
}

export const emitPitServiceHalvesTakenOver = (halves: HalvesTakenOver) =>
  emit('pit-service-halves-taken-over', halves);

export const emitStandingsScroll = (delta: number) =>
  emitToOverlays('standings-scroll', delta);

export const emitInteractMode = (active: boolean) =>
  emitToOverlays('interact-mode-changed', active);

/**
 * Pushes the active layout to every open overlay window.
 *
 * Every window receives the whole widget list, not a per-monitor slice: a
 * widget dragged over a monitor edge has to appear on the neighbour, and only
 * the receiving window can decide that, by testing centre points against its
 * own bounds. The live widgets are sent rather than the layout's stored copy —
 * the layout is only written back on the debounced commit, which would lag a
 * drag by half a second.
 */
export const emitActiveLayoutToOverlays = async (
  monitors: LayoutMonitor[],
  widgets: WidgetDefaultConfig[]
) => {
  const labels = await listOverlayWindowLabels();

  for (const monitor of monitors) {
    const label = monitorLabel(monitor.name);

    if (!labels.includes(label)) continue;

    await emitTo(label, 'widget-settings-updated', {
      monitorName: monitor.name,
      widgets,
      monitors,
    } satisfies MonitorWidgetsPayload);
  }
};

export const emitWidgetSettingsToMain = (payload: MonitorWidgetsPayload) =>
  emitTo(MAIN, 'widget-settings-updated', payload);

export const emitSessionLayoutsChanged = (sessionLayouts: SessionLayoutMap) =>
  emitToOverlays('session-layouts-changed', sessionLayouts);

export const emitAutoSwitchLayoutsChanged = (val: boolean) =>
  emitToOverlays('auto-switch-layouts-changed', val);

// The overlay never dispatches an action, but it does print the key that leaves
// interact mode, so a rebind made in main has to reach it.
export const emitBindingsChanged = (bindings: BindingMap) =>
  emitToOverlays('bindings-changed', bindings);

export const emitLayoutActivated = (layoutName: string) =>
  emit('layout-activated', layoutName);

// Both windows and the backend recorder drop their copy of the track.
/** A device showing a remote screen connected, resized or went away. */
export const listenRemoteDevice = (handler: (device: RemoteDevice) => void) =>
  listenTo<RemoteDevice>('remote://device', (event) => handler(event.payload));

export const emitTrackMapClear = () => emit(TRACK_MAP_CLEAR);

// Heard by the backend recorder, not by a window.
export const emitTrackMapForceStart = () => emit('track-map:force-start');

export type { UnlistenFn };
