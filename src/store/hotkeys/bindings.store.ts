import { makeAutoObservable } from 'mobx';
import { ACTIONS, ACTION_BY_ID } from './actions';
import {
  bindingKey,
  bindingsEqual,
  type Binding,
  type BindingMap,
} from './binding-types';

/** The bindings an untouched install ships with, taken from the registry. */
export const defaultBindingMap = (): BindingMap => {
  const map: BindingMap = {};

  for (const action of ACTIONS) {
    if (action.defaultBinding) {
      map[action.id] = [action.defaultBinding];
    }
  }

  return map;
};

/** The registry is static, so the shipped map is built once. */
const DEFAULTS = defaultBindingMap();

export class BindingsStore {
  /**
   * Only what the user changed — the sole persisted value. An action absent
   * here takes its default from the registry, so a newly shipped action with a
   * `defaultBinding` reaches existing users without a settings migration. An
   * empty array is the explicit "unbound" marker, which is what separates
   * "never touched" from "deliberately cleared".
   */
  overrides: BindingMap = {};

  // Bumped by every setter so reactions can depend on one number instead of
  // deep-comparing the map — same pattern as widgetSettings.changeToken.
  mutationId = 0;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  /** Defaults with the user's overrides on top. Everything reads this. */
  get bindings(): BindingMap {
    const effective = { ...DEFAULTS };

    for (const [actionId, bindings] of Object.entries(this.overrides)) {
      // Overrides for actions this build does not know are kept on disk but
      // never dispatched — see applyBindings.
      if (ACTION_BY_ID.has(actionId)) {
        effective[actionId] = bindings;
      }
    }

    return effective;
  }

  /**
   * Replaces the override set.
   *
   * Unknown action ids are **kept**. A user who binds an action on a newer
   * build and then rolls back would otherwise lose that override on the first
   * save — the schema version is unchanged, so nothing else would catch it.
   */
  applyBindings(saved: BindingMap | undefined) {
    if (!saved) return;

    const next: BindingMap = {};

    for (const [actionId, bindings] of Object.entries(saved)) {
      if (!Array.isArray(bindings)) continue;

      next[actionId] = bindings.filter(isValidBinding);
    }

    this.overrides = next;
    this.mutationId++;
  }

  bindingsFor(actionId: string): Binding[] {
    return this.overrides[actionId] ?? DEFAULTS[actionId] ?? [];
  }

  addBinding(actionId: string, binding: Binding) {
    // Based on the effective list, not on the override: adding a second key to
    // an action still on its default would otherwise drop that default.
    const existing = this.bindingsFor(actionId);

    if (existing.some((candidate) => bindingsEqual(candidate, binding))) {
      return;
    }

    this.overrides[actionId] = [...existing, binding];
    this.mutationId++;
  }

  removeBinding(actionId: string, binding: Binding) {
    // Never deleted: an absent entry means "use the default", which would bring
    // back the very binding the user just removed.
    this.overrides[actionId] = this.bindingsFor(actionId).filter(
      (candidate) => !bindingsEqual(candidate, binding)
    );

    this.mutationId++;
  }

  clearAction(actionId: string) {
    this.overrides[actionId] = [];
    this.mutationId++;
  }

  resetToDefaults() {
    this.overrides = {};
    this.mutationId++;
  }

  /**
   * Rewrites every binding of one device to a new device id. Used when a driver
   * reinstall regenerates the DirectInput GUID and the device is re-matched by
   * vendor/product — see input/identity.rs.
   */
  rewriteDeviceId(previousId: string, nextId: string) {
    if (previousId === nextId) return;

    let changed = false;

    // Overrides only. Shipped defaults are keyboard accelerators by
    // construction — a default cannot name a device that varies per machine.
    for (const [actionId, bindings] of Object.entries(this.overrides)) {
      const rewritten = bindings.map((binding) =>
        binding.kind === 'device' && binding.deviceId === previousId
          ? { ...binding, deviceId: nextId }
          : binding
      );

      if (rewritten.some((binding, index) => binding !== bindings[index])) {
        this.overrides[actionId] = rewritten;
        changed = true;
      }
    }

    if (changed) {
      this.mutationId++;
    }
  }

  /** Every action a given binding would fire, in registry order. */
  get actionsByBinding(): Map<string, string[]> {
    const byBinding = new Map<string, string[]>();

    for (const action of ACTIONS) {
      for (const binding of this.bindingsFor(action.id)) {
        const key = bindingKey(binding);
        const actionIds = byBinding.get(key);

        if (actionIds) {
          actionIds.push(action.id);
        } else {
          byBinding.set(key, [action.id]);
        }
      }
    }

    return byBinding;
  }

  /**
   * Bindings that fire more than one action. They are allowed — two actions on
   * one key can be legitimate across widgets that are never in a layout
   * together — so this only feeds a warning in the UI, never a reassignment.
   */
  get conflicts(): Map<string, string[]> {
    const conflicting = new Map<string, string[]>();

    for (const [key, actionIds] of this.actionsByBinding) {
      if (actionIds.length > 1) {
        conflicting.set(key, actionIds);
      }
    }

    return conflicting;
  }

  conflictingActions(actionId: string, binding: Binding): string[] {
    const actionIds = this.conflicts.get(bindingKey(binding)) ?? [];

    return actionIds.filter((candidate) => candidate !== actionId);
  }

  /**
   * First keyboard accelerator bound to an action, for prompts that have to
   * name a key ("press F8 to exit"). Null when the action is unbound or bound
   * only to a device button, which no prompt can spell out usefully.
   */
  primaryAccelerator(actionId: string): string | null {
    const keyboard = this.bindingsFor(actionId).find(
      (binding) => binding.kind === 'keyboard'
    );

    return keyboard?.kind === 'keyboard' ? keyboard.accelerator : null;
  }

  /** Accelerators to register with the OS, deduplicated. */
  get keyboardAccelerators(): string[] {
    const accelerators = new Set<string>();

    for (const bindings of Object.values(this.bindings)) {
      for (const binding of bindings) {
        if (binding.kind === 'keyboard') {
          accelerators.add(binding.accelerator);
        }
      }
    }

    return Array.from(accelerators);
  }

  /** Device ids referenced by at least one binding, connected or not. */
  get referencedDeviceIds(): string[] {
    const ids = new Set<string>();

    for (const bindings of Object.values(this.bindings)) {
      for (const binding of bindings) {
        if (binding.kind === 'device') {
          ids.add(binding.deviceId);
        }
      }
    }

    return Array.from(ids);
  }
}

const isValidBinding = (binding: Binding): boolean => {
  if (binding?.kind === 'keyboard') {
    return (
      typeof binding.accelerator === 'string' && binding.accelerator !== ''
    );
  }

  if (binding?.kind === 'device') {
    return (
      typeof binding.deviceId === 'string' &&
      binding.deviceId !== '' &&
      Number.isInteger(binding.button)
    );
  }

  return false;
};
