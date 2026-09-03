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
  /**
   * What the page paints behind the widgets: any CSS color, or `'transparent'`
   * for a browser source that has to composite over the game capture. Absent
   * means the dark default, and a transparent screen also keeps its status
   * messages off the canvas — a card mid-reconnect is worse on a broadcast than
   * nothing at all.
   */
  background?: string;
}

/**
 * Control messages the main window pushes to the remote screens — whatever a
 * hotkey does to an overlay window, which cannot be reached by a Tauri event.
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
