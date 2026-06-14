import { makeAutoObservable } from 'mobx';

import type { TrackShapePayload } from '@/types/bindings';

export class TrackMapWidgetStore {
  isRecording = false;
  isWaitingForSF = false;
  recordingProgress = 0;
  trackShape: TrackShapePayload | null = null;

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
    this.isRecording = false;
    this.isWaitingForSF = false;
    this.recordingProgress = 1;
  }

  clearTrackShape() {
    this.trackShape = null;
    this.isRecording = false;
    this.isWaitingForSF = false;
    this.recordingProgress = 0;
  }

  reset() {
    this.isRecording = false;
    this.isWaitingForSF = false;
    this.recordingProgress = 0;
    this.trackShape = null;
  }
}
