import type { ComponentType } from 'react';
import type {
  SharedWidgetStoreName,
  SharedWidgetStores,
  WidgetInstanceRegistry,
  WidgetStoreFactory,
} from '@entities/widget/widget-instances.store';
import type { AppSettingsStore } from '@entities/app-settings/app-settings.store';
import type { BackendComputedStore } from '@entities/cars/computed.store';
import type { CarsStore } from '@entities/cars/cars.store';
import type { ChatStore } from '@entities/chat/chat.store';
import type { LiveWidgetsView } from '@entities/layout/live-widgets.store';
import type { PlayerPositionStore } from '@entities/player/player-position.store';
import type { PlayerStore } from '@entities/player/player.store';
import type { ReferenceLapStore } from '@entities/player/reference-lap.store';
import type { SessionStore } from '@entities/session/session.store';
import type { UnitsStore } from '@entities/app-settings/units.store';

/**
 * Everything a widget's own store may be handed: the stores of the core it
 * renders against. Each store declares the part it reads; the core every
 * window builds satisfies this whole, so a store asking for something the
 * core does not hold is a type error at its `mount.ts`.
 */
export interface WidgetCore {
  appSettings: AppSettingsStore;
  backendComputed: BackendComputedStore;
  cars: CarsStore;
  chat: ChatStore;
  liveWidgets: LiveWidgetsView;
  player: PlayerStore;
  playerPosition: PlayerPositionStore;
  referenceLap: ReferenceLapStore;
  session: SessionStore;
  units: UnitsStore;
  readonly startsWidgetStores: boolean;
}

/** A core a widget instance mounts against: its stores, and the registries that hold its lifetime. */
export interface WidgetHost extends WidgetCore {
  sharedWidgetStores: SharedWidgetStores;
  widgetInstances: WidgetInstanceRegistry;
}

/**
 * How a widget is mounted: the id from its manifest, and the React component
 * that draws it.
 *
 * Deliberately a second file next to `manifest.ts` rather than a field inside
 * it. The manifest is data the store layer reads at import time — ids, design
 * sizes, shipped settings — and a manifest that imported its own component
 * would drag every widget's React tree into the settings and the store tests.
 * The two also change for unrelated reasons: the manifest when the data
 * changes, the mount when the rendering does.
 */
export interface WidgetMount {
  id: string;
  component: ComponentType;
  /**
   * The widget's own store, built when an instance mounts and disposed when it
   * leaves (`WidgetInstanceScope`). Components read it with
   * `useWidgetInstanceStore`.
   */
  store?: WidgetStoreFactory<WidgetCore>;
  /**
   * The stores several widget types share that this one reads. Each is started
   * by the first instance of any of them to mount and stopped by the last.
   */
  sharedStores?: SharedWidgetStoreName[];
}
