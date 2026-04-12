import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '../primitives';
import { telemetryStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import {
  parseClassColor,
  formatClassShortName,
} from '../../../utils/class-color';
import { TrackRecorder } from '../../../utils/track-recorder';
import type { TrackPoint } from '../../../utils/track-recorder';
import type { Driver } from '../../../types/bindings';

import { RecordingOverlay } from './RecordingOverlay/RecordingOverlay';
import { ClassLegend } from './ClassLegend/ClassLegend';
import { TrackMapSvg } from './TrackMapSvg/TrackMapSvg';
import type { CarOnTrack, StoredTracks } from './types';
import { TRACKS_STORE_KEY, TRACK_DATA_VERSION } from './types';

import styles from './TrackMapWidget.module.scss';

interface TrackData {
  svgPath: string;
  viewBox: string;
  points: TrackPoint[];
}

export const TrackMapWidget = observer(() => {
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

  const drivers = useMemo(
    (): Driver[] => driverInfo?.Drivers ?? [],
    [driverInfo?.Drivers]
  );

  const recorderRef = useRef(new TrackRecorder());
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [trackData, setTrackData] = useState<TrackData | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    if (!trackId) return;

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

  useEffect(() => {
    if (trackData || !carDynamics || !lapTiming || !sessionFrame) return;

    const recorder = recorderRef.current;
    const speed = carDynamics.speed ?? 0;
    const yaw = carDynamics.yaw ?? 0;
    const lapDistPct = lapTiming.lap_dist_pct ?? -1;
    const sessionTime = sessionFrame.session_time ?? 0;

    if (lapDistPct < 0) return;

    if (!recorder.isRecording && !recorder.isComplete && speed > 5) {
      recorder.start();
      setIsRecording(true);
    }

    if (recorder.isRecording) {
      recorder.tick(speed, yaw, lapDistPct, sessionTime);
      setRecordingProgress(recorder.progress);

      if (recorder.isComplete) {
        const { svgPath, viewBox } = recorder.buildSvgPath();
        const points = recorder.getPoints();
        setTrackData({ svgPath, viewBox, points });
        setIsRecording(false);
        saveTrack(svgPath, viewBox, points);
      }
    }
  }, [carDynamics, lapTiming, sessionFrame, trackData, saveTrack]);

  const cars = useMemo((): CarOnTrack[] => {
    if (!carIdx || drivers.length === 0) return [];

    return drivers
      .filter((d) => {
        const idx = d.CarIdx;
        if (d.CarIsPaceCar === 1 || d.IsSpectator === 1) return false;
        if (idx >= carIdx.car_idx_position.length) return false;
        const pos = carIdx.car_idx_position[idx] ?? 0;
        const pct = carIdx.car_idx_lap_dist_pct[idx] ?? -1;
        return pos > 0 || pct >= 0;
      })
      .map((d): CarOnTrack => {
        const idx = d.CarIdx;
        return {
          carIdx: idx,
          carNumber: d.CarNumber ?? '',
          carClassColor: d.CarClassColor
            ? parseClassColor(d.CarClassColor)
            : '#888888',
          lapDistPct: carIdx.car_idx_lap_dist_pct[idx] ?? 0,
          trackSurface: carIdx.car_idx_track_surface?.[idx] ?? -1,
          isPlayer: idx === playerCarIdx,
          position: carIdx.car_idx_position[idx] ?? 0,
        };
      });
  }, [carIdx, drivers, playerCarIdx]);

  const classColors = useMemo(() => {
    const map = new Map<string, string>();

    for (const d of drivers) {
      const rawClass =
        d.CarClassShortName ||
        (d.CarClassRelSpeed != null ? `Class ${d.CarClassRelSpeed}` : 'Class');
      const name = formatClassShortName(
        rawClass,
        d.CarScreenName,
        d.CarClassID
      );

      if (!map.has(name)) {
        map.set(
          name,
          d.CarClassColor ? parseClassColor(d.CarClassColor) : '#888888'
        );
      }
    }

    return Array.from(map.entries()).map(([name, color]) => ({ name, color }));
  }, [drivers]);

  if (!trackData) {
    return (
      <WidgetPanel className={styles.trackMap} gap={0}>
        <RecordingOverlay
          trackName={trackName}
          isRecording={isRecording}
          progress={recordingProgress}
        />
      </WidgetPanel>
    );
  }

  return (
    <WidgetPanel className={styles.trackMap} gap={0}>
      {settings.showLegend && settings.legendPosition !== 'hidden' && (
        <ClassLegend
          classes={classColors}
          position={settings.legendPosition === 'right' ? 'right' : 'left'}
        />
      )}

      <TrackMapSvg
        svgPath={trackData.svgPath}
        viewBox={trackData.viewBox}
        points={trackData.points}
        cars={cars}
        sectors={sessionInfo?.SplitTimeInfo?.Sectors}
      />
    </WidgetPanel>
  );
});
