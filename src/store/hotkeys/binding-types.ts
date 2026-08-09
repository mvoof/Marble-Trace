import type { RootStore } from '@store/root-store';

/**
 * `press` — the action runs once, on key down.
 * `hold` — the action runs on both edges and receives whether the key is down,
 * so it can mirror the physical state (interact mode's hold variant).
 */
export type BindingTrigger = 'press' | 'hold';

export interface KeyboardBinding {
  kind: 'keyboard';
  /** Tauri accelerator, e.g. "Control+Shift+P". */
  accelerator: string;
}

export interface DeviceBinding {
  kind: 'device';
  /** Stable device identity, not an enumeration index. See input/identity.rs. */
  deviceId: string;
  button: number;
}

export type Binding = KeyboardBinding | DeviceBinding;

/** actionId -> the bindings that fire it. Both kinds may be mixed freely. */
export type BindingMap = Record<string, Binding[]>;

/** Owner id `app` means the action is global and never gated by the layout. */
export const APP_OWNER = 'app';

export interface HotkeyAction {
  /** Stable, persisted key. Never renamed once shipped. */
  id: string;
  /** Widget that owns the action, or APP_OWNER. Drives grouping and gating. */
  owner: string;
  /** i18n key under `bindings.actions` in main-app.json. */
  labelKey: string;
  trigger: BindingTrigger;
  /** Shipped default; absent means the action starts unbound. */
  defaultBinding?: Binding;
  /**
   * `press` actions are called with `pressed === true` only.
   * `hold` actions are called on both edges.
   */
  run: (root: RootStore, pressed: boolean) => void;
  /**
   * Opt out of the "owner widget must be in the active layout" gate — used by
   * the per-widget `toggle-in-layout` actions, whose whole job is to add a
   * widget that is by definition not there yet.
   */
  ignoreLayoutGate?: boolean;
  /**
   * True when the action would run but change nothing, because a setting it
   * depends on is switched off. The layout gate covers "the widget is not
   * there"; this covers "the widget is there but this particular key has
   * nothing to act on", which is otherwise a silent no-op.
   */
  isInert?: (root: RootStore) => boolean;
  /** i18n key under `bindings.inert` explaining how to make the action work. */
  inertHintKey?: string;
}

/**
 * Identity of a binding as a plain string, so bindings can be compared, used as
 * Map keys and deduplicated without a structural comparison.
 */
export const bindingKey = (binding: Binding): string =>
  binding.kind === 'keyboard'
    ? `keyboard:${binding.accelerator}`
    : `device:${binding.deviceId}:${binding.button}`;

export const bindingsEqual = (first: Binding, second: Binding): boolean =>
  bindingKey(first) === bindingKey(second);
