import { makeAutoObservable, runInAction } from 'mobx';

import type { TrackShapePayload } from '@/types/bindings';
import {
  deleteTrackShape,
  resetPitLanePct,
} from '@platform/services/track.service';
import { readTrackRotations } from '@platform/services/track-settings.service';
import {
  emitTrackMapClear,
  emitTrackRotationRequest,
  type TrackRotateDirection,
} from '@platform/services/events.service';

export type { TrackRotateDirection };

const ROTATION_STEP_DEGREES = 90;
const FULL_TURN_DEGREES = 360;

/** The angle one press of a rotate button turns the map to. */
export const nextTrackRotation = (
  rotation: number,
  direction: TrackRotateDirection
): number => {
  const step =
    direction === 'cw' ? ROTATION_STEP_DEGREES : -ROTATION_STEP_DEGREES;

  return (rotation + step + FULL_TURN_DEGREES) % FULL_TURN_DEGREES;
};

/**
 * The recorded track: its shape, the recording in progress and the angle the
 * map is turned to. App-wide rather than per map instance — the shape arrives
 * from the backend once per track, the pit service measures its lane against
 * it, and the angle is the same on every screen.
 *
 * The angle is a mirror of main's: main owns the file it is stored in
 * (`TrackRotationStore`), applies every turn and broadcasts the result. A
 * rotate button here only shows the new angle until main's answer lands.
 */
export class TrackMapWidgetStore {
  isRecording = false;
  isWaitingForSF = false;
  recordingProgress = 0;
  isPitLaneRecording = false;
  trackShape: TrackShapePayload | null = null;
  currentTrackId: string | null = null;
  trackRotation = 0;

  /**
   * Angles received from main, by track id.
   *
   * A remote screen has no settings file to read them from, and the messages
   * that carry the shape, the session and the rotation arrive in no fixed
   * order — keeping them keyed by track means a rotation that lands before its
   * track does is still applied when the track shows up.
   */
  private readonly receivedRotations = new Map<string, number>();

  /**
   * False in the layout editor's preview store, which owns no track of its own:
   * its rotate buttons turn the sample map and never reach main.
   */
  private readonly persists: boolean;

  constructor({ persists = true }: { persists?: boolean } = {}) {
    this.persists = persists;

    makeAutoObservable(this, {}, { autoBind: true });
  }

  updateRecordingStatus(
    isRecording: boolean,
    isWaitingForSF: boolean,
    progress: number,
    isPitLaneRecording: boolean
  ) {
    this.isRecording = isRecording;
    this.isWaitingForSF = isWaitingForSF;
    this.recordingProgress = progress;
    this.isPitLaneRecording = isPitLaneRecording;
  }

  onTrackShapeReceived(payload: TrackShapePayload) {
    this.trackShape = payload;
    this.currentTrackId = String(payload.trackId);
    this.isRecording = false;
    this.isWaitingForSF = false;
    this.isPitLaneRecording = false;
    this.recordingProgress = 1;
  }

  setTrackRotation(rotation: number) {
    this.trackRotation = rotation;
  }

  /**
   * Applies the angle main stored for a track.
   *
   * The value is remembered per track as well as applied, because it can reach
   * a window before the track it belongs to has loaded there.
   */
  applyTrackRotation(trackId: string, rotation: number) {
    this.receivedRotations.set(trackId, rotation);
    this.trackRotation = rotation;
  }

  /**
   * Clears stale shape on a track change and restores the saved rotation. The
   * file is only read: an angle main broadcast before this window was listening
   * is on disk already.
   */
  async onTrackChanged(trackId: string) {
    if (this.currentTrackId !== trackId) {
      this.clearTrackShape();
    }

    const received = this.receivedRotations.get(trackId);

    if (received != null) {
      runInAction(() => this.setTrackRotation(received));

      return;
    }

    try {
      const savedRotation = (await readTrackRotations())[trackId];

      if (savedRotation != null) {
        runInAction(() => this.setTrackRotation(savedRotation));
      }
    } catch {
      // ignore
    }
  }

  /**
   * Turns the map here at once and asks main for the same step. Main's answer
   * replaces this angle, so a turn made on another screen meanwhile is not lost.
   */
  rotateTrack(trackId: string, direction: TrackRotateDirection) {
    if (!this.trackShape) return;

    this.setTrackRotation(nextTrackRotation(this.trackRotation, direction));

    if (!this.persists) {
      return;
    }

    void emitTrackRotationRequest({ trackId, direction }).catch(
      (error: unknown) =>
        console.error('[track-map] failed to reach main:', error)
    );
  }

  async resetPitLaneCalibration(trackId: number) {
    await resetPitLanePct(trackId);
  }

  /**
   * Wipes the recorded shape. The clear event fans out so every window (and the
   * backend recorder) drops its copy; the disk-side deletion runs once, here.
   * The angle is main's to forget (`TrackRotationStore.forget`).
   */
  async deleteTrackData(trackId: string) {
    this.clearTrackShape();

    await Promise.allSettled([
      emitTrackMapClear(),
      deleteTrackShape(Number(trackId)),
    ]);
  }

  clearTrackShape() {
    this.trackShape = null;
    this.currentTrackId = null;
    this.isRecording = false;
    this.isWaitingForSF = false;
    this.isPitLaneRecording = false;
    this.recordingProgress = 0;
    this.trackRotation = 0;
  }

  reset() {
    this.isRecording = false;
    this.isWaitingForSF = false;
    this.isPitLaneRecording = false;
    this.recordingProgress = 0;
    this.trackShape = null;
    this.currentTrackId = null;
    this.trackRotation = 0;
  }
}
