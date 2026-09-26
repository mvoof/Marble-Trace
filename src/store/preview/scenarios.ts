import type {
  CarDynamicsFrame,
  CarStatusFrame,
  PitTargetFrame,
  RaceFlags,
  SessionEntry,
  SessionFrame,
} from '@/types/bindings';
import type { PreviewScenarioId } from '@/types/preview-scenarios';
import { action } from 'mobx';
import type { RootStore } from '@store/root-store';
import { seedSampleTelemetry, syncFlagDisplay } from './sample-telemetry';
import { mockFlags } from './mocks/flags';
import {
  mockPitCarStatus,
  mockPitService,
  mockPitStallDynamics,
  mockPitTarget,
} from './mocks/pit';
import { mockFuel } from './mocks/fuel';
import type { MockFieldOptions } from './mocks/field';
import {
  mockField,
  mockIncidents,
  mockPaceCarEntry,
  PACE_CAR_IDX,
  TRACK_SURFACE_ON_TRACK,
} from './mocks/field';
import type { MockTrafficCar } from './mocks/traffic';
import { mockProximity } from './mocks/traffic';
import {
  mockLapDelta,
  mockLapTimingAtDelta,
  mockPersonalBestLapLog,
} from './mocks/delta';
import {
  mockCarStatus,
  mockGtpCarStatus,
  mockHybridCarStatus,
  OIL_TEMP_WARNING_C,
  WATER_TEMP_WARNING_C,
} from './mocks/engine';
import {
  mockReferenceLap,
  mockReferenceLapWithoutCorners,
  referenceSpeedKmhAt,
} from './mocks/coach';
import type { MockTrackCondition } from './mocks/weather';
import { mockEnvironment } from './mocks/weather';
import {
  mockSession,
  mockSessionEntry,
  RACE_SESSION_NUM,
  UNLIMITED_REMAIN_S,
} from './mocks/timing';

// Neutral, fully synthetic scenario fixtures. A recorded session never
// guarantees the moment a flag waves, a badge appears, or traffic surrounds the
// player — and rarely from the first frame. Scenarios deterministically force
// those states on top of the realistic base snapshot, so both the in-app widget
// preview and Storybook can show a specific state on demand. Depends on neither
// the app UI nor Storybook.

const applyFlags = (store: RootStore, overrides: Partial<RaceFlags>) => {
  const carStatus = store.player.carStatus;

  if (!carStatus) {
    return;
  }

  store.player.updateCarStatus({
    ...carStatus,
    flags: mockFlags(overrides),
  });

  syncFlagDisplay(store);
};

const PIT_LANE_RPM = 2800;
const PIT_LANE_GEAR = 2;

// A traffic scenario states where the cars are and nothing else: the clearance,
// the bumper gaps, the order and the four radar distances are all derived by
// the builder the way the backend derives them from a real tick.
const applyTraffic = (store: RootStore, cars: MockTrafficCar[]) => {
  store.backendComputed.updateProximity(mockProximity(cars));
};

// A weather scenario states the track condition and nothing else: the
// temperatures, the humidity and the sky that come with rain are the builder's,
// so two scenarios differ only in how wet the track is. The frame is replaced
// rather than patched — a wetness laid over the snapshot's dry numbers is a
// picture no session ever shows.
const applyWeather = (store: RootStore, condition: MockTrackCondition) => {
  store.environment.updateEnvironment(mockEnvironment(condition));
};

const applyDynamics = (
  store: RootStore,
  overrides: Partial<CarDynamicsFrame>
) => {
  const carDynamics = store.player.carDynamics;

  if (!carDynamics) {
    return;
  }

  store.player.updateCarDynamics({ ...carDynamics, ...overrides });
};

// The three pit-lane scenarios differ only in where the car is along the lane,
// how fast it is going and whether the limiter is armed; everything else about
// being in the pits is the same, so it is stated once.
const applyPitLane = (
  store: RootStore,
  {
    limiterOn,
    speedKmh,
    pitTarget,
  }: {
    limiterOn: boolean;
    speedKmh: number;
    pitTarget: Partial<PitTargetFrame>;
  }
) => {
  const sessionInfo = store.session.sessionInfo;

  store.player.updateCarStatus(mockPitCarStatus({ limiterOn }));

  if (sessionInfo) {
    store.session.updateSessionInfo({
      ...sessionInfo,
      trackPitSpeedLimit: '55 kph',
    });
  }

  store.player.updatePitTarget(mockPitTarget(pitTarget));

  applyDynamics(store, {
    speed: speedKmh / 3.6,
    rpm: PIT_LANE_RPM,
    gear: PIT_LANE_GEAR,
  });
};

