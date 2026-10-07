import { useLayoutEffect, useState, type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';

import type { WidgetInstanceStore } from '@store/widget-runtime/widget-instances.store';
import { mountForWidget } from '@ui/widgets/registry';
import type { WidgetHost } from '@ui/widgets/widget-mount';
import { useWidgetHost } from '@ui/widgets/widget-host-context';
import { WidgetInstanceStoreContext } from './widget-instance-context';

interface WidgetInstanceScopeProps {
  type: string;
  /** The instance; a Storybook story renders the record named by its type. */
  instanceId?: string;
  /**
   * The core the widget renders against, when it is not the one in context —
   * the overlay swaps in sample data while placing widgets with the game closed.
   */
  core?: WidgetHost;
  children: ReactNode;
}

interface OpenedStore {
  core: WidgetHost;
  instanceId: string;
  store: WidgetInstanceStore | null;
}

/**
 * The lifetime of one widget instance's stores: its own store from `mount.ts`
 * is built on mount and disposed on unmount, and the shared stores it reads are
 * held for as long as it is here.
 *
 * Sits outside the frame that hides a widget (auto-hide, game closed), so a
 * hidden instance keeps its class tab and its history, and a shared store that
 * decides whether its widget shows — the flags, the radar — is not stopped by
 * the very hide it caused.
 */
export const WidgetInstanceScope = observer(
  ({ type, instanceId, core, children }: WidgetInstanceScopeProps) => {
    const contextCore = useWidgetHost();
    const owner: WidgetHost = core ?? contextCore;
    const id = instanceId ?? type;
    const mount = mountForWidget(type);

    const [opened, setOpened] = useState<OpenedStore | null>(null);

    // A layout effect, so the store exists before the first paint and before a
    // parent's own layout effect seeds it (Storybook).
    useLayoutEffect(() => {
      const sharedStores = mount?.sharedStores ?? [];

      for (const name of sharedStores) {
        owner.sharedWidgetStores.acquire(name);
      }

      const store = mount?.store
        ? owner.widgetInstances.open(
            { core: owner, instanceId: id, type },
            mount.store
          )
        : null;

      setOpened({ core: owner, instanceId: id, store });

      return () => {
        if (store) {
          owner.widgetInstances.close(id, store);
        }

        for (const name of sharedStores) {
          owner.sharedWidgetStores.release(name);
        }
      };
    }, [owner, id, type, mount]);

    // Rendered only against the store opened for this very instance and core:
    // the one before a swap is already disposed by the time this renders.
    const isCurrent =
      opened !== null && opened.core === owner && opened.instanceId === id;

    if (!isCurrent) {
      return null;
    }

    return (
      <WidgetInstanceStoreContext.Provider value={opened.store}>
        {children}
      </WidgetInstanceStoreContext.Provider>
    );
  }
);
