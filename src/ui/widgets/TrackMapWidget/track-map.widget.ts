import { makeAutoObservable, runInAction } from 'mobx';

import type { TrackShapePayload } from '@/types/bindings';
import {
  deleteTrackShape,
  resetPitLanePct,
} from '@platform/services/track.service';
import {
  emitTrackMapClear,
  emitTrackRotation,
} from '@platform/services/events.service';
import type {
  StoredTracks,
  TrackRotateDirection,
} from '@ui/widgets/TrackMapWidget/types';
import { TRACKS_STORE_KEY } from '@ui/widgets/TrackMapWidget/types';
import { TRACK_SETTINGS_STORE } from '@ui/widgets/TrackMapWidget/track-store';

const ROTATION_STEP_DEGREES = 90;
const FULL_TURN_DEGREES = 360;

export class TrackMapWidgetStore {
  isRecording = false;
  isWaitingForSF = false;
  recordingProgress = 0;
  isPitLaneRecording = false;
  trackShape: TrackShapePayload | null = null;
  currentTrackId: string | null = null;
  trackRotation = 0;

  /**
   * Angles received from another window, by track id.
   *
   * A remote screen has no settings file to read them from, and the messages
   * that carry the shape, the session and the rotation arrive in no fixed
   * order — keeping them keyed by track means a rotation that lands before its
   * track does is still applied when the track shows up.
   */
  private readonly receivedRotations = new Map<string, number>();

  /** False in the layout editor's preview store, which owns no track of its own. */
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
   * Applies an angle another window turned the map to.
   *
   * The value is remembered per track as well as applied, because it can reach
   * a window before the track it belongs to has loaded there.
   */
  applyTrackRotation(trackId: string, rotation: number) {
    this.receivedRotations.set(trackId, rotation);
    this.trackRotation = rotation;
  }

  /** Clears stale shape on a track change and restores the saved rotation. */
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
      const tracks = await this.readStoredTracks();
      const savedRotation = tracks[trackId]?.rotation;

      if (savedRotation != null) {
        runInAction(() => this.setTrackRotation(savedRotation));
      }
    } catch {
      // ignore
    }
  }

  rotateTrack(trackId: string, direction: TrackRotateDirection) {
    if (!this.trackShape) return;

    const step =
      direction === 'cw' ? ROTATION_STEP_DEGREES : -ROTATION_STEP_DEGREES;
    const newRotation =
      (this.trackRotation + step + FULL_TURN_DEGREES) % FULL_TURN_DEGREES;

    this.rotateTo(trackId, newRotation);
  }

  /**
   * The single way a rotation is applied by the user: it stores the angle,
   * writes it to disk and tells the other windows and the remote screens, so
   * the map on a tablet ends up turned the same way as the one on the monitor.
   */
  rotateTo(trackId: string, rotation: number) {
    this.setTrackRotation(rotation);

    if (!this.persists) {
      return;
    }

    void this.persistRotation(trackId, rotation);
    void emitTrackRotation({ trackId, rotation });
  }

  async resetPitLaneCalibration(trackId: number) {
    await resetPitLanePct(trackId);
  }

  /**
   * Wipes the recorded shape and everything stored about the track. The clear
   * event fans out so every window (and the backend recorder) drops its copy;
   * the disk-side deletion runs once, here.
   */
  async deleteTrackData(trackId: string) {
    this.clearTrackShape();

    await Promise.allSettled([
      emitTrackMapClear(),
      deleteTrackShape(Number(trackId)),
      this.removeStoredTrack(trackId),
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

  // Imported lazily so windows that never touch the track map do not load the
  // store plugin.
  private async openTrackSettings() {
    const { load } = await import('@tauri-apps/plugin-store');

    return load(TRACK_SETTINGS_STORE);
  }

  private async readStoredTracks(): Promise<StoredTracks> {
    const store = await this.openTrackSettings();

    return (await store.get<StoredTracks>(TRACKS_STORE_KEY)) ?? {};
  }

  private async persistRotation(trackId: string, rotation: number) {
    // Editing a layout with no session running still turns the map on every
    // screen; there is simply no track to file the angle under.
    if (!trackId) {
      return;
    }

    try {
      const store = await this.openTrackSettings();
      const tracks = (await store.get<StoredTracks>(TRACKS_STORE_KEY)) ?? {};

      tracks[trackId] = { rotation };

      await store.set(TRACKS_STORE_KEY, tracks);
      await store.save();
    } catch {
      // ignore
    }
  }

  private async removeStoredTrack(trackId: string) {
    const store = await this.openTrackSettings();
    const tracks = (await store.get<StoredTracks>(TRACKS_STORE_KEY)) ?? {};

    delete tracks[trackId];

    await store.set(TRACKS_STORE_KEY, tracks);
    await store.save();
  }
}
