import { makeAutoObservable, observableRef } from 'mobx';

import type {
  SessionEntry,
  SessionFrame,
  SessionSnapshot,
  SessionType,
} from '@shared/contracts/generated/bindings';
import { computeClassSof } from '@shared/lib/driver';
import { isSessionEnded } from '@shared/lib/timer-utils';

export class SessionStore {
  session: SessionFrame | null = null;
  sessionInfo: SessionSnapshot | null = null;

  // Every telemetry frame is replaced wholesale — nothing ever mutates one in
  // place — so `observableRef` is all the reactivity these need. Deep
  // observability would rebuild a proxy for each frame, and for the per-car
  // arrays it would convert ~15 arrays of 64 entries on every tick, purely to
  // observe fields nobody writes.
  constructor() {
    makeAutoObservable(this, {
      session: observableRef,
      sessionInfo: observableRef,
    });
  }

  /** The SOF Standings shows for the player's class; `null` before a session. */
  get playerClassSof(): number | null {
    const info = this.sessionInfo;
    const player = info?.cars.find((car) => car.carIdx === info.playerCarIdx);

    if (!info || !player) {
      return null;
    }

    const sof = computeClassSof(
      info.cars.filter(
        (car) =>
          car.carClassId === player.carClassId &&
          !car.isPaceCar &&
          !car.isSpectator
      )
    );

    return sof > 0 ? sof : null;
  }

  /** The session being run now, or `null` while the sim names none. */
  get currentSession(): SessionEntry | null {
    const info = this.sessionInfo;

    if (!info || info.currentSessionNum < 0) {
      return null;
    }

    return info.sessions[info.currentSessionNum] ?? null;
  }

  /**
   * Whether the session is in its cool-down. A computed boolean rather than
   * `session.session_state` read in place: the session frame is replaced every
   * second, and a table row that reads the frame redraws with it — every row,
   * every second — for a value that changes once a session.
   */
  get isSessionEnded(): boolean {
    return isSessionEnded(this.session?.session_state ?? null);
  }

  get currentSessionType(): SessionType | null {
    return this.currentSession?.sessionType ?? null;
  }

  /**
   * The track as the stored track settings key it, or `''` while no session
   * names one (the sim sends `-1`).
   */
  get trackKey(): string {
    const info = this.sessionInfo;

    if (!info || info.trackId < 0) {
      return '';
    }

    return String(info.trackId);
  }

  private get currentSessionLabel(): string | null {
    const info = this.sessionInfo;

    if (!info) {
      return null;
    }

    return this.currentSession?.sessionTypeLabel ?? null;
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
  /** The pace cars' indices — they are in the roster, never in the field. */
  get paceCarIdxs(): ReadonlySet<number> {
    return new Set(
      (this.sessionInfo?.cars ?? [])
        .filter((car) => car.isPaceCar)
        .map((car) => car.carIdx)
    );
  }

  /** Car index -> the number painted on the car, as the roster gives it. */
  get carNumberByIdx(): ReadonlyMap<number, string> {
    return new Map(
      (this.sessionInfo?.cars ?? []).map((car) => [car.carIdx, car.carNumber])
    );
  }

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
