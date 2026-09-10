import { makeAutoObservable } from 'mobx';

import type { IncidentPoint } from '@/types/bindings';
import { computeIncidentZones, type FlagZone } from '@utils/flag-zones';
import type { RootStore } from '@store/root-store';

type IncidentsDeps = Pick<RootStore, 'backendComputed' | 'session'>;

/**
 * Where the trouble is, as both maps draw it.
 *
 * The zones need two data stores — the located incidents from the backend and
 * the track length from the session snapshot — so the geometry lives here
 * rather than as a getter on either of them, and both maps read the same
 * computed instead of each building it.
 */
export class IncidentsWidgetStore {
  constructor(private readonly root: IncidentsDeps) {
    makeAutoObservable(this);
  }

  get incidents(): IncidentPoint[] {
    return this.root.backendComputed.incidents?.incidents ?? [];
  }

  get zones(): FlagZone[] {
    return computeIncidentZones(
      this.incidents,
      this.root.session.sessionInfo?.trackLengthM ?? 0
    );
  }
}
