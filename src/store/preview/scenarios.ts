import type {
  CarDynamicsFrame,
  DriverEntriesFrame,
  DriverEntry,
  EnvironmentFrame,
  NearbyCar,
  ProximityFrame,
  RaceFlags,
  RelativeFrame,
} from '@/types/bindings';
import { action } from 'mobx';
import type { RootStore } from '@store/root-store';
import {
  seedSampleTelemetry,
  syncFlagDisplay,
  sampleFuel,
} from './sample-telemetry';

// Neutral, fully synthetic scenario fixtures. A recorded session never
// guarantees the moment a flag waves, a badge appears, or traffic surrounds the
// player — and rarely from the first frame. Scenarios deterministically force
// those states on top of the realistic base snapshot, so both the in-app widget
// preview and Storybook can show a specific state on demand. Depends on neither
// the app UI nor Storybook.

const ALL_FLAGS_OFF: RaceFlags = {
  checkered: false,
  white: false,
  green: false,
  yellow: false,
  red: false,
  blue: false,
  debris: false,
  yellowWaving: false,
  caution: false,
  cautionWaving: false,
  black: false,
  disqualify: false,
  meatball: false,
  furled: false,
  repair: false,
};

const applyFlags = (store: RootStore, overrides: Partial<RaceFlags>) => {
  const carStatus = store.player.carStatus;

  if (!carStatus) {
    return;
  }

  store.player.updateCarStatus({
    ...carStatus,
    flags: { ...ALL_FLAGS_OFF, ...overrides },
  });

  syncFlagDisplay(store);
};

const buildNearbyCar = (
  carIdx: number,
  longitudinalDist: number,
  lateralSide: NearbyCar['lateralSide']
): NearbyCar => ({
  carIdx,
  longitudinalDist,
  lateralSide,
  clearance: Math.abs(longitudinalDist),
});

const applyProximity = (
  store: RootStore,
  proximity: Partial<ProximityFrame>
) => {
  const frame: ProximityFrame = {
    nearbyCars: proximity.nearbyCars ?? [],
    radarDistances: proximity.radarDistances ?? {
      frontDist: 8,
      rearDist: 8,
      leftDist: null,
      rightDist: null,
    },
    spotterLeft: proximity.spotterLeft ?? false,
    spotterRight: proximity.spotterRight ?? false,
  };

  store.backendComputed.updateProximity(frame);
};

const applyWeather = (
  store: RootStore,
  overrides: Partial<EnvironmentFrame>
) => {
  const environment = store.environment.environment;

  if (!environment) {
    return;
  }

  store.environment.updateEnvironment({ ...environment, ...overrides });
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

const patchEntries = (
  entries: DriverEntry[],
  patch: (entry: DriverEntry, index: number) => DriverEntry
): DriverEntry[] => entries.map(patch);

// Spread a representative mix of in-table states across the first handful of
// rows so badge/status columns render every variant at once.
const withBadges = (entry: DriverEntry, index: number): DriverEntry => {
  if (entry.isPlayer) {
    return entry;
  }

  if (index === 1) {
    return {
      ...entry,
      onPitRoad: true,
      pitState: 'in',
      trackSurface: 'AproachingPits',
    };
  }

  if (index === 2) {
    return {
      ...entry,
      pitState: 'stall',
      trackSurface: 'InPitStall',
      onPitRoad: true,
    };
  }

  if (index === 3) {
    return { ...entry, trackSurface: 'OffTrack' };
  }

  if (index === 4) {
    return { ...entry, pitState: 'exit', onPitRoad: true };
  }

  return entry;
};

const applyTableBadges = (store: RootStore) => {
  const standings = store.backendComputed.standings;
  const relative = store.backendComputed.relative;

  if (standings) {
    const frame: DriverEntriesFrame = {
      ...standings,
      entries: patchEntries(standings.entries, withBadges),
    };

    store.backendComputed.updateStandings(frame);
  }

  if (relative) {
    const frame: RelativeFrame = {
      ...relative,
      entries: patchEntries(relative.entries, withBadges),
    };

    store.backendComputed.updateRelative(frame);
  }
};

export interface PreviewScenario {
  id: string;
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
    label: 'Yellow flag',
    apply: (store) => {
      seedSampleTelemetry(store);
      applyFlags(store, { yellow: true, caution: true });
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
    id: 'radar-traffic',
    label: 'Radar traffic',
    apply: (store) => {
      seedSampleTelemetry(store);
      applyProximity(store, {
        spotterLeft: true,
        spotterRight: true,
        nearbyCars: [
          buildNearbyCar(7, 2.4, 'left'),
          buildNearbyCar(12, -1.8, 'left'),
          buildNearbyCar(3, 3.1, 'right'),
          buildNearbyCar(19, -4.5, 'center'),
        ],
        radarDistances: {
          frontDist: 4,
          rearDist: 5,
          leftDist: 1.2,
          rightDist: 1.6,
        },
      });
    },
  },
  {
    id: 'rain',
    label: 'Rain',
    apply: (store) => {
      seedSampleTelemetry(store);
      applyWeather(store, {
        precipitation: 0.6,
        track_wetness: 5,
        skies: 'Overcast',
        weather_declared_wet: true,
        relative_humidity: 0.85,
      });
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
    id: 'table-badges',
    label: 'Table badges',
    apply: (store) => {
      seedSampleTelemetry(store);
      applyTableBadges(store);
    },
  },
  {
    id: 'fuel-pit',
    label: 'Fuel — pit window',
    apply: (store) => {
      seedSampleTelemetry(store);
      // Drop laps below the pit-warning threshold so the fuel widget's pit
      // window panel becomes visible.
      store.backendComputed.updateFuel({
        ...sampleFuel,
        lapsRemaining: 2,
        shortage: -3.4,
        pitWarning: true,
      });
    },
  },
];

export const PREVIEW_SCENARIO_BY_ID = new Map(
  PREVIEW_SCENARIOS.map((scenario) => [scenario.id, scenario])
);

export const DEFAULT_PREVIEW_SCENARIO_ID = 'baseline';

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
