import { useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { telemetryStore } from '../../../../store/iracing';
import { TrackRecorder } from '../../../../utils/track-recorder';
import type { TrackPoint } from '../../../../types/track';

interface TrackData {
  svgPath: string;
  viewBox: string;
  points: TrackPoint[];
}

interface TrackRecorderBridgeProps {
  trackId: string;
  onTrackReady: (data: TrackData) => void;
  onIsRecordingChange: (recording: boolean) => void;
  onProgressChange: (progress: number) => void;
  onSaveTrack: (
    svgPath: string,
    viewBox: string,
    points: TrackPoint[]
  ) => void | Promise<void>;
}

/**
 * Headless observer that reads carDynamics (60Hz) in isolation.
 * Keeps the main TrackMapWidgetContainer free from 60Hz re-renders.
 */
export const TrackRecorderBridge = observer(
  ({
    trackId,
    onTrackReady,
    onIsRecordingChange,
    onProgressChange,
    onSaveTrack,
  }: TrackRecorderBridgeProps) => {
    const carDynamics = telemetryStore.carDynamics;
    const lapTiming = telemetryStore.lapTiming;
    const sessionFrame = telemetryStore.session;

    const recorderRef = useRef(new TrackRecorder());
    const hasSavedRef = useRef(false);
    const lastProgressIntRef = useRef(-1);

    useEffect(() => {
      recorderRef.current = new TrackRecorder();
      hasSavedRef.current = false;
      lastProgressIntRef.current = -1;
    }, [trackId]);

    useEffect(() => {
      if (!carDynamics || !lapTiming || !sessionFrame) return;

      const recorder = recorderRef.current;
      const speed = carDynamics.speed ?? 0;
      const yaw = carDynamics.yaw ?? 0;
      const lapDistPct = lapTiming.lap_dist_pct ?? -1;
      const sessionTime = sessionFrame.session_time ?? 0;

      if (lapDistPct < 0) return;

      if (!recorder.isRecording && !recorder.isComplete && speed > 5) {
        hasSavedRef.current = false;
        recorder.start();
        onIsRecordingChange(true);
      }

      if (recorder.isRecording) {
        recorder.tick(speed, yaw, lapDistPct, sessionTime);

        const progressInt = Math.floor(recorder.progress);
        if (progressInt !== lastProgressIntRef.current) {
          lastProgressIntRef.current = progressInt;
          onProgressChange(recorder.progress);
        }

        if (recorder.isComplete && !hasSavedRef.current) {
          hasSavedRef.current = true;
          const { svgPath, viewBox } = recorder.buildSvgPath();
          const points = recorder.getPoints();
          onIsRecordingChange(false);
          onTrackReady({ svgPath, viewBox, points });
          void onSaveTrack(svgPath, viewBox, points);
        }
      }
    }, [
      carDynamics,
      lapTiming,
      sessionFrame,
      onIsRecordingChange,
      onProgressChange,
      onTrackReady,
      onSaveTrack,
    ]);

    return null;
  }
);
