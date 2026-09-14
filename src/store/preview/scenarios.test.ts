import { describe, expect, it } from 'vitest';

import type { FlagType } from '@/types';
import { formatDelta, getGameDelta } from '@utils/delta-utils';
import { isNearIncidentLimit } from '@utils/driver';
import { resolveSessionLaps } from '@utils/telemetry-format';
import {
  isLapLimitedSession,
  isSessionEnded,
  resolveSessionClock,
} from '@utils/timer-utils';
import { RootStore } from '@store/root-store';
import { WIDGETS } from '@store/widget-catalog';
import { PREVIEW_CAR_LENGTH_M } from './mocks/traffic';
import {
  DEFAULT_PREVIEW_SCENARIO_ID,
  PREVIEW_SCENARIOS,
  seedScenario,
} from './scenarios';

// The limiter's bit in the engine warning mask. Spelled out rather than
// imported: it is declared in the UI layer, which the preview module may not
// reach into.
const PIT_LIMITER_BIT = 0x10;

/** The sim's dry track, and the top of its wetness scale. */
const DRY_TRACK_WETNESS = 1;
const MAX_TRACK_WETNESS = 7;

/** What the backend reports when nothing is in range on that side. */
const NO_CAR_DIST_M = 999;

const seed = (scenarioId: string) => {
  const store = new RootStore({ skipInit: true });

  seedScenario(store, scenarioId);

  return store;
};

// The scenario seam is the highest point all four consumers go through, so the
// assertions are about what ends up in the store — never about which builder
// composed it.
describe('fuel scenarios', () => {
  it('opens the pit window and warns', () => {
    const fuel = seed('fuel-pit-window').backendComputed.fuel;

    expect(fuel?.pitWarning).toBe(true);
    expect(fuel?.pitWindowStart).not.toBeNull();
    expect(fuel?.pitWindowEnd).not.toBeNull();
  });

  it('runs the tank short of the finish', () => {
    const fuel = seed('fuel-short').backendComputed.fuel;

    expect(fuel?.shortage).toBeLessThan(0);
    expect(fuel?.lapsRemaining).toBeLessThan(fuel?.lapsToFinish ?? 0);
    expect(fuel?.fuelSavePerLap).toBeGreaterThan(0);
  });

  it('plans a refuel across more than one stop', () => {
    const fuel = seed('fuel-refuel-calc').backendComputed.fuel;

    expect(fuel?.refuelPlan?.stops).toBeGreaterThan(1);
    expect(fuel?.fuelToAddWithBuffer ?? 0).toBeGreaterThan(
      fuel?.fuelToAdd ?? 0
    );
  });

  it('leaves the widget settings alone', () => {
    const store = new RootStore({ skipInit: true });
    const before = JSON.stringify(store.liveWidgets.widgets);

    seedScenario(store, 'fuel-short');

    expect(JSON.stringify(store.liveWidgets.widgets)).toBe(before);
  });
});

// Flag display is mirrored by the seeding rather than derived: the hold and
// blink reactions never run in a store built with initialisation skipped, so
// what the widgets read is `displayFlags` / `ledDisplayFlag`, not the parse.
describe('flag scenarios', () => {
  const cases: Array<[string, FlagType]> = [
    ['yellow-flag', 'yellow'],
    ['safety-car', 'sc'],
    ['blue-flag', 'blue'],
    ['black-flag', 'black'],
    ['dq-flag', 'dq'],
    ['green-flag', 'green'],
    ['white-flag', 'white'],
    ['checkered-flag', 'checkered'],
    ['red-flag', 'red'],
    ['meatball-flag', 'meatball'],
    ['debris-flag', 'debris'],
  ];

  for (const [scenarioId, flag] of cases) {
    it(`shows ${flag} for ${scenarioId}`, () => {
      const store = seed(scenarioId);

      expect(store.flags.displayFlags).toContain(flag);
      expect(store.flags.ledDisplayFlag).toBe(flag);
    });
  }

  it('raises nothing but the flag it is named after', () => {
    const store = seed('meatball-flag');

    expect(store.flags.displayFlags).toEqual(['meatball']);
  });

  it('leaves the rest of the base snapshot alone', () => {
    const baseline = seed(DEFAULT_PREVIEW_SCENARIO_ID);
    const black = seed('black-flag');

    expect(black.backendComputed.fuel).toEqual(baseline.backendComputed.fuel);
    expect(black.player.carDynamics).toEqual(baseline.player.carDynamics);
  });
});

