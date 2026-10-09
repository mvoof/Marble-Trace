import { useWidgetInstanceStore } from '@entities/widget/widget-instance-context';
import type { IncidentTrackerWidgetStore } from './incident-tracker.store';

/** The store `mount.ts` built for the Incident Tracker instance being rendered. */
export const useIncidentTrackerStore = () =>
  useWidgetInstanceStore<IncidentTrackerWidgetStore>();
