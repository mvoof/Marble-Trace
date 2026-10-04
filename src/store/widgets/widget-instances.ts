import type { RendererCore } from '@store/renderer-core';

/** What a widget instance's store is built from when that instance mounts. */
export interface WidgetInstanceContext {
  /** The core the instance renders against — a preview's own in a preview. */
  core: RendererCore;
  /** The instance, as its settings are addressed (`liveWidgets.getSettings`). */
  instanceId: string;
  type: string;
}

/** Anything a widget's `mount.ts` builds per instance. */
export interface WidgetInstanceStore {
  /** Stops every reaction and timer the store started. */
  dispose(): void;
}

export type WidgetStoreFactory = (
  context: WidgetInstanceContext
) => WidgetInstanceStore;

interface RegisteredStore {
  type: string;
  store: WidgetInstanceStore;
}

/**
 * The widget stores of the instances mounted against one core, by instance.
 *
 * A store exists only while its instance is mounted: it is opened when the
 * instance enters the window's layout and closed — reactions included — when it
 * leaves, so a widget that is not on screen runs nothing. The registry is how
 * the code outside the render tree reaches them: a hotkey arriving on an
 * overlay acts on the stores of the instances marked for hotkeys.
 */
export class WidgetInstanceRegistry {
  private readonly entries = new Map<string, RegisteredStore>();

  constructor(private readonly hotkeysActOn: (instanceId: string) => boolean) {}

  open(context: WidgetInstanceContext, factory: WidgetStoreFactory) {
    const store = factory(context);

    this.entries.set(context.instanceId, { type: context.type, store });

    return store;
  }

  close(instanceId: string, store: WidgetInstanceStore) {
    // A remount opens the next store before React closes the previous one, so
    // only the entry that still names this store is removed.
    if (this.entries.get(instanceId)?.store === store) {
      this.entries.delete(instanceId);
    }

    store.dispose();
  }

  /**
   * The stores of every mounted instance of one widget. Typed by the caller:
   * the registry holds stores of every widget and cannot know which is which.
   */
  storesOf<Store extends WidgetInstanceStore>(type: string): Store[] {
    return [...this.entries.entries()]
      .filter(([, entry]) => entry.type === type)
      .map(([, entry]) => entry.store as Store);
  }

  /** The mounted instances of one widget that its hotkeys act on. */
  hotkeyStoresOf<Store extends WidgetInstanceStore>(type: string): Store[] {
    return [...this.entries.entries()]
      .filter(
        ([instanceId, entry]) =>
          entry.type === type && this.hotkeysActOn(instanceId)
      )
      .map(([, entry]) => entry.store as Store);
  }

  disposeAll() {
    for (const { store } of this.entries.values()) {
      store.dispose();
    }

    this.entries.clear();
  }
}

/** The stores several widget types read, started only while one is mounted. */
export type SharedWidgetStoreName = 'flags' | 'paceCar' | 'radar';

interface StartableStore {
  init(): void;
  dispose(): void;
}

/**
 * Reference counts for the stores shared by several widget types: the first
 * instance to mount starts the store, the last to leave stops it.
 *
 * A core that never starts anything (a preview, Storybook) still counts, so
 * the bookkeeping is the same everywhere; its stores are seeded by hand and
 * nothing is started for them.
 */
export class SharedWidgetStores {
  private readonly consumers = new Map<SharedWidgetStoreName, number>();

  constructor(
    private readonly stores: Record<SharedWidgetStoreName, StartableStore>,
    private readonly starts: boolean
  ) {}

  acquire(name: SharedWidgetStoreName) {
    const count = this.consumers.get(name) ?? 0;

    this.consumers.set(name, count + 1);

    if (count === 0 && this.starts) {
      this.stores[name].init();
    }
  }

  release(name: SharedWidgetStoreName) {
    const count = this.consumers.get(name) ?? 0;

    if (count === 0) {
      return;
    }

    if (count > 1) {
      this.consumers.set(name, count - 1);

      return;
    }

    this.consumers.delete(name);

    if (this.starts) {
      this.stores[name].dispose();
    }
  }

  isRunning(name: SharedWidgetStoreName): boolean {
    return this.starts && (this.consumers.get(name) ?? 0) > 0;
  }
}
