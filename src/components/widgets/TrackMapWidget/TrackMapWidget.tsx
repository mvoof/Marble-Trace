import type { RefObject } from 'react';
import { WidgetPanel } from '../primitives';
import type { TrackPoint } from '../../../types/track';
import type { TrackMapWidgetSettings } from '../../../types/widget-settings';
import type { Sector } from '../../../types/bindings';

import type { RecordingOverlayHandle } from './RecordingOverlay/RecordingOverlay';
import { RecordingOverlay } from './RecordingOverlay/RecordingOverlay';
import { ClassLegend } from './ClassLegend/ClassLegend';
import { TrackMapSvg } from './TrackMapSvg/TrackMapSvg';
import { SectorTimesStrip } from './SectorTimesStrip/SectorTimesStrip';
import type { CarOnTrack } from './types';

import styles from './TrackMapWidget.module.scss';

interface TrackData {
  svgPath: string;
  viewBox: string;
  points: TrackPoint[];
}

interface ClassColor {
  name: string;
  color: string;
}

interface TrackMapWidgetProps {
  cars: CarOnTrack[];
  classColors: ClassColor[];
  trackData: TrackData | null;
  trackName: string;
  isRecording: boolean;
  recordingProgress: number;
  isForceStartPending: boolean;
  isWaitingForSF: boolean;
  recordingOverlayRef?: RefObject<RecordingOverlayHandle | null>;
  settings: TrackMapWidgetSettings;
  sectors: Sector[] | null | undefined;
  sectorTimes: (number | null)[];
  currentSectorIdx?: number;
}

export const TrackMapWidget = ({
  cars,
  classColors,
  trackData,
  trackName,
  isRecording,
  recordingProgress,
  isForceStartPending,
  isWaitingForSF,
  recordingOverlayRef,
  settings,
  sectors,
  sectorTimes,
  currentSectorIdx,
}: TrackMapWidgetProps) => {
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

  const visibleSectors = settings.showSectors ? sectors : null;
  const sectorEntries =
    sectors
      ?.filter((s) => s.SectorNum != null && s.SectorStartPct != null)
      .sort((a, b) => (a.SectorStartPct ?? 0) - (b.SectorStartPct ?? 0))
      .map((s) => ({ sectorNum: s.SectorNum! })) ?? [];

  const hasAnySectorData = sectorEntries.length > 0;

  return (
    <WidgetPanel className={styles.trackMap} gap={0}>
      <div className={styles.svgWrapper}>
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
      </div>

      <div className={styles.bottomBar}>
        <ClassLegend
          classes={classColors}
          className={!settings.showLegend ? styles.hidden : undefined}
        />

        {hasAnySectorData && (
          <SectorTimesStrip
            sectors={sectorEntries}
            sectorTimes={sectorTimes}
            currentSectorIdx={currentSectorIdx}
            className={!settings.showSectors ? styles.hidden : undefined}
          />
        )}
      </div>
    </WidgetPanel>
  );
};