// The pit lane's geometry is only ever learned by driving through the pits, so
// without it the lane bar, the pitbox marker and the box countdown draw nothing
// — on the pit line widget and on the race dash alike.
describe('pit scenarios', () => {
  it('puts a recorded lane under the base snapshot', () => {
    const store = seed(DEFAULT_PREVIEW_SCENARIO_ID);

    expect(store.pitServiceWidget.pitLaneLengthM).toBeGreaterThan(200);
    expect(store.pitServiceWidget.pitboxLanePct).toBeGreaterThan(0);
    expect(store.pitServiceWidget.pitboxLanePct).toBeLessThan(1);
  });

  it('rolls the car down the lane towards its stall', () => {
    const store = seed('pit-lane');

    expect(store.player.carStatus?.on_pit_road).toBe(true);
    expect(store.player.hasPitLaneProgress).toBe(true);
    expect(store.player.pitTargetType).toBe('pitbox');
    expect(store.player.pitTargetDistM).toBeGreaterThan(0);
  });

  it('arms the limiter only where the scenario says so', () => {
    const off = seed('pit-lane').player.carStatus?.engine_warnings ?? 0;
    const on = seed('pit-limiter').player.carStatus?.engine_warnings ?? 0;

    expect(off & PIT_LIMITER_BIT).toBe(0);
    expect(on & PIT_LIMITER_BIT).toBe(PIT_LIMITER_BIT);
  });

  it('counts down to the exit once the stall is behind the car', () => {
    const store = seed('pit-over-limit');

    expect(store.player.pitTargetType).toBe('pitExit');
    expect(store.player.pitLaneProgressPct ?? 0).toBeGreaterThan(
      store.pitServiceWidget.pitboxLanePct ?? 1
    );
  });
});

// What the two tables are sized against is mostly the snapshot's own: a
// three-class grid, the longest names a driver can carry, and cars sitting in
// their boxes. These assertions are what stop a scenario being written for a
// state the baseline already shows.
describe('the field the baseline already holds', () => {
  const baselineEntries = () =>
    seed(DEFAULT_PREVIEW_SCENARIO_ID).backendComputed.driverEntries?.entries ??
    [];

  it('fields more than one class', () => {
    const classes = new Set(baselineEntries().map((entry) => entry.carClassId));

    expect(classes.size).toBeGreaterThan(2);
  });

  it('resolves a badge for every class it fields', () => {
    // The sim leaves `CarClassShortName` empty in the recorded session, so an
    // unresolved class falls back to the car's own name and spills a model
    // name into a column three characters wide.
    const MAX_BADGE_LENGTH = 6;

    for (const entry of baselineEntries()) {
      expect(
        entry.carClassShortName.length,
        `${entry.carClassId} shows ${entry.carClassShortName}`
      ).toBeLessThanOrEqual(MAX_BADGE_LENGTH);
    }
  });

  it('carries the longest name a driver can have', () => {
    // iRacing's own cap. The recorded field reaches it, which is why no
    // scenario stretches names.
    const LONGEST_NAME_LENGTH = 31;
    const longest = Math.max(
      ...baselineEntries().map((entry) => entry.userName.length)
    );

    expect(longest).toBe(LONGEST_NAME_LENGTH);
  });

  it('badges the cars it recorded in their boxes', () => {
    const stopped = baselineEntries().filter(
      (entry) => entry.pitState === 'stall'
    );

    expect(stopped.length).toBeGreaterThan(0);

    for (const entry of stopped) {
      expect(entry.onPitRoad).toBe(true);
    }
  });
});

