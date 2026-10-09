import { useWidgetInstanceStore } from '@entities/widget/widget-instance-context';
import type { IncidentHudWidgetStore } from './incident-hud.store';

/** The store `mount.ts` built for the Incident HUD instance being rendered. */
export const useIncidentHudStore = () =>
  useWidgetInstanceStore<IncidentHudWidgetStore>();
