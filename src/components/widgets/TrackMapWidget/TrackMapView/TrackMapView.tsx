import type { RefObject } from 'react';

import { WidgetPanel } from '../../../shared/primitives/WidgetPanel/WidgetPanel';
import type { TrackPoint } from '../../../../types';
import type { TrackMapWidgetSettings } from '../../../../types/widget-settings';
import type { Sector } from '../../../../types/bindings';
import type { RecordingOverlayHandle } from '../RecordingOverlay/RecordingOverlay';
import { RecordingOverlay } from '../RecordingOverlay/RecordingOverlay';
import { TrackMapSvg } from '../TrackMapSvg/TrackMapSvg';
import type { CarOnTrack } from '../types';

import styles from './TrackMapView.module.scss';

export interface TrackData {
  svgPath: string;
  viewBox: string;
  points: TrackPoint[];
}

export interface TrackMapViewProps {
  cars: CarOnTrack[];
  trackData: TrackData | null;
  trackName: string;
  isRecording: boolean;
  recordingProgress: number;
  isForceStartPending: boolean;
  isWaitingForSF: boolean;
  recordingOverlayRef?: RefObject<RecordingOverlayHandle | null>;
  settings: TrackMapWidgetSettings;
  sectors: Sector[] | null | undefined;
}

export const TrackMapView = ({
  cars,
  trackData,
  trackName,
  isRecording,
  recordingProgress,
  isForceStartPending,
  isWaitingForSF,
  recordingOverlayRef,
  settings,
  sectors,
}: TrackMapViewProps) => {
  if (!trackData) {
    return (
      <WidgetPanel className={styles.trackMap} gap={0}>
        <RecordingOverlay
          ref={recordingOverlayRef}
          trackName={trackName}
          isRecording={isRecording}
          isForceStartPending={isForceStartPending}
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
};