// The standings read their gap off `f2Time` and the relative off `estTime`, so
// the close pack is only right if both widgets end up describing the same grid.
// The assertions are about what is in the store, never about how the builder
// composed it.
describe('the close-pack scenario', () => {
  it('packs the field inside a second', () => {
    const entries =
      seed('field-close-pack').backendComputed.driverEntries?.entries ?? [];
    const gaps = entries
      .slice(1)
      .map((entry, index) => entry.f2Time - (entries[index]?.f2Time ?? 0));

    expect(gaps.length).toBeGreaterThan(0);

    for (const gap of gaps) {
      expect(gap).toBeGreaterThan(0);
      expect(gap).toBeLessThan(1);
    }
  });

  it('spaces the relative from the same gap the standings show', () => {
    const entries =
      seed('field-close-pack').backendComputed.relative?.entries ?? [];
    const playerRow = entries.findIndex((entry) => entry.isPlayer);
    // The row directly above the player's in the strip is the car it is
    // actually racing, and that is the gap the close pack is about.
    const ahead = entries[playerRow - 1];
    const player = entries[playerRow];

    expect(player).toBeDefined();
    expect(ahead).toBeDefined();
    expect(ahead?.relativeLapDist ?? 0).toBeGreaterThan(0);
    expect(
      Math.abs((ahead?.estTime ?? 0) - (player?.estTime ?? 0))
    ).toBeLessThan(1);
  });

  it('runs the whole pack on track and on the same lap', () => {
    const entries =
      seed('field-close-pack').backendComputed.driverEntries?.entries ?? [];
    const laps = new Set(entries.map((entry) => entry.lap));

    // A pack is not a pack with a fifth of it parked or out of the world, which
    // is how the snapshot recorded it.
    for (const entry of entries) {
      expect(entry.onPitRoad).toBe(false);
      expect(entry.lastLapTime).toBeGreaterThan(0);
    }

    expect(laps.size).toBe(1);
  });

  it('orders the standings by position and the relative by track order', () => {
    const store = seed('field-close-pack');
    const standings = store.backendComputed.driverEntries?.entries ?? [];
    const relative = store.backendComputed.relative?.entries ?? [];

    expect(standings.map((entry) => entry.position)).toEqual(
      standings.map((_entry, index) => index + 1)
    );

    // Nobody is lapped inside a close pack, so track order is running order.
    for (const [index, entry] of relative.slice(1).entries()) {
      expect(entry.position).toBeGreaterThan(relative[index]?.position ?? 0);
    }
  });

  it('leaves the player on the grid it rebuilt', () => {
    const frame = seed('field-close-pack').backendComputed.driverEntries;
    const players = (frame?.entries ?? []).filter((entry) => entry.isPlayer);

    expect(players).toHaveLength(1);
    expect(players[0]?.carIdx).toBe(frame?.playerCarIdx);
  });
});

