/**
 * The wire shape of an input binding — declared in Rust (`model/hotkeys.rs`),
 * which dispatches them, and generated into `bindings.ts`. Re-exported here
 * with the helpers every layer compares bindings by.
 */
import type { Binding, HotkeyTrigger } from './bindings';

export type { Binding };

/**
 * `press` — the action runs once, on key down.
 * `hold` — the action runs on both edges (interact mode's hold variant).
 */
export type BindingTrigger = HotkeyTrigger;

export type KeyboardBinding = Extract<Binding, { kind: 'keyboard' }>;

export type DeviceBinding = Extract<Binding, { kind: 'device' }>;

/** actionId -> the bindings that fire it. Both kinds may be mixed freely. */
export type BindingMap = Record<string, Binding[]>;

/** Owner id `app` means the action is global and never gated by the layout. */
export const APP_OWNER = 'app';

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
