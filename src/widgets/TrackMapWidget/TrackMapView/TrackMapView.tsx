import { useMemo, type RefObject } from 'react';
import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@/components/shared/WidgetPanel/WidgetPanel';
import type { TrackPoint } from '@/types';
import type { RecordingOverlayHandle } from '@widgets/TrackMapWidget/RecordingOverlay/RecordingOverlay';
import { RecordingOverlay } from '@widgets/TrackMapWidget/RecordingOverlay/RecordingOverlay';
import { TrackMapSvg } from '@widgets/TrackMapWidget/TrackMapSvg/TrackMapSvg';
import type { CarOnTrack } from '@widgets/TrackMapWidget/types';
import { RotationControls } from './RotationControls/RotationControls';
import {
  rotatePoints,
  buildSvgPathAndViewBox,
} from '@utils/widget/track-map-utils';

import styles from './TrackMapView.module.scss';
import type { TrackMapWidgetSettings } from '@/types/widget-settings';
import {
  useAppSettingsStore,
  useBackendComputedStore,
  useTelemetryStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

export interface TrackData {
  svgPath: string;
  viewBox: string;
  points: TrackPoint[];
  rotation?: number;
}

export interface TrackMapViewProps {
  trackData: TrackData | null;
  isRecording: boolean;
  recordingProgress: number;
  isWaitingForSF: boolean;
  recordingOverlayRef?: RefObject<RecordingOverlayHandle | null>;
  onRotate?: (direction: 'cw' | 'ccw') => void;
}

export const TrackMapView = observer(
  ({
    trackData,
    isRecording,
    recordingProgress,
    isWaitingForSF,
    recordingOverlayRef,
    onRotate,
  }: TrackMapViewProps) => {
    const telemetry = useTelemetryStore();
    const computed = useBackendComputedStore();
    const widgetSettings = useWidgetSettingsStore();
    const { dragMode } = useAppSettingsStore();

    const rawSettings =
      widgetSettings.getSettings<TrackMapWidgetSettings>('track-map');

    const showSectors = rawSettings.showSectors ?? true;
    const showSectorsOnMap = rawSettings.showSectorsOnMap ?? showSectors;

    const settings = { ...rawSettings, showSectors, showSectorsOnMap };

    const sectors = telemetry.sessionInfo?.SplitTimeInfo?.Sectors;

    const driverEntries = computed.standings?.entries ?? [];
    const carPositions = telemetry.carPositions;

    const rotatedTrackData = useMemo(() => {
      if (!trackData) return null;
      const rotation = trackData.rotation ?? 0;
      if (rotation === 0) return trackData;

      const rotatedPts = rotatePoints(trackData.points, rotation);
      const { svgPath: rotatedSvgPath, viewBox: rotatedViewBox } =
        buildSvgPathAndViewBox(rotatedPts);

      return {
        svgPath: rotatedSvgPath,
        viewBox: rotatedViewBox,
        points: rotatedPts,
        rotation,
      };
    }, [trackData]);

    const cars: CarOnTrack[] = driverEntries.map((entry) => ({
      carIdx: entry.carIdx,
      carNumber: entry.carNumber,
      carClassColor: entry.carClassColor,
      carClassId: entry.carClassId,
      lapDistPct:
        carPositions?.car_idx_lap_dist_pct[entry.carIdx] ?? entry.lapDistPct,
      trackSurface:
        carPositions?.car_idx_track_surface[entry.carIdx] ?? entry.trackSurface,
      isPlayer: entry.isPlayer,
      position: entry.position,
      classPosition: entry.classPosition,
    }));

    if (!rotatedTrackData) {
      return (
        <WidgetPanel className={styles.trackMap} gap={0}>
          <RecordingOverlay
            ref={recordingOverlayRef}
            isRecording={isRecording}
            isWaitingForSF={isWaitingForSF}
            progress={recordingProgress}
          />
        </WidgetPanel>
      );
    }

    const visibleSectors = settings.showSectorsOnMap ? sectors : null;

    return (
      <WidgetPanel className={styles.trackMap} gap={0}>
        {dragMode && onRotate && <RotationControls onRotate={onRotate} />}

        <TrackMapSvg
          svgPath={rotatedTrackData.svgPath}
          viewBox={rotatedTrackData.viewBox}
          points={rotatedTrackData.points}
          cars={cars}
          sectors={visibleSectors}
          playerDotColor={settings.playerDotColor}
          showPlayerLabel={settings.showPlayerLabel}
          leaderLabelMode={settings.leaderLabelMode}
          trackStrokePx={settings.trackStrokePx}
          trackBorderPx={settings.trackBorderPx}
          sectorStrokePx={settings.sectorStrokePx}
          targetDotRadiusPx={settings.targetDotRadiusPx}
        />
      </WidgetPanel>
    );
  }
);
