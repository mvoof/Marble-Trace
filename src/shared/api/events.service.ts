import {
  emit,
  emitTo,
  listen,
  type EventCallback,
  type UnlistenFn,
} from '@tauri-apps/api/event';

import { listOverlayWindowLabels } from '@app/sync/overlay-labels';
import type {
  RemoteControlKind,
  RemoteDevice,
} from '@shared/contracts/bindings';
import type {
  ClientToMainMessage,
  ControlMessage,
  SnapshotMessage,
} from '@shared/contracts/client-protocol';
import {
  CLIENT_CONTROL_EVENT,
  CLIENT_FROM_MAIN_EVENT,
  CLIENT_TO_MAIN_EVENT,
  TRACK_MAP_CLEAR,
} from '@app/sync/sim-events';
import { publishRemoteControl } from '@shared/api/remote.service';

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

export const listenTo = <PayloadType>(
  event: string,
  handler: EventCallback<PayloadType>
): Promise<UnlistenFn> => listen(event, handler);

// Fan-out to every open overlay window. During startup the main window can
// react before any overlay exists, which makes Tauri log "event emitted but no
// listeners found"; a signal nobody was there to hear is one nobody missed.
const emitToOverlays = async (event: string, payload: unknown) => {
  const labels = await listOverlayWindowLabels();

  for (const label of labels) {
    await emitTo(label, event, payload);
  }
};

/** A client of the settings (an overlay) to main: `hello`, or a command. */
export const emitToMain = (message: ClientToMainMessage) =>
  emitTo(MAIN, CLIENT_TO_MAIN_EVENT, message);

export const listenToClients = (
  handler: (message: ClientToMainMessage) => void
) =>
  listenTo<ClientToMainMessage>(CLIENT_TO_MAIN_EVENT, (event) =>
    handler(event.payload)
  );

/** Main to one client: the snapshot of what it draws, sent to it alone. */
export const emitSnapshotToClient = (message: SnapshotMessage) =>
  emitTo(message.clientId, CLIENT_FROM_MAIN_EVENT, message);

export const listenToMain = (handler: (message: SnapshotMessage) => void) =>
  listenTo<SnapshotMessage>(CLIENT_FROM_MAIN_EVENT, (event) =>
    handler(event.payload)
  );

/**
 * A signal to the widgets of every client: each overlay over a Tauri event,
 * each remote screen over its socket — the same `{ type, data }` both ways, so
 * both run it through one switch (`client-sync.ts`). The hub keeps the kinds
 * that are the driver's alone off the remote screens.
 */
const broadcastControl = async (kind: RemoteControlKind, data: unknown) => {
  await emitToOverlays(CLIENT_CONTROL_EVENT, {
    type: kind,
    data,
  } satisfies ControlMessage);

  await publishRemoteControl(kind, data).catch((error: unknown) =>
    console.error('[events] failed to reach the remote screens:', error)
  );
};

export const emitStreamChatCleared = () =>
  broadcastControl('stream-chat-cleared', null);

export interface TrackRotationPayload {
  trackId: string;
  rotation: number;
}

export type TrackRotateDirection = 'cw' | 'ccw';

export interface TrackRotationRequest {
  trackId: string;
  direction: TrackRotateDirection;
}

/**
 * An overlay's rotate button. It asks main for a step rather than sending the
 * angle it computed: two screens turned in quick succession both start from
 * the angle they last heard of, and only main, applying the steps in order,
 * ends up with both turns.
 */
export const emitTrackRotationRequest = (request: TrackRotationRequest) =>
  emitTo(MAIN, 'track-rotation-requested', request);

/**
 * Main's answer to every rotation, broadcast: every overlay plus every remote
 * screen has to end up on the angle main stored.
 */
export const emitTrackRotation = (payload: TrackRotationPayload) =>
  broadcastControl('track-rotation', payload);

export const emitLayoutActivated = (layoutName: string) =>
  broadcastControl('layout-activated', layoutName);

/** A device showing a remote screen connected, resized or went away. */
export const listenRemoteDevice = (handler: (device: RemoteDevice) => void) =>
  listenTo<RemoteDevice>('remote://device', (event) => handler(event.payload));

/**
 * The track's recorded shape was deleted. The backend recorder hears its own
 * event; every overlay and remote screen drops the shape it draws on the
 * signal.
 */
export const emitTrackMapClear = async () => {
  await emit(TRACK_MAP_CLEAR);
  await broadcastControl('track-map-cleared', null);
};

// Heard by the backend recorder, not by a window.
export const emitTrackMapForceStart = () => emit('track-map:force-start');

export type { UnlistenFn };
