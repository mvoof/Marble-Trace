import type { AppLanguage, UnitSystem } from '@/types';
import type {
  ClientEnvelope,
  InteractHotkeyMode,
  RemoteControlKind,
} from '@shared/contracts/bindings';
import type { BindingMap } from '@/types/input-bindings';
import type { PitStrategy } from '@/types/pit-strategy';
import type {
  LayoutMonitor,
  WidgetDefaultConfig,
  WidgetUserSettings,
} from '@/types/widget-settings';

/**
 * The payloads of the client protocol (ADR-0007). The envelope around them is
 * declared in Rust (`model/client_protocol.rs`) and generated into
 * `bindings.ts`; what it carries is the frontend's own business, so it is
 * declared here and forwarded by the backend unread.
 */

/**
 * What one client draws, and nothing else: its own screen — an overlay's
 * monitor or a remote screen — the widgets standing on it, and the app-level
 * values those widgets read. It replaces the client's state whole; main sends
 * one on every change. An overlay gets it inside a `snapshot` envelope with
 * its acknowledgement; a remote screen gets it bare, having no commands to
 * acknowledge.
 */
export interface ClientSnapshot {
  /** The live layout these widgets belong to; a command names it back. */
  layoutId: string;
  layoutName: string;
  /** The client's own screen: its bounds, and for a remote screen its slug
   *  and background. */
  monitor: LayoutMonitor;
  /** Every widget on that monitor, switched off ones included. */
  widgets: WidgetDefaultConfig[];
  hideAllWidgets: boolean;
  hideWidgetsWhenGameClosed: boolean;
  /**
   * Whether a widget is hidden while the car is off track. Derived in main from
   * the auto-switch setting and the garage layout, which the overlay otherwise
   * has no use for.
   */
  hidesOffTrack: boolean;
  units: UnitSystem;
  language: AppLanguage;
  steeringLock: number;
  carLength: number;
  pitStrategy: PitStrategy;
  /** The overlay prints the key that leaves interact mode, and how it acts. */
  interactHotkeyMode: InteractHotkeyMode;
  bindings: BindingMap;
  /** The chat widget filters what the connectors deliver. */
  streamChatHideCommands: boolean;
  streamChatIgnoredBots: string;
  settingsLocked: boolean;
}

/**
 * A drag, a resize or a snap. Sent every few frames while the gesture lasts,
 * so a stream screen follows it, and once more on release with `final`.
 */
export interface SetGeometryCommand {
  kind: 'setGeometry';
  widgetId: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  final: boolean;
}

/** The drag toolbar's switch. */
export interface SetEnabledCommand {
  kind: 'setEnabled';
  widgetId: string;
  enabled: boolean;
}

/** The F9 picker: put a widget on this monitor. Main picks the instance. */
export interface EnableTypeOnMonitorCommand {
  kind: 'enableTypeOnMonitor';
  type: string;
  monitor: string;
}

/** The settings popup: only the fields the user changed. */
export interface PatchSettingsCommand {
  kind: 'patchSettings';
  widgetId: string;
  partial: Partial<WidgetUserSettings>;
}

export type ClientCommand =
  | SetGeometryCommand
  | SetEnabledCommand
  | EnableTypeOnMonitorCommand
  | PatchSettingsCommand;

export type HelloMessage = Extract<ClientEnvelope, { kind: 'hello' }>;

export type CommandMessage = Extract<ClientEnvelope, { kind: 'command' }> & {
  command: ClientCommand;
};

export type SnapshotMessage = Extract<ClientEnvelope, { kind: 'snapshot' }> & {
  snapshot: ClientSnapshot;
};

/** What a client sends main. */
export type ClientToMainMessage = HelloMessage | CommandMessage;

/**
 * A signal to the widgets of a client — the same message whether it arrives
 * over a Tauri event (an overlay) or over the socket (a remote screen).
 */
export interface ControlMessage {
  type: RemoteControlKind;
  data: unknown;
}