// The radars draw what the proximity frame says, and every number on it but
// the cars' own positions is derived. These assertions are about what ends up
// in the store — never about how the builder composed it.
describe('traffic scenarios', () => {
  const proximityOf = (scenarioId: string) =>
    seed(scenarioId).backendComputed.proximity;

  it('puts a car alongside on each side', () => {
    const left = proximityOf('traffic-left');
    const right = proximityOf('traffic-right');

    expect(left?.spotterLeft).toBe(true);
    expect(left?.spotterRight).toBe(false);
    expect(left?.radarDistances.leftDist).not.toBeNull();
    expect(left?.radarDistances.rightDist).toBeNull();

    expect(right?.spotterRight).toBe(true);
    expect(right?.spotterLeft).toBe(false);
    expect(right?.radarDistances.rightDist).not.toBeNull();
    expect(right?.radarDistances.leftDist).toBeNull();
  });

  it('fills both sides at once for three wide', () => {
    const proximity = proximityOf('traffic-three-wide');
    const sides = proximity?.nearbyCars.map((car) => car.lateralSide) ?? [];

    expect(proximity?.spotterLeft).toBe(true);
    expect(proximity?.spotterRight).toBe(true);
    expect(new Set(sides)).toEqual(new Set(['left', 'right']));
  });

  it('parks a car on the rear bumper without calling it alongside', () => {
    const proximity = proximityOf('traffic-rear-bumper');
    const car = proximity?.nearbyCars[0];

    expect(proximity?.nearbyCars).toHaveLength(1);
    expect(car?.lateralSide).toBe('center');
    expect(car?.longitudinalDist ?? 0).toBeLessThan(0);
    // Bumper to bumper, which is a clearance of about one car length.
    expect(Math.abs(car?.bumperDist ?? 9)).toBeLessThan(1);
    expect(proximity?.radarDistances.rearDist ?? 9).toBeLessThan(1);
    expect(proximity?.radarDistances.frontDist).toBe(NO_CAR_DIST_M);
  });

  it('derives every per-car value from the car the scenario stated', () => {
    for (const car of proximityOf('radar-traffic')?.nearbyCars ?? []) {
      expect(car.clearance).toBe(Math.abs(car.longitudinalDist));
      expect(Math.abs(car.bumperDist)).toBe(
        Math.max(0, car.clearance - PREVIEW_CAR_LENGTH_M)
      );

      if (car.bumperDist !== 0) {
        expect(Math.sign(car.bumperDist)).toBe(Math.sign(car.longitudinalDist));
      }
    }
  });

  it('hands the cars over nearest first', () => {
    const clearances =
      proximityOf('close-battle')?.nearbyCars.map((car) => car.clearance) ?? [];

    expect(clearances.length).toBeGreaterThan(1);
    expect([...clearances].sort((first, second) => first - second)).toEqual(
      clearances
    );
  });

  it('never reports a side distance no car on that side backs up', () => {
    for (const scenarioId of [
      'radar-traffic',
      'traffic-left',
      'traffic-right',
      'traffic-three-wide',
      'traffic-rear-bumper',
      'close-battle',
    ]) {
      const proximity = proximityOf(scenarioId);
      const sided = (side: 'left' | 'right') =>
        proximity?.nearbyCars.filter((car) => car.lateralSide === side) ?? [];

      for (const side of ['left', 'right'] as const) {
        const dist =
          side === 'left'
            ? proximity?.radarDistances.leftDist
            : proximity?.radarDistances.rightDist;

        expect(dist === null, `${scenarioId} ${side}`).toBe(
          sided(side).length === 0
        );
      }
    }
  });

  it('keeps the close battle reachable from both directions', () => {
    const cars = proximityOf('close-battle')?.nearbyCars ?? [];

    expect(cars.some((car) => car.longitudinalDist > 0)).toBe(true);
    expect(cars.some((car) => car.longitudinalDist < 0)).toBe(true);
  });
});

// The picker re-seeds the same preview store, so going back to the baseline has
// to undo whatever the previous pick forced — the seed puts back the frames it
// sets, and clears the ones no baseline frame covers.
describe('returning to the baseline', () => {
  it('clears a scenario that was picked before it', () => {
    const store = new RootStore({ skipInit: true });

    seedScenario(store, 'pit-limiter');
    seedScenario(store, 'driving-coach-brake');
    seedScenario(store, 'meatball-flag');
    seedScenario(store, DEFAULT_PREVIEW_SCENARIO_ID);

    expect(store.player.hasPitLaneProgress).toBe(false);
    expect(store.referenceLap.data).toBeNull();
    expect(store.drivingCoachWidget.displayedAdvisory).toBe('neutral');
    // The snapshot's own flag, not the meatball that was picked over it.
    expect(store.flags.displayFlags).toEqual(
      seed(DEFAULT_PREVIEW_SCENARIO_ID).flags.displayFlags
    );
  });

  it('matches a store that never left it', () => {
    const visited = new RootStore({ skipInit: true });

    seedScenario(visited, 'red-flag');
    seedScenario(visited, DEFAULT_PREVIEW_SCENARIO_ID);

    const untouched = seed(DEFAULT_PREVIEW_SCENARIO_ID);

    expect(visited.player.carStatus).toEqual(untouched.player.carStatus);
    expect(visited.backendComputed.proximity).toEqual(
      untouched.backendComputed.proximity
    );
  });
});

