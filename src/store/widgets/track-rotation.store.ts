import { makeAutoObservable, observable, runInAction } from 'mobx';

import {
  readTrackRotations,
  writeTrackRotations,
  type TrackRotations,
} from '@platform/services/track-settings.service';
import type {
  TrackRotateDirection,
  TrackRotationPayload,
} from '@platform/services/events.service';
import { nextTrackRotation } from './track-map.widget';

/**
 * The angle every track's map is turned to, owned by main alone.
 *
 * Main loads `track-settings.json` once, applies every turn — an overlay's
 * rotate button arrives as a step, the layout editor sets an angle — and writes
 * the file back. Each overlay used to read, change and save it on its own, and
 * two screens turned in quick succession lost one of the turns to the last save.
 *
 * Every command runs on one queue, behind the initial read: a turn that arrives
 * before the file is loaded is applied on top of the stored angle, and a save
 * never overtakes the one before it.
 */
export class TrackRotationStore {
  isLoaded = false;

  /** The last angle applied, for main to broadcast. */
  lastChange: TrackRotationPayload | null = null;

  private readonly rotations = observable.map<string, number>();
  private queue: Promise<void> = Promise.resolve();
  private fileRead = false;

  constructor() {
    makeAutoObservable<this, 'queue' | 'fileRead'>(
      this,
      { queue: false, fileRead: false },
      { autoBind: true }
    );
  }

  rotationOf(trackId: string): number {
    return this.rotations.get(trackId) ?? 0;
  }

  load(): Promise<void> {
    return this.enqueue(async () => {
      let stored: TrackRotations = {};

      try {
        stored = await readTrackRotations();
        this.fileRead = true;
      } catch (error) {
        console.error('[track-rotation] failed to read the file:', error);
      }

      runInAction(() => {
        for (const [trackId, rotation] of Object.entries(stored)) {
          this.rotations.set(trackId, rotation);
        }

        this.isLoaded = true;
      });
    });
  }

  step(trackId: string, direction: TrackRotateDirection): Promise<void> {
    return this.enqueue(() =>
      this.apply(
        trackId,
        nextTrackRotation(this.rotationOf(trackId), direction)
      )
    );
  }

  setRotation(trackId: string, rotation: number): Promise<void> {
    return this.enqueue(() => this.apply(trackId, rotation));
  }

  /** Drops the track's angle along with its recorded shape. */
  forget(trackId: string): Promise<void> {
    return this.enqueue(async () => {
      runInAction(() => {
        this.rotations.delete(trackId);
        this.lastChange = { trackId, rotation: 0 };
      });

      await this.save();
    });
  }

  private async apply(trackId: string, rotation: number) {
    runInAction(() => {
      this.rotations.set(trackId, rotation);
      this.lastChange = { trackId, rotation };
    });

    // Editing a layout with no session running still turns the map on every
    // screen; there is simply no track to file the angle under.
    if (!trackId) {
      return;
    }

    await this.save();
  }

  private async save() {
    // A file that was never read holds angles this store does not: writing
    // the map now would erase them.
    if (!this.fileRead) {
      return;
    }

    const stored: TrackRotations = {};

    for (const [trackId, rotation] of this.rotations) {
      if (trackId) {
        stored[trackId] = rotation;
      }
    }

    try {
      await writeTrackRotations(stored);
    } catch (error) {
      console.error('[track-rotation] failed to write the file:', error);
    }
  }

  private enqueue(command: () => Promise<void>): Promise<void> {
    this.queue = this.queue.then(command);

    return this.queue;
  }
}
