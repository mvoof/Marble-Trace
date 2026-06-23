import { makeAutoObservable } from 'mobx';

import type {
  CarDynamicsFrame,
  CarInputsFrame,
  CarStatusFrame,
  ChassisFrame,
  LapTimingFrame,
} from '@/types/bindings';

export class PlayerStore {
  carDynamics: CarDynamicsFrame | null = null;
  carInputs: CarInputsFrame | null = null;
  carStatus: CarStatusFrame | null = null;
  chassis: ChassisFrame | null = null;
  lapTiming: LapTimingFrame | null = null;

  constructor() {
    makeAutoObservable(this);
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

  updateLapTiming(frame: LapTimingFrame) {
    this.lapTiming = frame;
  }

  reset() {
    this.carDynamics = null;
    this.carInputs = null;
    this.carStatus = null;
    this.chassis = null;
    this.lapTiming = null;
  }
}