describe('an unknown scenario', () => {
  it('falls back to the baseline rather than showing nothing', () => {
    const fallback = seed('no-such-scenario').backendComputed.fuel;
    const baseline = seed(DEFAULT_PREVIEW_SCENARIO_ID).backendComputed.fuel;

    expect(fallback).toEqual(baseline);
  });
});

// The delta fields are raw values the sim supplies rather than something this
// app computes, so what a scenario owes the three timing widgets is a
// reference the sim has established and a number on either side of it.
describe('delta scenarios', () => {
  it('renders a delta against the baseline alone', () => {
    const store = seed(DEFAULT_PREVIEW_SCENARIO_ID);

    expect(store.player.lapTiming?.lap_delta_to_best_lap_ok).toBe(true);
    expect(store.player.lapTiming?.lap_best_lap_time).toBeGreaterThan(0);
    expect(store.backendComputed.lapHistory.length).toBeGreaterThan(0);
  });

  it('goes up on the reference', () => {
    const lapTiming = seed('delta-ahead').player.lapTiming;

    expect(getGameDelta(lapTiming, 'personal_best')).toBeLessThan(0);
    expect(getGameDelta(lapTiming, 'session_best')).toBeLessThan(0);
  });

  it('goes down on the reference', () => {
    const lapTiming = seed('delta-behind').player.lapTiming;

    expect(getGameDelta(lapTiming, 'personal_best')).toBeGreaterThan(0);
  });

  it('keeps the readout the same width once the sign appears', () => {
    const ahead = getGameDelta(
      seed('delta-ahead').player.lapTiming,
      'personal_best'
    );
    const behind = getGameDelta(
      seed('delta-behind').player.lapTiming,
      'personal_best'
    );

    expect(formatDelta(ahead)).toHaveLength(formatDelta(behind).length);
  });

  it('banks a personal best the log can star', () => {
    const store = seed('delta-personal-best');
    const [newest, ...older] = store.backendComputed.lapHistory;

    expect(newest.isBest).toBe(true);
    expect(store.backendComputed.lastCompletedLap?.lapNum).toBe(newest.lapNum);
    expect(store.player.lapTiming?.lap_best_lap_time).toBe(newest.lapTime);

    for (const entry of older) {
      expect(entry.isBest).toBe(false);

      if (entry.lapTime !== null) {
        expect(entry.lapTime).toBeGreaterThan(newest.lapTime ?? 0);
      }
    }
  });

  it('shows a banked sector beside one still being driven', () => {
    const lapDelta = seed('sector-in-progress').backendComputed.lapDelta;

    expect(lapDelta?.sectorTimes[0]).not.toBeNull();
    expect(lapDelta?.sectorDeltas[0] ?? 0).toBeLessThan(0);
    expect(lapDelta?.sectorTimes[1]).toBeNull();
    expect(lapDelta?.currentSectorIdx).toBe(1);
  });
});

