import type { AppLanguage, UnitSystem } from '@/types';
import type {
  MonitorBounds,
  WidgetDefaultConfig,
} from '@/types/widget-settings';

/**
 * Everything a remote screen needs to paint itself, published by the main
 * window and cached by the backend.
 *
 * It carries one screen's widgets and nothing else: a device on the network
 * never sees the other layouts, the other monitors, or any setting its widgets
 * do not read.
 */
export interface RemoteScreenSnapshot {
  slug: string;
  name: string;
  /** The device screen this layout was drawn for, in logical pixels. */
  bounds: MonitorBounds;
  widgets: WidgetDefaultConfig[];
  units: UnitSystem;
  language: AppLanguage;
  steeringLock: number;
  /** Name of the layout these widgets came from, shown while connecting. */
  layoutName: string;
}

/**
 * Widget commands the main window sends to a remote screen — the same things a
 * hotkey does to an overlay window, which cannot be reached by a Tauri event.
 * The backend keeps the identical whitelist.
 */
export type RemoteControlKind =
  | 'standings-class-index'
  | 'standings-scroll'
  | 'track-rotation';

/** Message kinds the server pushes over the socket. */
export type RemoteMessageKind =
  | RemoteControlKind
  | 'snapshot'
  | 'telemetry'
  | 'session'
  | 'status'
  | 'weather'
  | 'capabilities'
  | 'disconnected'
  | 'track-shape'
  | 'reference-lap'
  | 'chat-message'
  | 'chat-presence'
  | 'chat-deletion';

export interface RemoteMessage {
  type: RemoteMessageKind;
  data: unknown;
}

export type RemoteConnectionState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'unauthorized';
