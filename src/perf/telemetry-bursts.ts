import type { RootStore } from '@store/root-store';
import type {
  CarPositionsFrame,
  DriverEntriesFrame,
  RelativeFrame,
} from '@/types/bindings';
import type { HotTelemetryField } from './hot-fields';

/**
 * Synthetic bursts, one per hot field, for the render budgets. Test-only, like
 * everything under `src/perf` — nothing the application bundles imports it.
 *
 * Each builder closes over the frame the preview scenario seeded and returns a
 * step that writes one tick of movement through the store's own update method.
 * A widget declaring several hot fields gets all of them advanced on every
 * tick, which is what a real bundle does.
 */

/** One tick of the burst, applied through the store's own update methods. */
export type BurstStep = (store: RootStore) => void;

type FieldStep = (store: RootStore, tick: number) => void;

const TICKS_PER_SECOND = 60;

const CIRCLE = Math.PI * 2;

/** A lap of the track per minute, expressed per tick. */
const LAP_FRACTION_PER_TICK = 1 / (TICKS_PER_SECOND * 60);

/** Nothing to advance — the scenario seeded no frame of this kind. */
const NO_OP: FieldStep = () => {};

const wrapPct = (value: number): number => value - Math.floor(value);

const buildCarDynamicsStep = (store: RootStore): FieldStep => {
  const base = store.player.carDynamics;

  if (!base) {
    return NO_OP;
  }

  return (target, tick) => {
    const phase = (tick / TICKS_PER_SECOND) * CIRCLE;

    target.player.updateCarDynamics({
      ...base,
      speed: 55 + Math.sin(phase) * 10,
      rpm: 6500 + Math.sin(phase * 1.7) * 1500,
      yaw: wrapPct(tick / TICKS_PER_SECOND) * CIRCLE,
      lat_accel: Math.sin(phase) * 12,
      long_accel: Math.cos(phase) * 8,
      steering_wheel_angle: Math.sin(phase) * 2.4,
    });
  };
};

const buildCarInputsStep = (store: RootStore): FieldStep => {
  const base = store.player.carInputs;

  if (!base) {
    return NO_OP;
  }

  return (target, tick) => {
    const phase = (tick / TICKS_PER_SECOND) * CIRCLE;

    target.player.updateCarInputs({
      ...base,
      throttle: Math.max(0, Math.sin(phase)) ** 0.6,
      brake: Math.max(0, -Math.sin(phase)) * 0.85,
    });
  };
};

/** The surface code for a car that is out on track, from `CarPositionsFrame`. */
const TRACK_SURFACE_ON_TRACK = 3;

/** A car that is not in the world, from `CarPositionsFrame`. */
const TRACK_SURFACE_NOT_IN_WORLD = -1;

/** The same, for a lap distance: the backend sends -1 for a car that is away. */
const LAP_DIST_NOT_IN_WORLD = -1;

/**
 * The scenario seeds no car positions, so the burst builds them from the driver
 * entries it does seed — one lap distance per car, all creeping forward.
 *
 * The arrays are indexed by **car index**, not by the entry's place in the
 * list, because that is how every reader subscripts them
 * (`car_idx_lap_dist_pct[entry.carIdx]`). Indexed by position they would still
 * move while the field happened to be dense, and quietly stop moving — falling
 * through to the reader's static fallback — the moment a scenario had gaps in
 * its car indices, recording every positions-driven widget far below its real
 * cost.
 */
const buildCarPositionsStep = (store: RootStore): FieldStep => {
  const entries = store.backendComputed.driverEntries?.entries ?? [];

  if (entries.length === 0) {
    return NO_OP;
  }

  const slots = Math.max(...entries.map((entry) => entry.carIdx)) + 1;

  return (target, tick) => {
    const advance = tick * LAP_FRACTION_PER_TICK;

    const lapDistPct = new Array<number>(slots).fill(LAP_DIST_NOT_IN_WORLD);
    const trackSurface = new Array<number>(slots).fill(
      TRACK_SURFACE_NOT_IN_WORLD
    );

    for (const entry of entries) {
      lapDistPct[entry.carIdx] = wrapPct(entry.lapDistPct + advance);
      trackSurface[entry.carIdx] = TRACK_SURFACE_ON_TRACK;
    }

    const frame: CarPositionsFrame = {
      car_idx_lap_dist_pct: lapDistPct,
      car_idx_track_surface: trackSurface,
    };

    target.cars.updateCarPositions(frame);
  };
};

const buildLapDeltaStep = (store: RootStore): FieldStep => {
  const base = store.backendComputed.lapDelta;

  if (!base) {
    return NO_OP;
  }

  return (target, tick) => {
    const drift = Math.sin(tick / TICKS_PER_SECOND) * 0.4;

    target.backendComputed.updateLapDelta({
      ...base,
      sectorDeltas: base.sectorDeltas.map((delta) =>
        delta === null ? null : delta + drift
      ),
    });
  };
};

const advanceEntries = <Frame extends DriverEntriesFrame | RelativeFrame>(
  frame: Frame,
  advance: number
): Frame => ({
  ...frame,
  entries: frame.entries.map((entry) => ({
    ...entry,
    lapDistPct: wrapPct(entry.lapDistPct + advance),
    relativeLapDist: entry.relativeLapDist + advance,
    estTime: entry.estTime + advance,
  })),
});

const buildDriverEntriesStep = (store: RootStore): FieldStep => {
  const base = store.backendComputed.driverEntries;

  if (!base) {
    return NO_OP;
  }

  return (target, tick) => {
    target.backendComputed.updateDriverEntries(
      advanceEntries(base, tick * LAP_FRACTION_PER_TICK)
    );
  };
};

const buildRelativeStep = (store: RootStore): FieldStep => {
  const base = store.backendComputed.relative;

  if (!base) {
    return NO_OP;
  }

  return (target, tick) => {
    target.backendComputed.updateRelative(
      advanceEntries(base, tick * LAP_FRACTION_PER_TICK)
    );
  };
};

const buildProximityStep = (store: RootStore): FieldStep => {
  const base = store.backendComputed.proximity;

  if (!base) {
    return NO_OP;
  }

  return (target, tick) => {
    const closing = Math.sin(tick / TICKS_PER_SECOND) * 3;

    target.backendComputed.updateProximity({
      ...base,
      nearbyCars: base.nearbyCars.map((car) => ({
        ...car,
        longitudinalDist: car.longitudinalDist + closing,
        clearance: Math.abs(car.longitudinalDist + closing),
      })),
    });
  };
};

const STEP_BUILDERS: Record<
  HotTelemetryField,
  (store: RootStore) => FieldStep
> = {
  carDynamics: buildCarDynamicsStep,
  carInputs: buildCarInputsStep,
  carPositions: buildCarPositionsStep,
  lapDelta: buildLapDeltaStep,
  driverEntries: buildDriverEntriesStep,
  relative: buildRelativeStep,
  proximity: buildProximityStep,
};

export const buildHotFieldBurst = (
  store: RootStore,
  fields: readonly HotTelemetryField[],
  frameCount: number
): BurstStep[] => {
  const steps = fields.map((field) => STEP_BUILDERS[field](store));

  return Array.from(
    { length: frameCount },
    (_unused, tick) => (target: RootStore) => {
      for (const step of steps) {
        step(target, tick);
      }
    }
  );
};
