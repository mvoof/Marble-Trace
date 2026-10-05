import type { AppLanguage, UnitSystem } from '@/types';
import type { ClientEnvelope, InteractHotkeyMode } from '@/types/bindings';
import type { BindingMap } from '@/types/input-bindings';
import type { PitStrategy } from '@/types/pit-strategy';
import type {
  LayoutMonitor,
  WidgetDefaultConfig,
} from '@/types/widget-settings';

/**
 * The payloads of the client protocol (ADR-0007). The envelope around them is
 * declared in Rust (`model/client_protocol.rs`) and generated into
 * `bindings.ts`; what it carries is the frontend's own business, so it is
 * declared here and forwarded by the backend unread.
 */

/**
 * What one overlay draws, and nothing else: its own monitor, the widgets
 * standing on it, and the app-level values those widgets read. It replaces the
 * overlay's state whole — main sends one on every change.
 */
export interface OverlaySnapshot {
  /** The live layout these widgets belong to; a command names it back. */
  layoutId: string;
  layoutName: string;
  /** The overlay's own monitor, for its bounds. */
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

/** The F9 picker: put a widget on this monitor. Main picks the instance. */
export interface EnableTypeOnMonitorCommand {
  kind: 'enableTypeOnMonitor';
  type: string;
  monitor: string;
}

export type ClientCommand = EnableTypeOnMonitorCommand;

export type HelloMessage = Extract<ClientEnvelope, { kind: 'hello' }>;

export type CommandMessage = Extract<ClientEnvelope, { kind: 'command' }> & {
  command: ClientCommand;
};

export type SnapshotMessage = Extract<ClientEnvelope, { kind: 'snapshot' }> & {
  snapshot: OverlaySnapshot;
};

/** What a client sends main. */
export type ClientToMainMessage = HelloMessage | CommandMessage;