// The stop itself: the car standing in its own stall with the crew working on
// it. Stated as one helper because nothing about it varies — what a driver
// sizes the box against is the full order being serviced at once, and the
// countdowns that ride beside it belong to the tow scenario instead.
const applyPitBox = (store: RootStore) => {
  store.player.updateCarStatus(mockPitCarStatus({ limiterOn: true }));
  store.player.updatePitTarget(
    mockPitTarget({ target: 'pitbox', distM: 0, laneProgressPct: 0.42 })
  );
  store.player.updatePitService(
    mockPitService({
      changeLf: true,
      changeRf: true,
      changeLr: true,
      changeRr: true,
      addFuel: true,
      fuelAmount: 52.4,
      inPitStall: true,
      serviceActive: true,
    })
  );

  applyDynamics(store, mockPitStallDynamics());
};

// Puts the stored best lap in place and the player somewhere on it, so the
// coach has a reference, a corner and a position to evaluate against.
// `atPct` is where on the lap the player sits; `deltaKmh` offsets their live
// speed from the reference's at that point (negative = slower than reference).
const applyCoachReference = (
  store: RootStore,
  { atPct, deltaKmh }: { atPct: number; deltaKmh: number }
) => {
  store.referenceLap.updateReferenceLap(mockReferenceLap());

  const lapTiming = store.player.lapTiming;

  if (lapTiming) {
    store.player.updateLapTiming({ ...lapTiming, lap_dist_pct: atPct });
  }

  applyDynamics(store, {
    speed: (referenceSpeedKmhAt(atPct) + deltaKmh) / 3.6,
  });
};

// The standings and the relative draw the same field frames, so a field
// scenario always states both — a driver sizing one and then the other must be
// looking at the same grid.
const applyField = (store: RootStore, options: MockFieldOptions) => {
  const standings = store.backendComputed.driverEntries;

  if (!standings) {
    return;
  }

  const frames = mockField(standings.entries, options);

  store.backendComputed.updateDriverEntries(frames.driverEntries);
  store.backendComputed.updateRelative(frames.relative);
};

// The incident counter is the player's own, so a scenario states it on their
// entry and on the session that caps it and hands out penalties — the halves of
// what the badges print, and of whether they are alarmed.
const applyIncidents = (
  store: RootStore,
  {
    incidents,
    incidentLimit,
    incidentPenaltyInitial,
    incidentPenaltySubsequent,
  }: {
    incidents: number;
    incidentLimit: number | null;
    incidentPenaltyInitial: number | null;
    incidentPenaltySubsequent: number | null;
  }
) => {
  const standings = store.backendComputed.driverEntries;
  const sessionInfo = store.session.sessionInfo;

  if (standings) {
    store.backendComputed.updateDriverEntries({
      ...standings,
      entries: standings.entries.map((entry) =>
        entry.isPlayer ? { ...entry, incidents } : entry
      ),
    });
  }

  if (sessionInfo) {
    store.session.updateSessionInfo({
      ...sessionInfo,
      incidentLimit,
      incidentPenaltyInitial,
      incidentPenaltySubsequent,
    });
  }
};

/** Where the safety car is put: a third of the way round, clear of the player. */
const PACE_CAR_LAP_PCT = 0.35;

// A safety car reaches the map through the session roster and the per-car
// arrays rather than as a driver entry, the way the sim reports it — so a
// scenario states one in both places at once. The recorded session has none:
// nobody records a caution on request.
const applyPaceCar = (store: RootStore) => {
  const sessionInfo = store.session.sessionInfo;
  const positions = store.cars.carPositions;
  const player = store.backendComputed.driverEntries?.entries.find(
    (entry) => entry.isPlayer
  );

  if (!sessionInfo || !positions) {
    return;
  }

  const template = sessionInfo.cars[0];

  if (!template) {
    return;
  }

  store.session.updateSessionInfo({
    ...sessionInfo,
    cars: [
      ...sessionInfo.cars,
      mockPaceCarEntry(template, {
        carClassId: player?.carClassId ?? template.carClassId,
        carClassColor: player?.carClassColor ?? template.carClassColor,
      }),
    ],
  });

  const lapDistPct = [...positions.car_idx_lap_dist_pct];
  const trackSurface = [...positions.car_idx_track_surface];

  lapDistPct[PACE_CAR_IDX] = PACE_CAR_LAP_PCT;
  trackSurface[PACE_CAR_IDX] = TRACK_SURFACE_ON_TRACK;

  store.cars.updateCarPositions({
    ...positions,
    car_idx_lap_dist_pct: lapDistPct,
    car_idx_track_surface: trackSurface,
  });
};

// A delta scenario states one number: the same gap against every reference the
// widget can be switched to, so the treatment is what changes between them and
// not the value. The timing frame is replaced rather than patched — the
// recorded one has no reference established, and a delta layered onto that
// would still read as no delta.
const applyDelta = (store: RootStore, delta: number) => {
  store.player.updateLapTiming(mockLapTimingAtDelta(delta));
};

// An engine scenario replaces the status frame rather than patching it: the
// recorded one was captured in the garage, with the oil pressure and every
// in-car adjustment still at zero, so a temperature layered onto it would sit
// beside a dead panel.
const applyEngine = (store: RootStore, overrides: Partial<CarStatusFrame>) => {
  store.player.updateCarStatus(mockCarStatus(overrides));
};

