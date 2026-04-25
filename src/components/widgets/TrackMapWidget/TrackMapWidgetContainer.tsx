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
  const { weekendInfo, session: sessionFrame, sessionInfo } = telemetryStore;
  const lapTiming = telemetryStore.lapTiming;
  const settings = widgetSettingsStore.getTrackMapSettings();

  const trackId = weekendInfo?.TrackID?.toString() ?? '';
  const trackName = weekendInfo?.TrackDisplayName ?? '';
  const trackConfig = weekendInfo?.TrackConfigName ?? '';

  const hasSavedRef = useRef(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [trackData, setTrackData] = useState<TrackData | null>(null);
  const recordingOverlayRef = useRef<RecordingOverlayHandle>(null);

  const [sectorTimes, setSectorTimes] = useState<(number | null)[]>([]);
  const lastSectorIdxRef = useRef(-1);
  const sectorEntryTimeRef = useRef(-1);
  const lastLapRef = useRef(-1);

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

  useEffect(() => {
    const sectors =
      sessionInfo?.SplitTimeInfo?.Sectors?.filter(
        (s) => s.SectorStartPct != null && s.SectorNum != null
      ).sort((a, b) => (a.SectorStartPct ?? 0) - (b.SectorStartPct ?? 0)) ?? [];

    setSectorTimes(new Array(sectors.length).fill(null));
    lastSectorIdxRef.current = -1;
    sectorEntryTimeRef.current = -1;
    lastLapRef.current = -1;
  }, [sessionInfo?.SplitTimeInfo?.Sectors]);

  useEffect(() => {
    if (!lapTiming || !sessionFrame || !sessionInfo) return;

    const sectors =
      sessionInfo.SplitTimeInfo?.Sectors?.filter(
        (s) => s.SectorStartPct != null && s.SectorNum != null
      ).sort((a, b) => (a.SectorStartPct ?? 0) - (b.SectorStartPct ?? 0)) ?? [];

    if (sectors.length === 0) return;

    const lapDistPct = lapTiming.lap_dist_pct ?? -1;
    const sessionTime = sessionFrame.session_time ?? 0;
    const currentLap = lapTiming.lap ?? 0;

    if (lapDistPct < 0) return;

    if (currentLap !== lastLapRef.current && lastLapRef.current >= 0) {
      lastSectorIdxRef.current = -1;
      sectorEntryTimeRef.current = -1;
      setSectorTimes(new Array(sectors.length).fill(null));
    }
    lastLapRef.current = currentLap;

    let currentSectorIdx = 0;
    for (let i = sectors.length - 1; i >= 0; i--) {
      if ((sectors[i].SectorStartPct ?? 0) <= lapDistPct) {
        currentSectorIdx = i;
        break;
      }
    }

    if (currentSectorIdx !== lastSectorIdxRef.current) {
      if (lastSectorIdxRef.current >= 0 && sectorEntryTimeRef.current >= 0) {
        const elapsed = sessionTime - sectorEntryTimeRef.current;
        if (elapsed > 0 && elapsed < 600) {
          const prevIdx = lastSectorIdxRef.current;
          setSectorTimes((prev) => {
            const next = [...prev];
            next[prevIdx] = elapsed;
            return next;
          });
        }
      }
      lastSectorIdxRef.current = currentSectorIdx;
      sectorEntryTimeRef.current = sessionTime;
    }
  }, [lapTiming, sessionFrame, sessionInfo]);

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
        recordingProgress={recordingProgress}
        recordingOverlayRef={recordingOverlayRef}
        settings={settings}
        sectors={sessionInfo?.SplitTimeInfo?.Sectors}
        sectorTimes={sectorTimes}
      />
    </>
  );
});
