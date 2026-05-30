import type { RefObject } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { autorun, runInAction } from 'mobx';
import { listen } from '@tauri-apps/api/event';
import { TrackRecorder } from '@utils/telemetry/track-recorder';
import type { TrackPoint } from '@/types';
import type { RecordingOverlayHandle } from '@widgets/TrackMapWidget/RecordingOverlay/RecordingOverlay';
import {
  useTelemetryStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

interface TrackData {
  svgPath: string;
  viewBox: string;
  points: TrackPoint[];
}

interface TrackRecorderBridgeProps {
  trackId: string;
  onTrackReady: (data: TrackData) => void;
  onIsRecordingChange: (recording: boolean) => void;
  onWaitingForSFChange?: (waiting: boolean) => void;
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
  onWaitingForSFChange,
  onProgressChange,
  onSaveTrack,
  recordingOverlayRef,
}: TrackRecorderBridgeProps) => {
  const telemetry = useTelemetryStore();
  const widgetSettings = useWidgetSettingsStore();
  const recorderRef = useRef(new TrackRecorder());
  const hasSavedRef = useRef(false);
  const lastProgressRef = useRef(-1);
  const lastLapDistRef = useRef(-1);
  const lastIsWaitingForSFRef = useRef<boolean | null>(null);
  const lastIsRecordingRef = useRef<boolean | null>(null);

  const callbacksRef = useRef({
    onTrackReady,
    onIsRecordingChange,
    onWaitingForSFChange,
    onProgressChange,
    onSaveTrack,
    recordingOverlayRef,
  });

  callbacksRef.current = {
    onTrackReady,
    onIsRecordingChange,
    onWaitingForSFChange,
    onProgressChange,
    onSaveTrack,
    recordingOverlayRef,
  };

  const reset = useCallback(() => {
    recorderRef.current.reset();
    hasSavedRef.current = false;
    lastProgressRef.current = -1;
    lastLapDistRef.current = -1;
    lastIsWaitingForSFRef.current = null;
    lastIsRecordingRef.current = null;

    runInAction(() => widgetSettings.setTrackMapForceStartPending(false));

    callbacksRef.current.onIsRecordingChange(false);
    callbacksRef.current.onWaitingForSFChange?.(false);
    callbacksRef.current.onProgressChange(0);

    const overlay = callbacksRef.current.recordingOverlayRef?.current;

    if (overlay) {
      overlay.setRecording(false);
      overlay.setProgress(0);
    }
  }, [widgetSettings]);

  useEffect(() => {
    if (!trackId) return;

    reset();
  }, [trackId, reset]);

  useEffect(() => {
    const unlistenClear = listen('track-map:clear', () => {
      reset();
    });

    const unlistenForceStart = listen('track-map:force-start', () => {
      runInAction(() => widgetSettings.setTrackMapForceStartPending(true));
    });

    return () => {
      void unlistenClear.then((fn) => fn());
      void unlistenForceStart.then((fn) => fn());
    };
  }, [reset, widgetSettings]);

  useEffect(() => {
    const dispose = autorun(() => {
      const { carDynamics, lapTiming, carStatus, sessionInfo, carPositions } =
        telemetry;

      const { isTrackMapForceStartPending } = widgetSettings;

      if (!carDynamics || !lapTiming) {
        return;
      }

      const speed = carDynamics.speed ?? 0;
      const yaw = carDynamics.yaw ?? 0;
      const lapDistPct = lapTiming.lap_dist_pct ?? -1;

      if (lapDistPct < 0) {
        return;
      }

      const recorder = recorderRef.current;
      const overlay = callbacksRef.current.recordingOverlayRef?.current;

      const playerCarIdx = sessionInfo?.DriverInfo?.DriverCarIdx ?? -1;

      const playerSurface =
        playerCarIdx >= 0 && carPositions
          ? carPositions.car_idx_track_surface[playerCarIdx]
          : null;

      const onPitRoad =
        (carStatus?.on_pit_road ?? false) ||
        playerSurface === 1 || // InPitStall
        playerSurface === 2; // AproachingPits

      // Completion detection for S/F line crossing to start recording.
      // Jumps from > 0.8 to < 0.2 indicate crossing the Start/Finish line.
      // We must not start recording if the player is on the pit road.
      let crossedSF = false;

      if (
        !onPitRoad &&
        lastLapDistRef.current > 0.8 &&
        lapDistPct >= 0 &&
        lapDistPct < 0.2
      ) {
        crossedSF = true;
      }

      lastLapDistRef.current = lapDistPct;

      const isMoving = speed > 5;

      // Notify if we are waiting for S/F crossing in auto mode
      const isWaitingForSF =
        isMoving &&
        !recorder.isRecording &&
        !recorder.isComplete &&
        !isTrackMapForceStartPending;

      overlay?.setRecording(recorder.isRecording, isWaitingForSF);

      if (isWaitingForSF !== lastIsWaitingForSFRef.current) {
        lastIsWaitingForSFRef.current = isWaitingForSF;

        queueMicrotask(() =>
          callbacksRef.current.onWaitingForSFChange?.(isWaitingForSF)
        );
      }

      // Start recording when speed > 5 m/s (~18 km/h) AND (we crossed S/F OR manual force was requested).
      // Once complete, we stay complete until trackId changes or reset is called.
      if (!recorder.isRecording && !recorder.isComplete && isMoving) {
        if (crossedSF || isTrackMapForceStartPending) {
          runInAction(() => widgetSettings.setTrackMapForceStartPending(false));

          hasSavedRef.current = false;
          recorder.start();

          if (lastIsRecordingRef.current !== true) {
            lastIsRecordingRef.current = true;

            queueMicrotask(() =>
              callbacksRef.current.onIsRecordingChange(true)
            );
          }

          overlay?.setRecording(true);
        }
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
          lastIsRecordingRef.current = false;
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
  }, [telemetry, widgetSettings]);

  return null;
};