// A timing scenario states the clock and the lap limit together — which of the
// two the timer counts is decided by the session entry, not by the frame, so
// stating one without the other reads as the session it is not. The recorded
// entry's results are carried over: the qualifying order hangs off them.
const applySessionClock = (
  store: RootStore,
  session: Partial<SessionFrame>,
  entry: Partial<SessionEntry>
) => {
  const sessionInfo = store.session.sessionInfo;
  const frame = mockSession(session);

  store.session.updateSession(frame);

  if (!sessionInfo) {
    return;
  }

  // The entry the timer reads is the one the frame points at, so the index
  // comes off the frame rather than off the constant it defaults to.
  const sessionNum = frame.session_num ?? RACE_SESSION_NUM;
  const recorded = sessionInfo.sessions[sessionNum];
  const sessions = [...sessionInfo.sessions];

  sessions[sessionNum] = mockSessionEntry({
    resultsPositions: recorded?.resultsPositions ?? [],
    ...entry,
  });

  store.session.updateSessionInfo({
    ...sessionInfo,
    currentSessionNum: sessionNum,
    sessions,
  });
};

/**
 * Who the scenario is offered to. A `'widget'` scenario states one domain and
 * belongs to the widgets that declare it; a `'session'` scenario states a whole
 * moment of a race and belongs to the layout editor, which seeds every widget
 * on the canvas from it at once. Left out, a scenario is a widget one.
 */
export type PreviewScenarioScope = 'widget' | 'session';

export interface PreviewScenario {
  id: PreviewScenarioId;
  label: string;
  scope?: PreviewScenarioScope;
  apply: (store: RootStore) => void;
}

export const DEFAULT_PREVIEW_SCENARIO_ID: PreviewScenarioId = 'baseline';

