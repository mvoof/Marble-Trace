import { makeAutoObservable } from 'mobx';

import {
  getIncidentPenaltyStatus,
  isNearIncidentLimit,
  isNearIncidentPenalty,
  type IncidentPenaltyStatus,
} from '@shared/lib/driver';
import type { SafetyRatingFrame } from '@shared/contracts/bindings';
import type { WidgetInstanceContext } from '@entities/widget/widget-instances.store';
import type { LiveWidgetsView } from '@entities/layout/live-widgets.store';
import type { PlayerStore } from '@entities/player/player.store';
import type { SessionStore } from '@entities/session/session.store';
import { formatSr, formatSrDelta, roundCornersUp } from './incident-hud-utils';
import type { IncidentHudWidgetSettings } from './settings-schema';

/** `LicSubLevel` is the rating × 100. */
const SUB_LEVEL_SCALE = 100;

interface IncidentHudDeps {
  liveWidgets: LiveWidgetsView;
  player: PlayerStore;
  session: SessionStore;
}

/**
 * One Incident HUD: which estimate it shows, and where the driver stands
 * against the session's penalties. Built per instance (`mount.ts`), so two
 * copies follow their own projection mode.
 */
export class IncidentHudWidgetStore {
  private readonly root: IncidentHudDeps;

  private readonly instanceId: string;

  constructor({ core, instanceId }: WidgetInstanceContext<IncidentHudDeps>) {
    this.root = core;
    this.instanceId = instanceId;

    makeAutoObservable<IncidentHudWidgetStore, 'root' | 'instanceId'>(this, {
      root: false,
      instanceId: false,
    });
  }

  get settings(): IncidentHudWidgetSettings {
    return this.root.liveWidgets.getSettings<IncidentHudWidgetSettings>(
      this.instanceId
    );
  }

  private get frame(): SafetyRatingFrame | null {
    return this.root.player.safetyRating;
  }

  /** The driver's own points — what the rating is scored on. */
  get driverIncidents(): number {
    return this.frame?.driverIncidents ?? 0;
  }

  /**
   * The points the limit and the penalties count: the crew's in a team race,
   * the driver's otherwise.
   */
  get countedIncidents(): number {
    return this.frame?.teamIncidents ?? this.driverIncidents;
  }

  get incidentLimit(): number | null {
    return this.root.session.sessionInfo?.incidentLimit ?? null;
  }

  /** Whether the session hands out penalties at all; the column hides otherwise. */
  get hasPenalties(): boolean {
    return this.penaltyStatus !== null;
  }

  get penaltyStatus(): IncidentPenaltyStatus | null {
    const sessionInfo = this.root.session.sessionInfo;

    return getIncidentPenaltyStatus(this.countedIncidents, {
      initial: sessionInfo?.incidentPenaltyInitial ?? null,
      subsequent: sessionInfo?.incidentPenaltySubsequent ?? null,
      limit: this.incidentLimit,
    });
  }

  /** Incidents left before the next penalty; `null` when none is coming. */
  get incidentsToNextPenalty(): number | null {
    const nextAt = this.penaltyStatus?.nextAt ?? null;

    return nextAt === null ? null : nextAt - this.countedIncidents;
  }

  get isDisqualified(): boolean {
    return (
      this.incidentLimit !== null && this.countedIncidents >= this.incidentLimit
    );
  }

  get isNearLimit(): boolean {
    return isNearIncidentLimit(this.countedIncidents, this.incidentLimit);
  }

  get isNearPenalty(): boolean {
    return isNearIncidentPenalty(this.countedIncidents, this.penaltyStatus);
  }

  /** Whether this session moves the rating at all, as far as can be told. */
  get isRated(): boolean {
    const frame = this.frame;

    return (
      frame !== null && frame.sessionWeight > 0 && frame.isRanked !== false
    );
  }

  /**
   * The player's rating as iRacing states it (`LicSubLevel`). iRacing rewrites
   * it only once an event is over, so through practice, qualifying and the
   * race it is the rating the whole event started from — the big number,
   * which holds still while the chip moves.
   */
  get srOfficial(): number | null {
    const sessionInfo = this.root.session.sessionInfo;
    const player = sessionInfo?.cars.find(
      (car) => car.carIdx === sessionInfo.playerCarIdx
    );
    const subLevel = player?.licSubLevel ?? null;

    // Before the roster carries the licence, the backend's own start value.
    if (subLevel === null) {
      return this.frame?.srStart ?? null;
    }

    return subLevel / SUB_LEVEL_SCALE;
  }

  /**
   * Where the rating stands after everything driven in the event so far: the
   * backend carries each session's outcome into the next, so in the race this
   * already holds the qualifying. An unrated session changes nothing.
   */
  get srProjected(): number | null {
    if (!this.isRated) {
      return this.srOfficial;
    }

    return this.frame?.srNow ?? null;
  }

  /**
   * The change over the whole event so far — qualifying and race together, the
   * figure the site shows once the event is over; `null` when unrated.
   */
  get srDelta(): number | null {
    const projected = this.srProjected;
    const official = this.srOfficial;

    if (!this.isRated || projected === null || official === null) {
      return null;
    }

    return projected - official;
  }

  /**
   * The chip beside the rating, for a rated session: the change so far, or —
   * as the instance is set — the rating that change leads to.
   */
  get chipText(): string {
    if (this.settings.srChipMode === 'projected') {
      return formatSr(this.srProjected);
    }

    const delta = this.srDelta;

    return delta === null ? formatSr(null) : formatSrDelta(delta);
  }

  get cleanCornersNeeded(): number | null {
    const needed = this.frame?.cleanCornersNeeded ?? null;

    return needed === null ? null : roundCornersUp(needed);
  }

  dispose() {}
}
