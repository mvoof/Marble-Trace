import { makeAutoObservable, observable } from 'mobx';

import type {
  SessionFrame,
  SessionSnapshot,
  SessionType,
} from '@/types/bindings';

export class SessionStore {
  session: SessionFrame | null = null;
  sessionInfo: SessionSnapshot | null = null;

  // Every telemetry frame is replaced wholesale — nothing ever mutates one in
  // place — so `observable.ref` is all the reactivity these need. Deep
  // observability would rebuild a proxy for each frame, and for the per-car
  // arrays it would convert ~15 arrays of 64 entries on every tick, purely to
  // observe fields nobody writes.
  constructor() {
    makeAutoObservable(this, {
      session: observable.ref,
      sessionInfo: observable.ref,
    });
  }

  get currentSessionType(): SessionType | null {
    if (!this.sessionInfo) return null;
    const num = this.sessionInfo.currentSessionNum;
    if (num === null || num === undefined || num < 0) return null;
    return this.sessionInfo.sessions[num]?.sessionType ?? null;
  }

  private get currentSessionLabel(): string | null {
    const info = this.sessionInfo;

    if (!info) {
      return null;
    }

    return info.sessions[info.currentSessionNum]?.sessionTypeLabel ?? null;
  }

  get isQualifyingSession(): boolean {
    return this.currentSessionLabel?.toLowerCase().includes('qualify') ?? false;
  }

  /** Solo qualifying — the player is the only car allowed on track. */
  get isLoneQualifying(): boolean {
    return this.currentSessionLabel === 'Lone Qualify';
  }

  /**
   * Cars that actually take a position in the results. The session car list also
   * carries the pace car and spectators, so counting it raw reports one place
   * too many — the per-class counts come from `driverEntries`, which drops them.
   */
  get competingCarCount(): number {
    return (this.sessionInfo?.cars ?? []).filter(
      (car) => !car.isPaceCar && !car.isSpectator
    ).length;
  }

  /**
   * Car class id -> rank in the field, fastest class first. Drives the per-class
   * marker shapes on the maps so both widgets agree on who gets which shape.
   */
  get carClassOrder(): Map<number, number> {
    const fastestLapByClass = new Map<number, number>();

    for (const car of this.sessionInfo?.cars ?? []) {
      if (car.isPaceCar) {
        continue;
      }

      const estLapTime =
        car.carClassEstLapTime > 0 ? car.carClassEstLapTime : Infinity;
      const known = fastestLapByClass.get(car.carClassId);

      if (known === undefined || estLapTime < known) {
        fastestLapByClass.set(car.carClassId, estLapTime);
      }
    }

    const ranked = [...fastestLapByClass.entries()].sort(
      ([leftId, leftLap], [rightId, rightLap]) =>
        leftLap - rightLap || leftId - rightId
    );

    return new Map(ranked.map(([classId], index) => [classId, index]));
  }

  updateSession(frame: SessionFrame) {
    this.session = frame;
  }

  updateSessionInfo(info: SessionSnapshot) {
    this.sessionInfo = info;
  }

  reset() {
    this.session = null;
    this.sessionInfo = null;
  }
}