// Each scenario layers a forced state on top of the realistic base snapshot.
const WIDGET_SCENARIOS: PreviewScenario[] = [
  {
    id: 'baseline',
    label: 'Baseline',
    apply: (store) => {
      seedSampleTelemetry(store);
    },
  },
  {
    id: 'yellow-flag',
    label: 'Yellow flag (local)',
    apply: (store) => {
      seedSampleTelemetry(store);
      // A local yellow only — no caution bit. The two are separate states the
      // widgets draw differently, and raising both here would leave the plain
      // yellow unreachable: the caution outranks it.
      applyFlags(store, { yellow: true, yellowWaving: true });
    },
  },
  {
    id: 'safety-car',
    label: 'Safety car (full-course caution)',
    apply: (store) => {
      seedSampleTelemetry(store);
      applyFlags(store, { yellow: true, caution: true, cautionWaving: true });
    },
  },
  {
    id: 'blue-flag',
    label: 'Blue flag',
    apply: (store) => {
      seedSampleTelemetry(store);
      applyFlags(store, { blue: true });
    },
  },
  {
    id: 'black-flag',
    label: 'Black flag',
    apply: (store) => {
      seedSampleTelemetry(store);
      applyFlags(store, { black: true });
    },
  },
  {
    id: 'dq-flag',
    label: 'Disqualify flag (DQ)',
    apply: (store) => {
      seedSampleTelemetry(store);
      applyFlags(store, { disqualify: true });
    },
  },
  {
    id: 'green-flag',
    label: 'Green flag',
    apply: (store) => {
      seedSampleTelemetry(store);
      applyFlags(store, { green: true });
    },
  },
  {
    id: 'white-flag',
    label: 'White flag (last lap)',
    apply: (store) => {
      seedSampleTelemetry(store);
      applyFlags(store, { white: true });
    },
  },
  {
    id: 'checkered-flag',
    label: 'Checkered flag',
    apply: (store) => {
      seedSampleTelemetry(store);
      applyFlags(store, { checkered: true });
    },
  },
  {
    id: 'red-flag',
    label: 'Red flag',
    apply: (store) => {
      seedSampleTelemetry(store);
      applyFlags(store, { red: true });
    },
  },
  {
    id: 'meatball-flag',
    label: 'Meatball flag (repair)',
    apply: (store) => {
      seedSampleTelemetry(store);
      applyFlags(store, { meatball: true, repair: true });
    },
  },
  {
    id: 'debris-flag',
    label: 'Debris flag',
    apply: (store) => {
      seedSampleTelemetry(store);
      applyFlags(store, { debris: true });
    },
  },
  {
    id: 'radar-traffic',
    label: 'Radar traffic',
    apply: (store) => {
      seedSampleTelemetry(store);
      // Cars on both sides and one closing from behind — everything a scope has
      // to place at once, so a driver sizing the widget sees whether the lanes
      // still read when all of them are occupied.
      applyTraffic(store, [
        { carIdx: 7, longitudinalDist: 1.6, side: 'left' },
        { carIdx: 12, longitudinalDist: -2.1, side: 'left' },
        { carIdx: 3, longitudinalDist: 0.9, side: 'right' },
        { carIdx: 19, longitudinalDist: -7.8, side: 'center' },
      ]);
    },
  },
  {
    id: 'traffic-left',
    label: 'Traffic — car alongside left',
    apply: (store) => {
      seedSampleTelemetry(store);
      // Overlapping door to door: the one place a side lane is drawn at full
      // length and the side pill carries its smallest number.
      applyTraffic(store, [{ carIdx: 7, longitudinalDist: 0.8, side: 'left' }]);
    },
  },
  {
    id: 'traffic-right',
    label: 'Traffic — car alongside right',
    apply: (store) => {
      seedSampleTelemetry(store);
      applyTraffic(store, [
        { carIdx: 3, longitudinalDist: -1.3, side: 'right' },
      ]);
    },
  },
  {
    id: 'traffic-three-wide',
    label: 'Traffic — three wide',
    apply: (store) => {
      seedSampleTelemetry(store);
      // Both sides at once. A radar that reads well with one car beside it can
      // still be unreadable with two, which is the arrangement a driver most
      // wants to have checked before they are in it.
      applyTraffic(store, [
        { carIdx: 7, longitudinalDist: 0.6, side: 'left' },
        { carIdx: 3, longitudinalDist: -0.4, side: 'right' },
      ]);
    },
  },
  {
    id: 'traffic-rear-bumper',
    label: 'Traffic — car on the rear bumper',
    apply: (store) => {
      seedSampleTelemetry(store);
      // Bumper to bumper, still behind rather than alongside: the closest a car
      // gets while the widgets still owe the driver a distance, and the state
      // every warning colour is picked for.
      applyTraffic(store, [
        { carIdx: 3, longitudinalDist: -4.6, side: 'center' },
      ]);
    },
  },
  {
    id: 'close-battle',
    label: 'Close battle — ahead, behind, merged',
    apply: (store) => {
      seedSampleTelemetry(store);
      // One plate ahead, one behind, and a pair close enough to share a third:
      // the three shapes Close Battle can draw, in one frame. The recorded
      // snapshot only ever holds whatever traffic happened to be around, so the
      // merged pair in particular has to be forced. Cars beyond the widget's
      // `maxRows` are dropped, nearest first — raise it to see all three.
      applyTraffic(store, [
        { carIdx: 3, longitudinalDist: -5.2, side: 'center' },
        { carIdx: 7, longitudinalDist: 9.4, side: 'center' },
        { carIdx: 12, longitudinalDist: -16, side: 'center' },
        { carIdx: 19, longitudinalDist: -17.1, side: 'center' },
      ]);
    },
  },
  {
    id: 'rain',
    label: 'Rain',
    apply: (store) => {
      seedSampleTelemetry(store);
      applyWeather(store, 'wet');
    },
  },
  {
    id: 'heavy-rain',
    label: 'Heavy rain',
    apply: (store) => {
      seedSampleTelemetry(store);
      // The top of the wetness scale, which is both the widest surface label
      // and the state the wet readouts are colored for. A dry track is not a
      // scenario beside these two — it is what the snapshot already carries.
      applyWeather(store, 'heavy-rain');
    },
  },
  {
    id: 'high-g',
    label: 'High G',
    apply: (store) => {
      seedSampleTelemetry(store);
      applyDynamics(store, { lat_accel: 17.6, long_accel: -12.4 });
    },
  },
  {
    id: 'driving-coach-brake',
    label: 'Driving Coach — Brake',
    apply: (store) => {
      seedSampleTelemetry(store);
      // The advisory itself is forced rather than computed: the reaction that
      // evaluates it never runs in this isolated preview store, so nothing
      // overrides what is written here — same reasoning as `radar.visible`
      // above. The reference lap still has to be a real one, corner and all:
      // without a braking zone in it the coach reports `no-corners` and draws
      // that over every call a scenario asks for.
      store.drivingCoachWidget.displayedAdvisory = 'brake';
      // Into the braking zone and carrying too much speed for it.
      applyCoachReference(store, { atPct: 0.475, deltaKmh: 12 });
      store.drivingCoachWidget.displayedBrakeUrgency = 1;
    },
  },
  {
    id: 'driving-coach-brake-soon',
    label: 'Driving Coach — Brake soon',
    apply: (store) => {
      seedSampleTelemetry(store);
      // The amber step between the all-clear and the hard call: still neutral,
      // but pre-armed, which is the one state that swaps the delta for a
      // countdown to the braking point.
      applyCoachReference(store, { atPct: 0.44, deltaKmh: 0 });
      store.drivingCoachWidget.displayedBrakeUrgency = 0.85;
    },
  },
  {
    id: 'driving-coach-gas',
    label: 'Driving Coach — Gas',
    apply: (store) => {
      seedSampleTelemetry(store);
      store.drivingCoachWidget.displayedAdvisory = 'gas';
      // Out of the corner, short of the reference's speed and its pedal.
      applyCoachReference(store, { atPct: 0.52, deltaKmh: -8 });
      store.drivingCoachWidget.displayedExitLateM = 14;
      store.drivingCoachWidget.displayedExitThrottleDeficit = 0.22;
    },
  },
  {
    id: 'driving-coach-grip',
    label: 'Driving Coach — Grip',
    apply: (store) => {
      seedSampleTelemetry(store);
      // Not an instruction but a refusal to give one — the car is being caught
      // and corrected, and the call takes neither of the two configured colors.
      store.drivingCoachWidget.displayedAdvisory = 'grip';
      applyCoachReference(store, { atPct: 0.52, deltaKmh: -6 });
    },
  },
  {
    id: 'driving-coach-inactive',
    label: 'Driving Coach — Nothing to compare',
    apply: (store) => {
      seedSampleTelemetry(store);
      // The widest the row ever gets: the longest call the coach can make and
      // the longest hint under it, which is what the plate has to be sized
      // against — not BRAKE. A reference with no braking zone in it is exactly
      // the state that produces it, so it is stated by seeding one rather than
      // by writing the words anywhere.
      applyCoachReference(store, { atPct: 0.5, deltaKmh: 0 });
      store.referenceLap.updateReferenceLap(mockReferenceLapWithoutCorners());
    },
  },
  {
    id: 'field-close-pack',
    label: 'Field — close pack',
    apply: (store) => {
      seedSampleTelemetry(store);
      // Sub-second between every car, which is what the gap column has to carry
      // a decimal for. The rest of what the two tables are sized against — a
      // three-class grid, the longest names a driver can carry, cars sitting in
      // their boxes — the snapshot already holds, so the baseline shows it and
      // no scenario repeats it.
      applyField(store, { gapS: 0.4 });
    },
  },
  {
    id: 'pace-car-on-track',
    label: 'Track — safety car out',
    apply: (store) => {
      seedSampleTelemetry(store);
      applyPaceCar(store);
    },
  },
  {
    id: 'incident-zones',
    label: 'Track — incidents on the lap',
    apply: (store) => {
      seedSampleTelemetry(store);
      // One car still in trouble and one already recovered, so the blinking
      // zone and the lingering marker are on the map at the same time — the
      // only moment the two treatments can be compared against each other.
      store.backendComputed.updateIncidents(mockIncidents());
    },
  },
  {
    id: 'incident-limit',
    label: 'Incidents — near the limit',
    apply: (store) => {
      seedSampleTelemetry(store);
      // The counter at its widest and its loudest at once: a session that caps
      // incidents prints the limit beside the count, one that hands out a
      // penalty every few incidents adds its own badge, and close enough to
      // either they turn red. The recorded session has none of it — nobody sits
      // on a limit for a recording — so all of it is stated here.
      applyIncidents(store, {
        incidents: 15,
        incidentLimit: 17,
        incidentPenaltyInitial: 8,
        incidentPenaltySubsequent: 4,
      });
    },
  },
  {
    id: 'pit-tow',
    label: 'Pit — towing',
    apply: (store) => {
      seedSampleTelemetry(store);
      // On the hook with both repair clocks still running: the three countdowns
      // the box can carry at once, which is the tallest it ever gets.
      store.player.updatePitService(
        mockPitService({
          towTimeS: 42,
          repairLeftS: 18.4,
          optRepairLeftS: 6,
        })
      );

      applyDynamics(store, mockPitStallDynamics());
    },
  },
  {
    id: 'pit-lane',
    label: 'Pit — no limiter',
    apply: (store) => {
      seedSampleTelemetry(store);
      // Just through the entry line with the limiter still off: the lane bar
      // starts filling and the box is most of a lane away.
      applyPitLane(store, {
        limiterOn: false,
        speedKmh: 40,
        pitTarget: { laneProgressPct: 0.15, distM: 126, target: 'pitbox' },
      });
    },
  },
  {
    id: 'pit-limiter',
    label: 'Pit — limiter active',
    apply: (store) => {
      seedSampleTelemetry(store);
      // Closing on the stall under the limiter — the box countdown is inside
      // the cue distance, which is when it turns green.
      applyPitLane(store, {
        limiterOn: true,
        speedKmh: 52,
        pitTarget: { laneProgressPct: 0.4, distM: 38, target: 'pitbox' },
      });
    },
  },
  {
    id: 'pit-over-limit',
    label: 'Pit — over speed limit',
    apply: (store) => {
      seedSampleTelemetry(store);
      // Past the stall and running for the exit, over the cap: the widest the
      // speed block ever gets, with the bar counting down to pit exit.
      applyPitLane(store, {
        limiterOn: true,
        speedKmh: 70,
        pitTarget: { laneProgressPct: 0.7, distM: 107, target: 'pitExit' },
      });
    },
  },
  {
    id: 'pit-service',
    label: 'Pit — service under way',
    apply: (store) => {
      seedSampleTelemetry(store);
      // Stopped in the box with every corner ordered and the fuel going in —
      // the state the recording never reached without driving a stop, and the
      // only one that lights the whole panel at once.
      applyPitBox(store);
    },
  },
  {
    id: 'fuel-pit-window',
    label: 'Fuel — pit window open',
    apply: (store) => {
      seedSampleTelemetry(store);
      // The window is open and the laps left are below the warning threshold,
      // which is what makes the pit-window block appear at all.
      store.backendComputed.updateFuel(
        mockFuel({
          lapsRemaining: 2.4,
          pitWarning: true,
          pitWindowStart: 12,
          pitWindowEnd: 16,
        })
      );
    },
  },
  {
    id: 'fuel-short',
    label: 'Fuel — running short',
    apply: (store) => {
      seedSampleTelemetry(store);
      // A deficit big enough to need saving for the rest of the race: the
      // widest the shortage and save-per-lap readouts ever get.
      store.backendComputed.updateFuel(
        mockFuel({
          lapsRemaining: 4.1,
          lapsToFinish: 28,
          shortage: -18.7,
          fuelSavePerLap: 0.78,
          pitWarning: true,
        })
      );
    },
  },
  {
    id: 'fuel-refuel-calc',
    label: 'Fuel — refuelling calculation',
    apply: (store) => {
      seedSampleTelemetry(store);
      // Two stops left and a three-digit total to take on — the most digits the
      // refuel rows can carry.
      store.backendComputed.updateFuel(
        mockFuel({
          lapsRemaining: 6.8,
          lapsToFinish: 52,
          shortage: -104.3,
          fuelToAdd: 104.3,
          fuelToAddWithBuffer: 110.5,
          refuelPlan: { stops: 2, fillNow: 62.5 },
          pitWarning: true,
        })
      );
    },
  },
  {
    id: 'delta-ahead',
    label: 'Delta — up on the reference',
    apply: (store) => {
      seedSampleTelemetry(store);
      // Negative, so the sign is on screen: the one case that tells a driver
      // whether the minus shifts the digits beside it when it appears.
      applyDelta(store, -0.284);
    },
  },
  {
    id: 'delta-behind',
    label: 'Delta — down on the reference',
    apply: (store) => {
      seedSampleTelemetry(store);
      applyDelta(store, 0.617);
    },
  },
  {
    id: 'delta-personal-best',
    label: 'Delta — personal best just set',
    apply: (store) => {
      seedSampleTelemetry(store);
      // The lap has just been banked as a best: the log stars it, the header
      // carries the new time, and the delta widget flashes it for anyone who
      // has the flash switched on. The live delta sits on the reference the
      // lap has just become.
      const bestLapNum = 11;
      const bestLapTime = 90.412;

      store.player.updateLapTiming(
        mockLapTimingAtDelta(0, {
          lap: bestLapNum + 1,
          lap_current_lap_time: 4.318,
          lap_last_lap_time: bestLapTime,
          lap_best_lap_time: bestLapTime,
        })
      );
      store.backendComputed.updateLapLog(
        mockPersonalBestLapLog(bestLapNum, bestLapTime)
      );
    },
  },
  {
    id: 'sector-in-progress',
    label: 'Sectors — one banked, one running',
    apply: (store) => {
      seedSampleTelemetry(store);
      // The first sector is behind the driver and green; the second is being
      // driven and has no time yet; the third has not been reached. The matrix
      // draws all three states at once only in this window of the lap, so it is
      // the one a driver has to size it against.
      store.backendComputed.updateLapDelta(
        mockLapDelta({
          sectorTimes: [28.187, null, null],
          currentSectorIdx: 1,
          sectorDeltas: [-0.349, null, null],
        })
      );
    },
  },
  {
    id: 'engine-oil-overheat',
    label: 'Engine — oil overheating',
    apply: (store) => {
      seedSampleTelemetry(store);
      // Past the threshold the panel flashes at, and far enough past it that
      // the reading carries three digits — the widest the oil cell ever gets.
      applyEngine(store, {
        oil_temp: OIL_TEMP_WARNING_C + 12,
        oil_press: 286,
        water_temp: 108,
      });
    },
  },
  {
    id: 'engine-water-overheat',
    label: 'Engine — water overheating',
    apply: (store) => {
      seedSampleTelemetry(store);
      // The water cell alone. The two overheats are separate scenarios because
      // a panel that reads well with one cell flashing can be unreadable with
      // two, and a driver sizing it has to see each treatment on its own.
      applyEngine(store, {
        water_temp: WATER_TEMP_WARNING_C + 9,
        oil_temp: 128,
      });
    },
  },
  {
    id: 'hybrid-deploying',
    label: 'Hybrid — deploying',
    apply: (store) => {
      seedSampleTelemetry(store);
      // Synthetic rather than recorded, for the reason test-data/README gives:
      // a captured lap cannot be relied on to hold a full battery mid-deploy at
      // its first frame. A formula car, so the deploy-mode strip has a selector
      // to mirror — the prototypes park that field on one value.
      store.player.updateCarStatus(
        mockHybridCarStatus({
          energy_ers_battery_pct: 0.9,
          power_mgu_k: 102_556,
          dc_mguk_deploy_mode: 1,
        })
      );
    },
  },
  {
    id: 'hybrid-harvesting',
    label: 'Hybrid — harvesting',
    apply: (store) => {
      seedSampleTelemetry(store);
      // The other side of the sign, at a charge low enough to put the bar on
      // its amber step — the two states are separate scenarios because the
      // widget changes colour as well as wording between them.
      store.player.updateCarStatus(
        mockHybridCarStatus({
          energy_ers_battery_pct: 0.41,
          power_mgu_k: -211_110,
          dc_mguk_deploy_mode: 3,
        })
      );
      applyDynamics(store, { speed: 62, rpm: 9_800, gear: 4 });
    },
  },
  {
    id: 'drs-armed',
    label: 'DRS — armed',
    apply: (store) => {
      seedSampleTelemetry(store);
      // Past the detection point with the zone still ahead: the press does
      // nothing yet, which is the whole reason this state is drawn apart from
      // ready rather than folded into it.
      store.player.updateCarStatus(mockHybridCarStatus({ drs: 'Armed' }));
      applyDynamics(store, { speed: 76, rpm: 10_200, gear: 6 });
    },
  },
  {
    id: 'drs-ready',
    label: 'DRS — ready',
    apply: (store) => {
      seedSampleTelemetry(store);
      // Inside the activation zone with the flap closed: the one state that
      // asks the driver to do something.
      store.player.updateCarStatus(mockHybridCarStatus({ drs: 'Ready' }));
      applyDynamics(store, { speed: 79, rpm: 10_500, gear: 7 });
    },
  },
  {
    id: 'drs-open',
    label: 'DRS — open',
    apply: (store) => {
      seedSampleTelemetry(store);
      store.player.updateCarStatus(mockHybridCarStatus({ drs: 'Open' }));
      applyDynamics(store, { speed: 83, rpm: 11_200, gear: 8 });
    },
  },
  {
    id: 'engine-stalled',
    label: 'Engine — stalled',
    apply: (store) => {
      seedSampleTelemetry(store);
      // Engine off and the car sitting still: the oil pressure falls away and
      // the electrical system drops to what the battery alone holds.
      applyEngine(store, {
        oil_press: 0,
        voltage: 12.2,
        oil_temp: 96,
        water_temp: 88,
      });
      applyDynamics(store, { speed: 0, rpm: 0, gear: 0 });
    },
  },
  {
    id: 'engine-formula-car',
    label: 'Engine — formula car, every adjustment',
    apply: (store) => {
      seedSampleTelemetry(store);
      // The widest the engine panel ever gets: a car that publishes all three
      // differentials, both traction channels and the fine and peak bias, and
      // no ABS at all. Sizing the panel against a GT3 and then driving a
      // formula car is how a widget ends up two rows taller than the space the
      // driver left for it.
      store.player.updateCarStatus(mockHybridCarStatus());
    },
  },
  {
    id: 'engine-gtp-car',
    label: 'Engine — GTP prototype',
    apply: (store) => {
      seedSampleTelemetry(store);
      // Between the two: ABS and engine braking a formula car has no cell for,
      // and no differential to adjust from the wheel.
      store.player.updateCarStatus(mockGtpCarStatus());
    },
  },
  {
    id: 'engine-gt3-car',
    label: 'Engine — GT3, what the car publishes',
    apply: (store) => {
      seedSampleTelemetry(store);
      // The other end: four adjustments, and every cell the car does not
      // declare gone from the panel rather than reading `--` forever.
      applyEngine(store, {});
    },
  },
  {
    id: 'timer-final-minute',
    label: 'Timer — final minute',
    apply: (store) => {
      seedSampleTelemetry(store);
      // Inside the last minute of a timed race, which is when the clock gets
      // its critical treatment and when a driver is least able to read a
      // readout they have not looked at before.
      applySessionClock(
        store,
        { session_time_remain: 47.4, session_time: 3552.6 },
        { sessionLaps: 'unlimited' }
      );
    },
  },
  {
    id: 'timer-lap-limited',
    label: 'Timer — lap-limited race',
    apply: (store) => {
      seedSampleTelemetry(store);
      // A race that ends on a lap count has no clock at all. iRacing still
      // fills the remaining time — with a week — so the scenario carries the
      // sentinel and the lap limit together, and the timer counts up from the
      // elapsed time rather than printing 168:00:00.
      applySessionClock(
        store,
        {
          session_time_remain: UNLIMITED_REMAIN_S,
          session_time: 1249.7,
          session_laps_remain_ex: 7,
        },
        { sessionLaps: '25' }
      );
    },
  },
];

