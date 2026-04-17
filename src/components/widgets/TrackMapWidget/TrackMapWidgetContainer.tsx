import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { listen } from '@tauri-apps/api/event';

import { telemetryStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { computeDriverEntries } from '../widget-utils';
import { TrackRecorder } from '../../../utils/track-recorder';
import type { TrackPoint } from '../../../utils/track-recorder';

import { TrackMapWidget } from './TrackMapWidget';
import type { CarOnTrack, StoredTracks } from './types';
import { TRACKS_STORE_KEY, TRACK_DATA_VERSION } from './types';

interface TrackData {
  svgPath: string;
  viewBox: string;
  points: TrackPoint[];
}

export const TrackMapWidgetContainer = observer(() => {
  const carIdx = telemetryStore.carIdx;
  const carDynamics = telemetryStore.carDynamics;
  const lapTiming = telemetryStore.lapTiming;
  const {
    driverInfo,
    weekendInfo,
    session: sessionFrame,
    sessionInfo,
  } = telemetryStore;
  const settings = widgetSettingsStore.getTrackMapSettings();

  const playerCarIdx = driverInfo?.DriverCarIdx ?? -1;
  const trackId = weekendInfo?.TrackID?.toString() ?? '';
  const trackName = weekendInfo?.TrackDisplayName ?? '';
  const trackConfig = weekendInfo?.TrackConfigName ?? '';

  const recorderRef = useRef(new TrackRecorder());
  const hasSavedRef = useRef(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [trackData, setTrackData] = useState<TrackData | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    if (!trackId) return;

    hasSavedRef.current = false;

    const loadTrack = async () => {
      try {
        const { load } = await import('@tauri-apps/plugin-store');
        const store = await load('tracks.json');
        const tracks = (await store.get<StoredTracks>(TRACKS_STORE_KEY)) ?? {};
        const saved = tracks[trackId];

        if (
          saved &&
          saved.svgPath &&
          saved.points?.length > 0 &&
          (saved.version ?? 0) >= TRACK_DATA_VERSION
        ) {
          setTrackData({
            svgPath: saved.svgPath,
            viewBox: saved.viewBox,
            points: saved.points,
          });
        } else {
          setTrackData(null);
        }
      } catch {
        setTrackData(null);
      }
    };

    loadTrack();
  }, [trackId]);

  const saveTrack = useCallback(
    async (svgPath: string, viewBox: string, points: TrackPoint[]) => {
      if (!trackId) return;

      try {
        const { load } = await import('@tauri-apps/plugin-store');
        const store = await load('tracks.json');
        const tracks = (await store.get<StoredTracks>(TRACKS_STORE_KEY)) ?? {};

        tracks[trackId] = {
          trackName,
          trackConfig,
          svgPath,
          viewBox,
          points,
          recordedAt: new Date().toISOString(),
          version: TRACK_DATA_VERSION,
        };

        await store.set(TRACKS_STORE_KEY, tracks);
        await store.save();
      } catch {
        // Silently fail — track will need re-recording
      }
    },
    [trackId, trackName, trackConfig]
  );

  const clearCurrentTrack = useCallback(async () => {
    if (!trackId) return;
    try {
      const { load } = await import('@tauri-apps/plugin-store');
      const store = await load('tracks.json');
      const tracks = (await store.get<StoredTracks>(TRACKS_STORE_KEY)) ?? {};
      delete tracks[trackId];
      await store.set(TRACKS_STORE_KEY, tracks);
      await store.save();
      setTrackData(null);
      setIsRecording(false);
      setRecordingProgress(0);
      recorderRef.current = new TrackRecorder();
      hasSavedRef.current = false;
    } catch {
      // Silently fail
    }
  }, [trackId]);

  useEffect(() => {
    const unlisten = listen('track-map:clear', () => {
      clearCurrentTrack();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [clearCurrentTrack]);

  useEffect(() => {
    if (trackData || !carDynamics || !lapTiming || !sessionFrame) return;

    const recorder = recorderRef.current;
    const speed = carDynamics.speed ?? 0;
    const yaw = carDynamics.yaw ?? 0;
    const lapDistPct = lapTiming.lap_dist_pct ?? -1;
    const sessionTime = sessionFrame.session_time ?? 0;

    if (lapDistPct < 0) return;

    if (!recorder.isRecording && !recorder.isComplete && speed > 5) {
      hasSavedRef.current = false;
      recorder.start();
      setIsRecording(true);
    }

    if (recorder.isRecording) {
      recorder.tick(speed, yaw, lapDistPct, sessionTime);
      setRecordingProgress(recorder.progress);

      if (recorder.isComplete && !hasSavedRef.current) {
        hasSavedRef.current = true;
        const { svgPath, viewBox } = recorder.buildSvgPath();
        const points = recorder.getPoints();
        setTrackData({ svgPath, viewBox, points });
        setIsRecording(false);
        saveTrack(svgPath, viewBox, points);
      }
    }
  }, [carDynamics, lapTiming, sessionFrame, trackData, saveTrack]);

  const playerYaw = useMemo(() => {
    if (settings.rotationMode !== 'heading-up') return undefined;
    if (playerCarIdx < 0 || !carDynamics) return undefined;
    return carDynamics.yaw ?? undefined;
  }, [settings.rotationMode, playerCarIdx, carDynamics]);

  const driverEntries = useMemo(
    () => computeDriverEntries(carIdx, driverInfo),
    [carIdx, driverInfo]
  );

  const cars = useMemo(
    (): CarOnTrack[] =>
      driverEntries.map((e) => ({
        carIdx: e.carIdx,
        carNumber: e.carNumber,
        carClassColor: e.carClassColor,
        carClassId: e.carClassId,
        lapDistPct: e.lapDistPct,
        trackSurface: e.trackSurface,
        isPlayer: e.isPlayer,
        position: e.position,
        classPosition: e.classPosition,
      })),
    [driverEntries]
  );

  const classColors = useMemo(() => {
    const seen = new Map<number, { name: string; color: string }>();
    for (const e of driverEntries) {
      if (!seen.has(e.carClassId)) {
        seen.set(e.carClassId, {
          name: e.carClassShortName,
          color: e.carClassColor,
        });
      }
    }
    return Array.from(seen.values());
  }, [driverEntries]);

  return (
    <TrackMapWidget
      cars={cars}
      classColors={classColors}
      trackData={trackData}
      trackName={trackName}
      isRecording={isRecording}
      recordingProgress={recordingProgress}
      playerYaw={playerYaw}
      settings={settings}
      sectors={sessionInfo?.SplitTimeInfo?.Sectors}
    />
  );
});
