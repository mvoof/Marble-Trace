import { useCallback, useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { listen } from '@tauri-apps/api/event';

import { computedStore, telemetryStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import type { TrackPoint } from '../../../types/track';

import { TrackMapWidget } from './TrackMapWidget';
import { TrackRecorderBridge } from './TrackRecorderBridge/TrackRecorderBridge';
import type { RecordingOverlayHandle } from './RecordingOverlay/RecordingOverlay';
import type { CarOnTrack, StoredTracks } from './types';
import { TRACKS_STORE_KEY, TRACK_DATA_VERSION } from './types';

interface TrackData {
  svgPath: string;
  viewBox: string;
  points: TrackPoint[];
}

export const TrackMapWidgetContainer = observer(() => {
  const { weekendInfo, sessionInfo } = telemetryStore;
  const settings = widgetSettingsStore.getTrackMapSettings();

  const trackId = weekendInfo?.TrackID?.toString() ?? '';
  const trackName = weekendInfo?.TrackDisplayName ?? '';
  const trackConfig = weekendInfo?.TrackConfigName ?? '';

  const hasSavedRef = useRef(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isWaitingForSF, setIsWaitingForSF] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [trackData, setTrackData] = useState<TrackData | null>(null);
  const recordingOverlayRef = useRef<RecordingOverlayHandle>(null);

  const sectorTimes = computedStore.lapDelta?.sectorTimes ?? [];

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

    void loadTrack();
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
      setIsWaitingForSF(false);
      setRecordingProgress(0);
    } catch {
      // Silently fail
    }
  }, [trackId]);

  useEffect(() => {
    const unlisten = listen('track-map:clear', () => {
      void clearCurrentTrack();
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [clearCurrentTrack]);

  const driverEntries = computedStore.standings?.entries ?? [];

  const cars: CarOnTrack[] = driverEntries.map((e) => ({
    carIdx: e.carIdx,
    carNumber: e.carNumber,
    carClassColor: e.carClassColor,
    carClassId: e.carClassId,
    lapDistPct: e.lapDistPct,
    trackSurface: e.trackSurface,
    isPlayer: e.isPlayer,
    position: e.position,
    classPosition: e.classPosition,
  }));

  const classColorsSeen = new Map<number, { name: string; color: string }>();
  for (const e of driverEntries) {
    if (!classColorsSeen.has(e.carClassId)) {
      classColorsSeen.set(e.carClassId, {
        name: e.carClassShortName,
        color: e.carClassColor,
      });
    }
  }
  const classColors = Array.from(classColorsSeen.values());

  return (
    <>
      {/* Reads carDynamics (60Hz) in isolation — main container stays at ≤10Hz */}
      {!trackData && (
        <TrackRecorderBridge
          trackId={trackId}
          onTrackReady={setTrackData}
          onIsRecordingChange={setIsRecording}
          onWaitingForSFChange={setIsWaitingForSF}
          onProgressChange={setRecordingProgress}
          onSaveTrack={saveTrack}
          recordingOverlayRef={recordingOverlayRef}
        />
      )}

      <TrackMapWidget
        cars={cars}
        classColors={classColors}
        trackData={trackData}
        trackName={trackName}
        isRecording={isRecording}
        isWaitingForSF={isWaitingForSF}
        recordingProgress={recordingProgress}
        isForceStartPending={widgetSettingsStore.isTrackMapForceStartPending}
        recordingOverlayRef={recordingOverlayRef}
        settings={settings}
        sectors={sessionInfo?.SplitTimeInfo?.Sectors}
        sectorTimes={sectorTimes}
      />
    </>
  );
});