/** Pace-car speed behind a full-course caution. */
const CAUTION_SPEED_KMH = 90;
/** A wet lap, against which the rain moment's gaps are measured. */
const WET_LAP_TIME_S = 104.8;

// The six moments a driver arranges a layout against. Each is composed from the
// same domain helpers the widget scenarios use — nothing about a race is stated
// twice — and each states enough of the canvas at once that a widget which only
// appears in one of them can be placed with the rest in view.
const SESSION_SCENARIOS: PreviewScenario[] = [
  {
    id: 'session-green',
    label: 'Session — green flag',
    scope: 'session',
    apply: (store) => {
      seedSampleTelemetry(store);
      applyFlags(store, { green: true });
      applySessionClock(
        store,
        { session_time_remain: 2384.6, session_time: 615.4 },
        { sessionLaps: 'unlimited' }
      );
      applyField(store, { gapS: 1.6 });
      applyDelta(store, -0.142);
    },
  },
  {
    id: 'session-traffic',
    label: 'Session — traffic',
    scope: 'session',
    apply: (store) => {
      seedSampleTelemetry(store);
      applyFlags(store, { green: true });
      // The field nose to tail and cars on both sides at once: the moment every
      // widget that reads other cars is at its busiest, which is the one a
      // driver wants the whole canvas measured against.
      applyField(store, { gapS: 0.4 });
      applyTraffic(store, [
        { carIdx: 7, longitudinalDist: 0.9, side: 'left' },
        { carIdx: 3, longitudinalDist: -0.6, side: 'right' },
        { carIdx: 12, longitudinalDist: 7.2, side: 'center' },
        { carIdx: 19, longitudinalDist: -6.4, side: 'center' },
      ]);
      applyDelta(store, 0.208);
    },
  },
  {
    id: 'session-yellow',
    label: 'Session — full-course yellow',
    scope: 'session',
    apply: (store) => {
      seedSampleTelemetry(store);
      applyFlags(store, { yellow: true, caution: true, cautionWaving: true });
      // Behind the pace car: the field is bunched and the whole canvas is being
      // read at a speed a driver actually has time to read it at.
      applyField(store, { gapS: 0.8 });
      applyDynamics(store, {
        speed: CAUTION_SPEED_KMH / 3.6,
        rpm: 3400,
        gear: 3,
      });
    },
  },
  {
    id: 'session-pit-stop',
    label: 'Session — pit stop',
    scope: 'session',
    apply: (store) => {
      seedSampleTelemetry(store);
      applyFlags(store, { green: true });
      // Stopped in the box with the whole order being served. The pit widgets
      // are the ones that appear in no other moment, so this is where they are
      // placed among the rest.
      applyPitBox(store);
      store.backendComputed.updateFuel(
        mockFuel({
          lapsRemaining: 1.8,
          lapsToFinish: 24,
          shortage: -46.2,
          fuelToAdd: 46.2,
          fuelToAddWithBuffer: 52.4,
          pitWarning: true,
        })
      );
    },
  },
  {
    id: 'session-rain',
    label: 'Session — rain',
    scope: 'session',
    apply: (store) => {
      seedSampleTelemetry(store);
      applyFlags(store, { green: true });
      applyWeather(store, 'wet');
      // Wet running spreads the field out and slows the lap, so the gaps are
      // stated wider than the green moment's rather than left at its numbers.
      applyField(store, { gapS: 2.4, lapTimeS: WET_LAP_TIME_S });
      applyDelta(store, 0.734);
    },
  },
  {
    id: 'session-finish',
    label: 'Session — finish',
    scope: 'session',
    apply: (store) => {
      seedSampleTelemetry(store);
      applyFlags(store, { checkered: true });
      // The clock run out with the flag out: every readout at the end of its
      // range at once, which is the state the totals are widest in.
      applySessionClock(
        store,
        {
          session_time_remain: 0,
          session_time: 3600,
          session_state: 'Checkered',
        },
        { sessionLaps: 'unlimited' }
      );
      applyField(store, { gapS: 1.1 });
    },
  },
];

