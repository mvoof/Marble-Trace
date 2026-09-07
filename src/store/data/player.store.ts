import { makeAutoObservable, observable } from 'mobx';

import type {
  CarDynamicsFrame,
  CarInputsFrame,
  CarStatusFrame,
  ChassisFrame,
  LapTimingFrame,
  PitServiceFrame,
  PitTargetFrame,
} from '@/types/bindings';

export class PlayerStore {
  /**
   * 60 Hz hot field — never read directly in a component render body. Read it
   * inside `useReactiveDomWrite`/`useReactiveCanvasLoop`; `oxlint` enforces
   * this (`no-restricted-properties`) for `src/ui/**\/*.tsx`.
   * @remarks See "The hot/cold split" in `docs/rendering.md`.
   */
  carDynamics: CarDynamicsFrame | null = null;
  /**
   * 60 Hz hot field — never read directly in a component render body. Read it
   * inside `useReactiveDomWrite`/`useReactiveCanvasLoop`; `oxlint` enforces
   * this (`no-restricted-properties`) for `src/ui/**\/*.tsx`.
   * @remarks See "The hot/cold split" in `docs/rendering.md`.
   */
  carInputs: CarInputsFrame | null = null;
  carStatus: CarStatusFrame | null = null;
  chassis: ChassisFrame | null = null;
  pitService: PitServiceFrame | null = null;
  lapTiming: LapTimingFrame | null = null;
  pitTargetDistM: number | null = null;
  pitTargetType: 'pitbox' | 'pitExit' | null = null;
  pitLaneProgressPct: number | null = null;

  // Every telemetry frame is replaced wholesale — nothing ever mutates one in
  // place — so `observable.ref` is all the reactivity these need. Deep
  // observability would rebuild a proxy for each frame, and for the per-car
  // arrays it would convert ~15 arrays of 64 entries on every tick, purely to
  // observe fields nobody writes.
  constructor() {
    makeAutoObservable(this, {
      carDynamics: observable.ref,
      carInputs: observable.ref,
      carStatus: observable.ref,
      chassis: observable.ref,
      pitService: observable.ref,
      lapTiming: observable.ref,
    });
  }

  get isOnTrack(): boolean {
    return this.carStatus?.is_on_track ?? true;
  }

  /**
   * The ABS light. It lives in the 60 Hz inputs frame but flips only when the
   * brakes lock, so it is read as a flag of its own: a component reading this
   * wakes when the light changes rather than on every tick.
   */
  get isAbsActive(): boolean {
    return this.carInputs?.brake_abs_active ?? false;
  }

  /**
   * The gear, off the 60 Hz dynamics frame but changing only on a shift. Read as
   * a number of its own, it wakes a widget when the driver shifts rather than on
   * every tick.
   */
  get currentGear(): number {
    return this.carDynamics?.gear ?? 0;
  }

  /**
   * Whether the sim has told us where the car is along the pit lane. The
   * progress itself moves while the car rolls; only its presence decides
   * whether there is a lane to draw at all.
   */
  get hasPitLaneProgress(): boolean {
    return this.pitLaneProgressPct !== null;
  }

  updateCarDynamics(frame: CarDynamicsFrame) {
    this.carDynamics = frame;
  }

  updateCarInputs(frame: CarInputsFrame) {
    this.carInputs = frame;
  }

  updateCarStatus(frame: CarStatusFrame) {
    this.carStatus = frame;
  }

  updateChassis(frame: ChassisFrame) {
    this.chassis = frame;
  }

  updatePitService(frame: PitServiceFrame) {
    this.pitService = frame;
  }

  updateLapTiming(frame: LapTimingFrame) {
    this.lapTiming = frame;
  }

  updatePitTarget(frame: PitTargetFrame | null) {
    this.pitTargetDistM = frame?.distM ?? null;
    this.pitTargetType = frame?.target ?? null;
    this.pitLaneProgressPct = frame?.laneProgressPct ?? null;
  }

  reset() {
    this.carDynamics = null;
    this.carInputs = null;
    this.carStatus = null;
    this.chassis = null;
    this.pitService = null;
    this.lapTiming = null;
    this.pitTargetDistM = null;
    this.pitTargetType = null;
    this.pitLaneProgressPct = null;
  }
}
