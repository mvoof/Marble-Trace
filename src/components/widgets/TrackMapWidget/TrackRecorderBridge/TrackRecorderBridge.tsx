import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';
import { autorun } from 'mobx';
import { listen } from '@tauri-apps/api/event';
import { telemetryStore } from '../../../../store/iracing';
import { TrackRecorder } from '../../../../utils/track-recorder';
import type { TrackPoint } from '../../../../types/track';
import type { RecordingOverlayHandle } from '../RecordingOverlay/RecordingOverlay';

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
  recordingOverlayRef?: RefObject<RecordingOverlayHandle | null>;
}

/**
 * Headless component that ticks the TrackRecorder on every carDynamics update (60Hz).
 * Uses MobX autorun for synchronous execution on every observable change.
 * React state setters are deferred via queueMicrotask to avoid calling them
 * inside MobX's reaction flush (which can trigger React warnings).
 */
export const TrackRecorderBridge = ({
  trackId,
  onTrackReady,
  onIsRecordingChange,
  onProgressChange,
  onSaveTrack,
  recordingOverlayRef,
}: TrackRecorderBridgeProps) => {
  const recorderRef = useRef(new TrackRecorder());
  const hasSavedRef = useRef(false);
  const lastProgressRef = useRef(-1);

  const callbacksRef = useRef({
    onTrackReady,
    onIsRecordingChange,
    onProgressChange,
    onSaveTrack,
    recordingOverlayRef,
  });
  callbacksRef.current = {
    onTrackReady,
    onIsRecordingChange,
    onProgressChange,
    onSaveTrack,
    recordingOverlayRef,
  };

  const reset = () => {
    recorderRef.current.reset();
    hasSavedRef.current = false;
    lastProgressRef.current = -1;
    callbacksRef.current.onIsRecordingChange(false);
    callbacksRef.current.onProgressChange(0);
    const overlay = callbacksRef.current.recordingOverlayRef?.current;
    if (overlay) {
      overlay.setRecording(false);
      overlay.setProgress(0);
    }
  };

  useEffect(() => {
    if (!trackId) return;
    reset();
  }, [trackId]);

  useEffect(() => {
    const unlisten = listen('track-map:clear', () => {
      reset();
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    const dispose = autorun(() => {
      const { carDynamics, lapTiming } = telemetryStore;
      // ... (rest of the file)

      if (!carDynamics || !lapTiming) return;

      const speed = carDynamics.speed ?? 0;
      const yaw = carDynamics.yaw ?? 0;
      const lapDistPct = lapTiming.lap_dist_pct ?? -1;

      if (lapDistPct < 0) return;

      const recorder = recorderRef.current;
      const overlay = callbacksRef.current.recordingOverlayRef?.current;

      // Start recording when speed > 5 m/s (~18 km/h)
      // We only start if it's NOT recording AND NOT complete.
      // Once complete, we stay complete until trackId changes or component unmounts.
      if (!recorder.isRecording && !recorder.isComplete && speed > 5) {
        hasSavedRef.current = false;
        recorder.start();
        queueMicrotask(() => callbacksRef.current.onIsRecordingChange(true));
        overlay?.setRecording(true);
      }

      if (recorder.isRecording) {
        recorder.tick(speed, yaw, lapDistPct);

        const progress = recorder.progress;

        // Smooth DOM update every 60Hz tick
        if (overlay) {
          overlay.setProgress(progress);
        }

        // Throttled React state update (every 1%)
        if (Math.abs(progress - lastProgressRef.current) >= 0.01) {
          lastProgressRef.current = progress;
          queueMicrotask(() => callbacksRef.current.onProgressChange(progress));
        }

        if (recorder.isComplete && !hasSavedRef.current) {
          hasSavedRef.current = true;
          const { svgPath, viewBox } = recorder.buildSvgPath();
          const points = recorder.getPoints();

          // Call directly without queueMicrotask to ensure immediate React unmount
          callbacksRef.current.onIsRecordingChange(false);
          callbacksRef.current.onTrackReady({ svgPath, viewBox, points });
          void callbacksRef.current.onSaveTrack(svgPath, viewBox, points);

          if (overlay) {
            overlay.setRecording(false);
            overlay.setProgress(1);
          }
        }
      }
    });

    return dispose;
  }, []);

  return null;
};