// The engine panel flashes a cell off a threshold of its own, so what a
// scenario owes it is a reading on the far side of that threshold and a panel
// that is otherwise alive — the recorded snapshot was captured in the garage
// with every pressure and adjustment still at zero.
describe('engine scenarios', () => {
  const OIL_TEMP_WARNING_C = 135;
  const WATER_TEMP_WARNING_C = 120;

  it('runs the oil past the temperature the panel flashes at', () => {
    const carStatus = seed('engine-oil-overheat').player.carStatus;

    expect(carStatus?.oil_temp ?? 0).toBeGreaterThanOrEqual(OIL_TEMP_WARNING_C);
    expect(carStatus?.water_temp ?? 0).toBeLessThan(WATER_TEMP_WARNING_C);
  });

  it('runs the water past its own without taking the oil with it', () => {
    const carStatus = seed('engine-water-overheat').player.carStatus;

    expect(carStatus?.water_temp ?? 0).toBeGreaterThanOrEqual(
      WATER_TEMP_WARNING_C
    );
    expect(carStatus?.oil_temp ?? 0).toBeLessThan(OIL_TEMP_WARNING_C);
  });

  it('stops the engine and drops what the engine was driving', () => {
    const store = seed('engine-stalled');

    expect(store.player.carDynamics?.rpm).toBe(0);
    expect(store.player.carDynamics?.speed).toBe(0);
    expect(store.player.carStatus?.oil_press).toBe(0);
    expect(store.player.carStatus?.voltage ?? 99).toBeLessThan(13);
  });

  it('leaves the panel a reading in every cell', () => {
    for (const scenarioId of [
      'engine-oil-overheat',
      'engine-water-overheat',
      'engine-stalled',
    ]) {
      const carStatus = seed(scenarioId).player.carStatus;

      for (const value of [
        carStatus?.dc_abs,
        carStatus?.dc_brake_bias,
        carStatus?.dc_traction_control,
        carStatus?.dc_throttle_shape,
      ]) {
        expect(value ?? 0, scenarioId).toBeGreaterThan(0);
      }
    }
  });

  it('keeps the baseline flag on screen beside the panel', () => {
    expect(seed('engine-oil-overheat').flags.displayFlags).toEqual(
      seed(DEFAULT_PREVIEW_SCENARIO_ID).flags.displayFlags
    );
  });
});

// Which of the two readouts the timer draws is decided by the session entry
// rather than by the clock, so a timing scenario is only right if the frame and
// the entry describe the same session.
describe('timing scenarios', () => {
  const currentSession = (store: RootStore) => {
    const sessionNum = store.session.session?.session_num ?? 0;

    return store.session.sessionInfo?.sessions[sessionNum] ?? null;
  };

  const clockOf = (store: RootStore) => {
    const session = currentSession(store);

    return resolveSessionClock(
      store.session.session?.session_time_remain ?? null,
      store.session.session?.session_time ?? null,
      isLapLimitedSession(session?.sessionLaps, session?.sessionType)
    );
  };

  it('counts the last minute of a timed race down', () => {
    const store = seed('timer-final-minute');
    const clock = clockOf(store);

    expect(clock.isCountdown).toBe(true);
    expect(clock.seconds).toBeGreaterThan(0);
    expect(clock.seconds).toBeLessThan(60);
  });

  it('gives a lap-limited race no clock to count down', () => {
    const store = seed('timer-lap-limited');
    const session = currentSession(store);
    const clock = clockOf(store);

    expect(
      isLapLimitedSession(session?.sessionLaps, session?.sessionType)
    ).toBe(true);
    expect(clock.isCountdown).toBe(false);
    // Counting up from the elapsed time, never the zero a session that has run
    // out would show.
    expect(clock.seconds).toBeGreaterThan(0);
  });

  it('states a lap limit the footer can print', () => {
    const store = seed('timer-lap-limited');
    const session = currentSession(store);

    expect(
      resolveSessionLaps(
        session?.sessionLaps,
        store.session.session?.session_time_remain ?? null,
        11,
        90
      )
    ).toBe('25');
  });

  it('runs both on a session that has not ended', () => {
    for (const scenarioId of ['timer-final-minute', 'timer-lap-limited']) {
      const store = seed(scenarioId);

      expect(
        isSessionEnded(store.session.session?.session_state ?? null),
        scenarioId
      ).toBe(false);
      expect(currentSession(store)?.sessionType, scenarioId).toBe('Race');
    }
  });
});

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
    const coach = seed(scenarioId).drivingCoachWidget;

    // A null reason is the corner too: without a braking zone in the
    // reference the coach reports `no-corners` and draws it over the call.
    expect(coach.inactiveReason).toBeNull();
    expect(coach.displayedAdvisory).toBe(advisory);
  });

  it('pre-arms the brake call with a braking point to count down to', () => {
    const coach = seed('driving-coach-brake-soon').drivingCoachWidget;

    expect(coach.displayedBrakeUrgency).toBeGreaterThanOrEqual(0.7);
    expect(coach.brakePointDistanceM).not.toBeNull();
  });

  it('carries the throttle figures the gas call is sized against', () => {
    const coach = seed('driving-coach-gas').drivingCoachWidget;

    expect(coach.displayedExitLateM).toBeGreaterThan(0);
    expect(coach.displayedExitThrottleDeficit).toBeGreaterThan(0);
  });

  // The longest wording the row can carry is an inactive one, not a call, so
  // that is the state the plate has to be sized against.
  it('states the longest wording the row can carry', () => {
    const coach = seed('driving-coach-inactive').drivingCoachWidget;

    expect(coach.inactiveReason).toBe('no-corners');
  });
});

