import type { ComponentType, ReactNode } from 'react';

import { createStoreContext } from '@shared/lib/store-context';
import type { LiveWidgetsStore } from '@entities/layout/live-widgets.store';
import type { AppSettingsStore } from '@entities/app-settings/app-settings.store';
import type { UnitsStore } from '@entities/app-settings/units.store';
import type { PreviewTarget } from './preview-target';

/** A preview core, as the page that draws one holds it. */
export interface PreviewCoreHandle extends PreviewTarget {
  liveWidgets: LiveWidgetsStore;
  appSettings: AppSettingsStore;
  units: UnitsStore;
  dispose(): void;
}

/**
 * One isolated sample world: the core, and the provider that puts it under the
 * widgets drawn against it. Built by the window that owns the stores, so a
 * page draws a preview without naming the core's class.
 */
export interface PreviewWorld {
  core: PreviewCoreHandle;
  Provide: ComponentType<{ children: ReactNode }>;
}

/** Builds a fresh preview world. Main provides it; nothing else draws previews from a page. */
export type PreviewWorldFactory = () => PreviewWorld;

export const [PreviewWorldContext, usePreviewWorldFactory] =
  createStoreContext<PreviewWorldFactory>('PreviewWorldFactory');
