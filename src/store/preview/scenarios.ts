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
import { mockPitTarget } from './mocks/pit';
import { mockFuel } from './mocks/fuel';
import type { MockFieldOptions } from './mocks/field';
import { mockField } from './mocks/field';
import type { MockTrafficCar } from './mocks/traffic';
import { mockProximity } from './mocks/traffic';
import {
  mockLapDelta,
  mockLapTimingAtDelta,
  mockPersonalBestLapLog,
} from './mocks/delta';
import {
  mockCarStatus,
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

/** The pit limiter's bit in the engine warning mask, as the widgets read it. */
const PIT_LIMITER_BIT = 0x10;
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
  const carStatus = store.player.carStatus;
  const sessionInfo = store.session.sessionInfo;

  if (carStatus) {
    store.player.updateCarStatus({
      ...carStatus,
      on_pit_road: true,
      engine_warnings: limiterOn ? PIT_LIMITER_BIT : 0,
    });
  }

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
// entry and on the session that caps it — the two halves of what the badge
// prints, and of whether it is alarmed.
const applyIncidents = (
  store: RootStore,
  {
    incidents,
    incidentLimit,
  }: { incidents: number; incidentLimit: number | null }
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
    store.session.updateSessionInfo({ ...sessionInfo, incidentLimit });
  }
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

export interface PreviewScenario {
  id: PreviewScenarioId;
  label: string;
  apply: (store: RootStore) => void;
}

// Each scenario layers a forced state on top of the realistic base snapshot.
export const PREVIEW_SCENARIOS: PreviewScenario[] = [
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
    id: 'incident-limit',
    label: 'Incidents — near the limit',
    apply: (store) => {
      seedSampleTelemetry(store);
      // The counter at its widest and its loudest at once: a session that caps
      // incidents prints the limit beside the count, and close enough to it the
      // badge turns red and pulses. The recorded session has neither — nobody
      // sits on a limit for a recording — so both are stated here.
      applyIncidents(store, { incidents: 15, incidentLimit: 17 });
    },
  },
  {
    id: 'pit-tow',
    label: 'Pit — towing',
    apply: (store) => {
      seedSampleTelemetry(store);
      const pitService = store.player.pitService;

      if (pitService) {
        store.player.updatePitService({
          ...pitService,
          towTimeS: 42,
          repairLeftS: 18.4,
          optRepairLeftS: 6,
        });
      }

      applyDynamics(store, { speed: 0, rpm: 1200, gear: 0 });
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

// Keyed by plain string: the picked id arrives from component state and from
// story parameters, so a lookup has to be able to miss.
export const PREVIEW_SCENARIO_BY_ID = new Map<string, PreviewScenario>(
  PREVIEW_SCENARIOS.map((scenario) => [scenario.id, scenario])
);

export const DEFAULT_PREVIEW_SCENARIO_ID: PreviewScenarioId = 'baseline';

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
