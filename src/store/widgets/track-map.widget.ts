import { makeAutoObservable } from 'mobx';

import type { TrackShapePayload } from '@/types/bindings';

export class TrackMapWidgetStore {
  isRecording = false;
  isWaitingForSF = false;
  recordingProgress = 0;
  trackShape: TrackShapePayload | null = null;
  currentTrackId: string | null = null;
  trackRotation = 0;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  updateRecordingStatus(
    isRecording: boolean,
    isWaitingForSF: boolean,
    progress: number
  ) {
    this.isRecording = isRecording;
    this.isWaitingForSF = isWaitingForSF;
    this.recordingProgress = progress;
  }

  onTrackShapeReceived(payload: TrackShapePayload) {
    this.trackShape = payload;
    this.currentTrackId = String(payload.trackId);
    this.isRecording = false;
    this.isWaitingForSF = false;
    this.recordingProgress = 1;
  }

  setTrackRotation(rotation: number) {
    this.trackRotation = rotation;
  }

  clearTrackShape() {
    this.trackShape = null;
    this.currentTrackId = null;
    this.isRecording = false;
    this.isWaitingForSF = false;
    this.recordingProgress = 0;
    this.trackRotation = 0;
  }

  reset() {
    this.isRecording = false;
    this.isWaitingForSF = false;
    this.recordingProgress = 0;
    this.trackShape = null;
    this.currentTrackId = null;
    this.trackRotation = 0;
  }
}
