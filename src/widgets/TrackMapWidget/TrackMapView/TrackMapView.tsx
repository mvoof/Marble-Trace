import type { RefObject } from 'react';
import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@/components/shared/primitives/WidgetPanel/WidgetPanel';
import type { TrackPoint } from '@/types';
import { telemetryStore } from '@store/iracing/telemetry.store';
import { computedStore } from '@store/iracing/computed.store';
import { widgetSettingsStore } from '@store/widget-settings.store';
import type { RecordingOverlayHandle } from '@widgets/TrackMapWidget/RecordingOverlay/RecordingOverlay';
import { RecordingOverlay } from '@widgets/TrackMapWidget/RecordingOverlay/RecordingOverlay';
import { TrackMapSvg } from '@widgets/TrackMapWidget/TrackMapSvg/TrackMapSvg';
import type { CarOnTrack } from '@widgets/TrackMapWidget/types';

import styles from './TrackMapView.module.scss';

export interface TrackData {
  svgPath: string;
  viewBox: string;
  points: TrackPoint[];
}

export interface TrackMapViewProps {
  trackData: TrackData | null;
  isRecording: boolean;
  recordingProgress: number;
  isWaitingForSF: boolean;
  recordingOverlayRef?: RefObject<RecordingOverlayHandle | null>;
}

export const TrackMapView = observer(
  ({
    trackData,
    isRecording,
    recordingProgress,
    isWaitingForSF,
    recordingOverlayRef,
  }: TrackMapViewProps) => {
    const settings = widgetSettingsStore.getTrackMapSettings();
    const sectors = telemetryStore.sessionInfo?.SplitTimeInfo?.Sectors;

    const driverEntries = computedStore.standings?.entries ?? [];
    const carPositions = telemetryStore.carPositions;

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

    if (!trackData) {
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
        <TrackMapSvg
          svgPath={trackData.svgPath}
          viewBox={trackData.viewBox}
          points={trackData.points}
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
