import { describe, expect, it } from 'vitest';

import { RendererCore } from '@store/roots/renderer-core';
import { seedScenario } from '@store/preview/scenarios';
import { CoachWidgetStores } from './coach-stores';

const COACH = 'coach';

/** A coach mounted on a preview core, before or after the scenario is picked. */
const coachUnder = (scenarioId: string, opensFirst = false) => {
  const core = new RendererCore({ skipInit: true });
  const open = () =>
    core.widgetInstances.open(
      { core, instanceId: COACH, type: COACH },
      (context) => new CoachWidgetStores(context)
    ) as CoachWidgetStores;

  if (opensFirst) {
    const coach = open();

    seedScenario(core, scenarioId);

    return coach.advisory;
  }

  seedScenario(core, scenarioId);

  return open().advisory;
};

// The call row draws the inactive reason over whatever advisory is set, so a
// coach scenario is only worth anything if the coach is actually evaluating —
// which needs a reference with a braking zone in it, not just a reference.
describe('coach scenarios', () => {
  const cases: Array<[string, string]> = [
    ['driving-coach-brake', 'brake'],
    ['driving-coach-gas', 'gas'],
    ['driving-coach-grip', 'grip'],
    ['driving-coach-brake-soon', 'neutral'],
  ];

  it.each(cases)('%s renders the %s call', (scenarioId, advisory) => {
    const coach = coachUnder(scenarioId);

    // A null reason is the corner too: without a braking zone in the
    // reference the coach reports `no-corners` and draws it over the call.
    expect(coach.inactiveReason).toBeNull();
    expect(coach.displayedAdvisory).toBe(advisory);
  });

  // The editor seeds once and a coach switched on afterwards must still show
  // the call — and one already on screen must take it too.
  it('reaches a coach whether it mounted before or after the pick', () => {
    expect(coachUnder('driving-coach-brake').displayedAdvisory).toBe('brake');
    expect(coachUnder('driving-coach-brake', true).displayedAdvisory).toBe(
      'brake'
    );
  });

  it('pre-arms the brake call with a braking point to count down to', () => {
    const coach = coachUnder('driving-coach-brake-soon');

    expect(coach.displayedBrakeUrgency).toBeGreaterThanOrEqual(0.7);
    expect(coach.brakePointDistanceM).not.toBeNull();
  });

  it('carries the throttle figures the gas call is sized against', () => {
    const coach = coachUnder('driving-coach-gas');

    expect(coach.displayedExitLateM).toBeGreaterThan(0);
    expect(coach.displayedExitThrottleDeficit).toBeGreaterThan(0);
  });

  // The longest wording the row can carry is an inactive one, not a call, so
  // that is the state the plate has to be sized against.
  it('states the longest wording the row can carry', () => {
    expect(coachUnder('driving-coach-inactive').inactiveReason).toBe(
      'no-corners'
    );
  });
});
