import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '../primitives';
import { telemetryStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import {
  parseClassColor,
  formatClassShortName,
} from '../../../utils/class-color';
import { TrackRecorder, getPointAtPct } from '../../../utils/track-recorder';
import type { TrackPoint } from '../../../utils/track-recorder';
import type { Driver } from '../../../types/bindings';

import styles from './TrackMapWidget.module.scss';

interface CarOnTrack {
  carIdx: number;
  carNumber: string;
  carClassColor: string;
  lapDistPct: number;
  trackSurface: number;
  isPlayer: boolean;
  position: number;
}

/** Key for storing recorded tracks in tauri-plugin-store */
const TRACKS_STORE_KEY = 'recorded-tracks';

const TRACK_DATA_VERSION = 2;

interface StoredTrackData {
  trackName: string;
  trackConfig: string;
  svgPath: string;
  viewBox: string;
  points: TrackPoint[];
  recordedAt: string;
  version?: number;
}

interface StoredTracks {
  [trackId: string]: StoredTrackData;
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

  // Track recording state
  const recorderRef = useRef(new TrackRecorder());
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [trackData, setTrackData] = useState<{
    svgPath: string;
    viewBox: string;
    points: TrackPoint[];
  } | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  // Load stored track on mount or track change
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

  // Save track after recording
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

  // Feed telemetry to recorder
  useEffect(() => {
    if (trackData || !carDynamics || !lapTiming || !sessionFrame) return;

    const recorder = recorderRef.current;
    const speed = carDynamics.speed ?? 0;
    const yaw = carDynamics.yaw ?? 0;
    const lapDistPct = lapTiming.lap_dist_pct ?? -1;
    const sessionTime = sessionFrame.session_time ?? 0;

    if (lapDistPct < 0) return;

    // Auto-start recording when car starts moving
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

  // Car positions
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

  // If no track data, show recording UI
  if (!trackData) {
    return (
      <WidgetPanel className={styles.trackMap} gap={0}>
        <div className={styles.recordingOverlay}>
          <div className={styles.recordingTitle}>
            {trackName || 'Track Map'}
          </div>

          <div className={styles.recordingMessage}>
            {isRecording
              ? 'Recording track...'
              : 'Drive 1 full lap to record track'}
          </div>

          <div className={styles.progressBarWrap}>
            <div
              className={styles.progressBarFill}
              style={{ width: `${recordingProgress * 100}%` }}
            />
          </div>

          <div className={styles.progressLabel}>
            {Math.round(recordingProgress * 100)}%
          </div>
        </div>
      </WidgetPanel>
    );
  }

  // Render track map with recorded path
  return (
    <WidgetPanel className={styles.trackMap} gap={0}>
      {settings.showLegend && settings.legendPosition !== 'hidden' && (
        <div
          className={`${styles.legend} ${
            settings.legendPosition === 'right'
              ? styles.legendRight
              : styles.legendLeft
          }`}
        >
          <div className={styles.legendTitle}>Class Legend</div>

          <div className={styles.legendItems}>
            {classColors.map(({ name, color }) => (
              <div key={name} className={styles.legendItem}>
                <div
                  className={styles.legendDot}
                  style={{ backgroundColor: color }}
                />
                <span className={styles.legendLabel}>{name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <svg viewBox={trackData.viewBox} className={styles.svgContainer}>
        {/* Track border */}
        <path
          d={trackData.svgPath}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="12"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.6"
        />

        {/* Track surface */}
        <path
          d={trackData.svgPath}
          fill="none"
          stroke="#0f172a"
          strokeWidth="10"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Sector markers */}
        {trackData.points.length > 0 &&
          sessionInfo?.SplitTimeInfo?.Sectors?.map((sector) => {
            if (sector.SectorStartPct == null || sector.SectorNum == null)
              return null;

            const { x, y } = getPointAtPct(
              trackData.points,
              sector.SectorStartPct
            );

            return (
              <g key={sector.SectorNum} transform={`translate(${x}, ${y})`}>
                <circle
                  r="6"
                  fill="rgba(255,255,255,0.15)"
                  stroke="rgba(255,255,255,0.5)"
                  strokeWidth="1.5"
                />

                <text
                  textAnchor="middle"
                  dy="-12"
                  className={styles.sectorLabel}
                >
                  S{sector.SectorNum}
                </text>
              </g>
            );
          })}

        {/* Cars */}
        {trackData.points.length > 0 &&
          cars.map((car) => {
            const { x, y } = getPointAtPct(trackData.points, car.lapDistPct);
            const isP1 = car.position === 1;
            const showLabel = car.isPlayer || isP1;

            return (
              <g key={car.carIdx} transform={`translate(${x}, ${y})`}>
                {car.isPlayer && (
                  <circle r="14" fill="white" className={styles.playerPing} />
                )}

                <circle
                  r={car.isPlayer ? 14 : 12}
                  fill="#18181b"
                  stroke={car.carClassColor}
                  strokeWidth="3"
                />

                <text
                  textAnchor="middle"
                  dy="4"
                  className={`${styles.carNumber} ${car.isPlayer ? styles.carNumberLarge : ''}`}
                >
                  {car.carNumber}
                </text>

                {showLabel && (
                  <g transform="translate(0, -25)">
                    <rect
                      x="-25"
                      y="-12"
                      width="50"
                      height="16"
                      rx="4"
                      fill={car.isPlayer ? 'white' : 'rgba(24,24,27,0.9)'}
                      stroke={car.isPlayer ? 'none' : 'rgba(255,255,255,0.15)'}
                      strokeWidth="1"
                    />

                    <text
                      textAnchor="middle"
                      dy="0"
                      className={car.isPlayer ? styles.youTag : styles.p1Tag}
                      fill={car.isPlayer ? 'black' : 'white'}
                    >
                      {car.isPlayer ? 'YOU' : 'P1'}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
      </svg>
    </WidgetPanel>
  );
});