export const PREVIEW_SCENARIOS: PreviewScenario[] = [
  ...WIDGET_SCENARIOS,
  ...SESSION_SCENARIOS,
];

/**
 * What the layout editor's picker offers: the whole-canvas moments, led by the
 * baseline the canvas opens on. A widget's own picker is built from its
 * manifest and so never reaches these.
 */
export const SESSION_PREVIEW_SCENARIOS: PreviewScenario[] = [
  ...WIDGET_SCENARIOS.filter(
    (scenario) => scenario.id === DEFAULT_PREVIEW_SCENARIO_ID
  ),
  ...SESSION_SCENARIOS,
];

// Keyed by plain string: the picked id arrives from component state and from
// story parameters, so a lookup has to be able to miss.
export const PREVIEW_SCENARIO_BY_ID = new Map<string, PreviewScenario>(
  PREVIEW_SCENARIOS.map((scenario) => [scenario.id, scenario])
);

// Wrapped in `action` so the seed + override setters run as a single MobX
// transaction; callers invoke it directly without their own `runInAction`.
export const seedScenario = action(
  (store: RootStore, scenarioId: string = DEFAULT_PREVIEW_SCENARIO_ID) => {
    const scenario =
      PREVIEW_SCENARIO_BY_ID.get(scenarioId) ??
      PREVIEW_SCENARIO_BY_ID.get(DEFAULT_PREVIEW_SCENARIO_ID);

    scenario?.apply(store);
  }
);
