import { makeAutoObservable } from 'mobx';

import type { CarIdentity } from '@/types/car-identity';
import type { RendererCore } from '@store/roots/renderer-core';

type PlayerPositionDeps = Pick<
  RendererCore,
  'backendComputed' | 'session' | 'player'
>;

/**
 * The player's place in the field, for the readouts outside the standings
 * table — timer, race dash, invisible dash, pit service. Derived only, no
 * reactions, so it costs nothing while nobody reads it.
 *
 * Moved off the standings store when that became per instance: these numbers
 * belong to the session, not to any one table.
 */
export class PlayerPositionStore {
  constructor(private readonly root: PlayerPositionDeps) {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get playerEntry(): CarIdentity | null {
    return (
      this.root.backendComputed.driverIdentities.find(
        (entry) => entry.isPlayer
      ) ?? null
    );
  }

  /** Whether the standings frame carries the player at all, as a stable flag. */
  get hasPlayerEntry(): boolean {
    return this.playerEntry !== null;
  }

  /** The sim's own position, which only refreshes at the start/finish line. */
  get playerOfficialPosition(): number | null {
    return this.root.player.lapTiming?.player_car_position ?? null;
  }

  /**
   * The on-track order's position, falling back to the official one whenever the
   * standings frame has no entry for the player yet.
   */
  get playerLivePosition(): number | null {
    return this.playerEntry?.livePosition || this.playerOfficialPosition;
  }

  /** The field the overall position is counted against. */
  get overallFieldTotal(): number | null {
    const entries = this.root.backendComputed.driverIdentities;

    return this.root.session.competingCarCount || entries.length || null;
  }

  /** How many cars share the player's class. */
  get playerClassTotal(): number | null {
    const entry = this.playerEntry;

    if (!entry) {
      return null;
    }

    const entries = this.root.backendComputed.driverIdentities;

    return (
      entries.filter((other) => other.carClassId === entry.carClassId).length ||
      null
    );
  }

  get playerOfficialClassPosition(): number | null {
    return this.playerEntry?.classPosition || null;
  }

  get playerLiveClassPosition(): number | null {
    const entry = this.playerEntry;

    if (!entry) {
      return null;
    }

    return entry.liveClassPosition || entry.classPosition || null;
  }

  /**
   * Player's overall position. Live follows the on-track order, official is the
   * sim's own number, which only refreshes at the start/finish line. Falls back
   * to the official one whenever the standings frame has no entry for the player
   * yet. Callers pass their own widget's flag.
   */
  playerPosition(useLivePositions: boolean): number | null {
    if (!useLivePositions) {
      return this.playerOfficialPosition;
    }

    return this.playerLivePosition;
  }

  /** More than one car class is entered, so a class position is a different number. */
  get isMultiClass(): boolean {
    const entries = this.root.backendComputed.driverIdentities;

    if (entries.length === 0) {
      return false;
    }

    const classIds = new Set(entries.map((entry) => entry.carClassId));

    return classIds.size > 1;
  }

  /**
   * Player's position and the field it is counted against. `byClass` only takes
   * effect in a multiclass field — with a single class the class position is the
   * overall one anyway. Falls back to the overall numbers whenever the standings
   * frame has no entry for the player yet.
   *
   * Every branch reads a computed that resolves to a primitive, so a caller wakes
   * when its own number changes rather than on every standings frame.
   */
  playerPositionInfo(
    useLivePositions: boolean,
    byClass: boolean
  ): { position: number | null; total: number | null } {
    if (!byClass || !this.isMultiClass || !this.hasPlayerEntry) {
      return {
        position: this.playerPosition(useLivePositions),
        total: this.overallFieldTotal,
      };
    }

    return {
      position: useLivePositions
        ? this.playerLiveClassPosition
        : this.playerOfficialClassPosition,
      total: this.playerClassTotal,
    };
  }
}
