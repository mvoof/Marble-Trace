import { makeAutoObservable, runInAction } from 'mobx';

import type { TrackShapePayload } from '@/types/bindings';
import { deleteTrackShape, resetPitLanePct } from '@/services/track.service';
import type {
  StoredTracks,
  TrackRotateDirection,
} from '@widgets/TrackMapWidget/types';
import { TRACKS_STORE_KEY } from '@widgets/TrackMapWidget/types';
import { TRACK_SETTINGS_STORE } from '@widgets/TrackMapWidget/track-store';

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

  constructor() {
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

  /** Clears stale shape on a track change and restores the saved rotation. */
  async onTrackChanged(trackId: string) {
    if (this.currentTrackId !== trackId) {
      this.clearTrackShape();
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

    this.setTrackRotation(newRotation);

    void this.persistRotation(trackId, newRotation);
  }

  async resetPitLaneCalibration(trackId: number) {
    await resetPitLanePct(trackId);
  }

  /** Wipes the recorded shape and everything stored about the track. */
  async deleteTrackData(trackId: string) {
    this.clearTrackShape();

    await Promise.allSettled([
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
