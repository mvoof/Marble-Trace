/**
 * Signals to the widgets of every client — whatever a hotkey or main does to
 * an overlay's widgets reaches a remote screen the same way. The snapshot a
 * screen paints from is `ClientSnapshot` (`@/types/client-protocol`).
 *
 * Declared in `src-tauri/src/model/events.rs` and generated into `bindings.ts`,
 * so the whitelist cannot drift: the hub resolves the same enum, and a kind
 * added on one side no longer compiles on the other.
 */
export type { RemoteControlKind, RemoteStreamKind } from '@/types/bindings';

import type { RemoteControlKind, RemoteStreamKind } from '@/types/bindings';

/** Message kinds the server pushes over the socket. */
export type RemoteMessageKind = RemoteControlKind | RemoteStreamKind;

export interface RemoteMessage {
  type: RemoteMessageKind;
  data: unknown;
}

export type RemoteConnectionState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'unauthorized';
