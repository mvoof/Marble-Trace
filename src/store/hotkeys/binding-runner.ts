import { register, unregister } from '@tauri-apps/plugin-global-shortcut';
import type { RootStore } from '@store/root-store';
import { ACTIONS } from './actions';
import {
  APP_OWNER,
  bindingKey,
  type Binding,
  type HotkeyAction,
} from './binding-types';

/**
 * A binding fires only when its owner is live. Checked here, at dispatch time,
 * rather than at registration: nothing downstream should run for a widget that
 * is not in the layout — in particular the pit-service and standings actions
 * must not broadcast to the overlays.
 *
 * Evaluating it per dispatch also means a layout switch needs no
 * re-registration. Keyboard accelerators stay registered with the OS either
 * way; unregistering them per layout would hand the key back to the sim
 * mid-session, which is worse than a no-op handler.
 */
const isActionLive = (action: HotkeyAction, root: RootStore): boolean =>
  action.owner === APP_OWNER ||
  action.ignoreLayoutGate === true ||
  root.widgetSettings.isWidgetInActiveLayout(action.owner);

const runAction = (action: HotkeyAction, root: RootStore, pressed: boolean) => {
  if (action.trigger === 'press' && !pressed) return;

  if (!isActionLive(action, root)) return;

  try {
    action.run(root, pressed);
  } catch (error) {
    console.error(`[bindings] action "${action.id}" failed`, error);
  }
};

/** Runs every action bound to `binding`. Conflicts are allowed, so this is a fan-out. */
export const dispatchBinding = (
  root: RootStore,
  binding: Binding,
  pressed: boolean
) => {
  const key = bindingKey(binding);

  for (const action of ACTIONS) {
    const bound = root.bindings
      .bindingsFor(action.id)
      .some((candidate) => bindingKey(candidate) === key);

    if (bound) {
      runAction(action, root, pressed);
    }
  }
};

export const dispatchDeviceButton = (
  root: RootStore,
  deviceId: string,
  button: number,
  pressed: boolean
) => dispatchBinding(root, { kind: 'device', deviceId, button }, pressed);

const registeredAccelerators = new Set<string>();
let isApplying = false;
let reapplyPending = false;

/**
 * Brings the OS-level shortcut registrations in line with the binding map.
 * Re-entrant calls are collapsed into one trailing run — MobX reactions can
 * fire again while the async unregister/register round-trip is still going.
 */
export const applyKeyboardBindings = async (root: RootStore) => {
  if (isApplying) {
    reapplyPending = true;

    return;
  }

  isApplying = true;

  try {
    const wanted = root.bindings.keyboardAccelerators;

    await Promise.all(
      Array.from(registeredAccelerators).map((accelerator) =>
        unregister(accelerator).catch(() => undefined)
      )
    );

    registeredAccelerators.clear();

    await Promise.all(
      wanted.map(async (accelerator) => {
        try {
          await unregister(accelerator).catch(() => undefined);

          await register(accelerator, (event) => {
            dispatchBinding(
              root,
              { kind: 'keyboard', accelerator },
              event.state === 'Pressed'
            );
          });

          registeredAccelerators.add(accelerator);
        } catch (error) {
          console.error(
            `[bindings] failed to register accelerator "${accelerator}"`,
            error
          );
        }
      })
    );
  } finally {
    isApplying = false;

    if (reapplyPending) {
      reapplyPending = false;
      void applyKeyboardBindings(root);
    }
  }
};

export const cleanupKeyboardBindings = () => {
  for (const accelerator of Array.from(registeredAccelerators)) {
    void unregister(accelerator).catch(() => undefined);
  }

  registeredAccelerators.clear();
};
