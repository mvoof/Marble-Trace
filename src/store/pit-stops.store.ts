/**
 * Player pit stop counter — frontend-side derived state.
 *
 * iRacing telemetry does not expose a per-driver pit-stop count, so we
 * track the *player's* stops on the frontend by watching transitions of
 * `car_idx_on_pit_road[playerCarIdx]` from `false` to `true`. The counter
 * resets whenever the session changes (detected via `WeekendInfo.SessionID`
 * combined with `SubSessionID`).
 */
import { makeAutoObservable, reaction } from 'mobx';

import { telemetryStore } from './iracing/telemetry.store';

class PitStopsStore {
  playerStops = 0;

  private lastOnPitRoad = false;
  private lastSessionKey: string | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });

    // Reset whenever the session identity changes.
    reaction(
      () => {
        const wi = telemetryStore.weekendInfo;
        if (!wi) return null;
        return `${wi.SessionID ?? ''}:${wi.SubSessionID ?? ''}`;
      },
      (key) => {
        if (key && key !== this.lastSessionKey) {
          this.lastSessionKey = key;
          this.playerStops = 0;
          this.lastOnPitRoad = false;
        }
      }
    );

    // Count false→true transitions of the player's pit road flag.
    reaction(
      () => {
        const driverCarIdx = telemetryStore.driverInfo?.DriverCarIdx ?? -1;
        const frame = telemetryStore.carIdx;
        if (!frame || driverCarIdx < 0) return false;
        return frame.car_idx_on_pit_road?.[driverCarIdx] ?? false;
      },
      (onPitRoad) => {
        if (onPitRoad && !this.lastOnPitRoad) {
          this.playerStops += 1;
        }
        this.lastOnPitRoad = onPitRoad;
      }
    );
  }

  reset() {
    this.playerStops = 0;
    this.lastOnPitRoad = false;
    this.lastSessionKey = null;
  }
}

export const pitStopsStore = new PitStopsStore();
