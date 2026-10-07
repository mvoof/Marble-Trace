import { makeAutoObservable } from 'mobx';

import type { IncidentPoint } from '@shared/contracts/bindings';
import {
  computeIncidentZones,
  type FlagZone,
} from '@store/widgets/incidents/flag-zones';
import type { BackendComputedStore } from '@store/data/computed.store';
import type { SessionStore } from '@store/data/session.store';

interface IncidentsDeps {
  backendComputed: BackendComputedStore;
  session: SessionStore;
}

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

  /**
   * Solo qualifying puts nobody else on track, so an incident zone there marks
   * trouble no one can drive into — both maps drop the layer entirely.
   */
  get zones(): FlagZone[] {
    if (this.root.session.isLoneQualifying) {
      return [];
    }

    return computeIncidentZones(
      this.incidents,
      this.root.session.sessionInfo?.trackLengthM ?? 0
    );
  }
}
