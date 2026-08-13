/**
 * The wire shape of an input binding.
 *
 * Lives with the other contracts rather than in `store/hotkeys/` because a
 * binding map travels between windows as an event payload, so the transport
 * layer has to name it without importing a store. The action registry itself
 * (`HotkeyAction`, which closes over `RootStore`) stays in the store.
 */

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
