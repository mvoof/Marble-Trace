import { makeAutoObservable, observable } from 'mobx';

import type {
  CarDynamicsFrame,
  CarInputsFrame,
  CarStatusFrame,
  ChassisFrame,
  LapTimingFrame,
  PitServiceFrame,
} from '@/types/bindings';

export class PlayerStore {
  carDynamics: CarDynamicsFrame | null = null;
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

  updatePitTarget(
    dist: number | null,
    type: 'pitbox' | 'pitExit' | null,
    progress: number | null
  ) {
    this.pitTargetDistM = dist;
    this.pitTargetType = type;
    this.pitLaneProgressPct = progress;
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
