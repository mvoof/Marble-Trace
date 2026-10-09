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
import { roundCornersUp } from './incident-hud-utils';
import type { IncidentHudWidgetSettings } from './settings-schema';

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

  get srStart(): number | null {
    return this.frame?.srStart ?? null;
  }

  /**
   * The rating shown: at the flag or at the car, as the instance is set. An
   * unrated session shows where it started, since it changes nothing.
   */
  get srShown(): number | null {
    const frame = this.frame;

    if (!frame || !this.isRated) {
      return this.srStart;
    }

    if (this.settings.projectionMode === 'finish') {
      return frame.srFinish ?? frame.srNow;
    }

    return frame.srNow;
  }

  /** The estimated change this session; `null` when unrated or unknown. */
  get srDelta(): number | null {
    const shown = this.srShown;
    const start = this.srStart;

    if (!this.isRated || shown === null || start === null) {
      return null;
    }

    return shown - start;
  }

  get cleanCornersNeeded(): number | null {
    const needed = this.frame?.cleanCornersNeeded ?? null;

    return needed === null ? null : roundCornersUp(needed);
  }

  dispose() {}
}
