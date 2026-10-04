import type { ComponentType } from 'react';
import type {
  SharedWidgetStoreName,
  WidgetStoreFactory,
} from '@store/widgets/widget-instances';

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
  store?: WidgetStoreFactory;
  /**
   * The stores several widget types share that this one reads. Each is started
   * by the first instance of any of them to mount and stopped by the last.
   */
  sharedStores?: SharedWidgetStoreName[];
}
