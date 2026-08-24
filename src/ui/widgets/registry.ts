import type { ComponentType } from 'react';
import type { WidgetMount } from '@ui/widgets/widget-mount';

/**
 * Which React component renders each widget id, collected from the `mount.ts`
 * every widget folder ships.
 *
 * Collected rather than listed: a new widget is a new folder, and no shared
 * file has to be edited to make it render — which is what keeps two widgets
 * being built at the same time out of each other's way.
 *
 * Read only by the places that actually mount widgets: OverlayCanvas,
 * WidgetPreview, the layout editor's canvas and the remote screen.
 */
const mountModules = import.meta.glob<{ mount: WidgetMount }>('./*/mount.ts', {
  eager: true,
});

export const WIDGET_COMPONENTS: Record<string, ComponentType> =
  Object.fromEntries(
    Object.values(mountModules).map(({ mount }) => [mount.id, mount.component])
  );

export const componentForWidget = (id: string): ComponentType | undefined =>
  WIDGET_COMPONENTS[id];