describe('weather scenarios', () => {
  it('declares the track wet with rain falling', () => {
    const environment = seed('rain').environment.environment;

    expect(environment?.weatherDeclaredWet).toBe(true);
    expect(environment?.precipitation ?? 0).toBeGreaterThan(0);
    expect(environment?.trackWetness ?? 0).toBeGreaterThan(DRY_TRACK_WETNESS);
  });

  it('tops out the wetness scale in heavy rain', () => {
    const heavy = seed('heavy-rain').environment.environment;
    const rain = seed('rain').environment.environment;

    expect(heavy?.trackWetness).toBe(MAX_TRACK_WETNESS);
    expect(heavy?.precipitation ?? 0).toBeGreaterThan(rain?.precipitation ?? 0);
  });

  it('leaves the baseline track dry', () => {
    const environment = seed(DEFAULT_PREVIEW_SCENARIO_ID).environment
      .environment;

    expect(environment?.weatherDeclaredWet).toBe(false);
  });
});

// The standings footer prints the incident count and, where the session caps
// them, the limit beside it — the widest the badge ever gets, and the only
// state that turns it red.
describe('incident scenarios', () => {
  it('runs the player up against a stated limit', () => {
    const store = seed('incident-limit');
    const incidents =
      store.backendComputed.driverIdentities.find((entry) => entry.isPlayer)
        ?.incidents ?? 0;
    const limit = store.session.sessionInfo?.incidentLimit ?? null;

    expect(limit).not.toBeNull();
    expect(incidents).toBeGreaterThan(0);
    expect(isNearIncidentLimit(incidents, limit)).toBe(true);
  });

  it('leaves the baseline uncounted', () => {
    const store = seed(DEFAULT_PREVIEW_SCENARIO_ID);
    const incidents =
      store.backendComputed.driverIdentities.find((entry) => entry.isPlayer)
        ?.incidents ?? 0;

    expect(incidents).toBe(0);
  });
});

// Pairs the registry and the manifests in both directions, the way the widget
// catalog and widget registry tests already pair two globs.
describe('scenario declarations', () => {
  const declared = new Map<string, string>();

  for (const manifest of WIDGETS) {
    for (const scenarioId of manifest.previewScenarios ?? []) {
      declared.set(scenarioId, manifest.id);
    }
  }

  it('declares only scenarios the registry ships', () => {
    const shipped = new Set(PREVIEW_SCENARIOS.map((scenario) => scenario.id));

    for (const [scenarioId, widgetId] of declared) {
      expect(shipped, `${widgetId} declares ${scenarioId}`).toContain(
        scenarioId
      );
    }
  });

  it('ships only scenarios some widget declares', () => {
    for (const scenario of PREVIEW_SCENARIOS) {
      if (scenario.id === DEFAULT_PREVIEW_SCENARIO_ID) {
        continue;
      }

      expect(
        declared.has(scenario.id),
        `no widget declares ${scenario.id}`
      ).toBe(true);
    }
  });

  it('never declares the same scenario twice in one manifest', () => {
    for (const manifest of WIDGETS) {
      const scenarios = manifest.previewScenarios ?? [];

      expect(new Set(scenarios).size, manifest.id).toBe(scenarios.length);
    }
  });
});
