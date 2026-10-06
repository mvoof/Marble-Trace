import type { RendererCore } from '@store/roots/renderer-core';
import type { WidgetInstanceStore } from '@store/widget-runtime/widget-instances';
import type { DrivingAdvisory } from '@utils/driving-coach-utils';

/** The call a coach shows, as its store publishes it to the rows. */
export interface CoachAdvisoryDisplay {
  displayedAdvisory: DrivingAdvisory;
  displayedBrakeUrgency: number;
  displayedExitLateM: number | null;
  displayedExitThrottleDeficit: number;
}

/**
 * What a coach instance offers a scenario: the call it shows. Declared here
 * rather than taken from the store, which lives with its widget under
 * `@ui/**` — out of this folder's reach.
 */
export interface CoachPreviewTarget extends WidgetInstanceStore {
  readonly advisory: CoachAdvisoryDisplay;
}

const NEUTRAL_COACH_DISPLAY: CoachAdvisoryDisplay = {
  displayedAdvisory: 'neutral',
  displayedBrakeUrgency: 0,
  displayedExitLateM: null,
  displayedExitThrottleDeficit: 0,
};

/**
 * Forces the call every coach on this preview core shows. The advisory is
 * stated rather than computed: the reaction that evaluates it never runs on a
 * preview core. Each call starts from the all-clear, so a scenario states only
 * what differs from it and nothing an earlier one forced is left behind.
 */
export const seedCoachAdvisory = (
  store: Pick<RendererCore, 'widgetInstances'>,
  display: Partial<CoachAdvisoryDisplay> = {}
) =>
  store.widgetInstances.seed<CoachPreviewTarget>('coach', (coach) => {
    Object.assign(coach.advisory, NEUTRAL_COACH_DISPLAY, display);
  });
