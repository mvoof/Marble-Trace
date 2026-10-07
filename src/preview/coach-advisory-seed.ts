import type { RendererCore } from '@store/roots/renderer-core';
import { mockCoachFrame, type MockCoachCall } from './mocks/coach';

/**
 * Forces the call every coach on this preview core shows. Each call replaces
 * the whole frame, so a scenario states only what differs from the all-clear
 * and nothing an earlier one forced is left behind. `null` takes the frame
 * away: the coach then says only whether there is a reference at all.
 */
export const seedCoachAdvisory = (
  store: Pick<RendererCore, 'backendComputed'>,
  call: MockCoachCall | null = {}
) =>
  store.backendComputed.updateCoach(
    call === null ? null : mockCoachFrame(call)
  );
