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
    visibleSectors
      ?.filter((s) => s.SectorNum != null && s.SectorStartPct != null)
      .sort((a, b) => (a.SectorStartPct ?? 0) - (b.SectorStartPct ?? 0))
      .map((s) => ({ sectorNum: s.SectorNum! })) ?? [];

  return (
    <WidgetPanel className={styles.trackMap} gap={0}>
      <div className={styles.svgWrapper}>
        <TrackMapSvg
          svgPath={trackData.svgPath}
          viewBox={trackData.viewBox}
          points={trackData.points}
          cars={cars}
          sectors={visibleSectors}
        />
      </div>

      {(settings.showLegend ||
        (settings.showSectors && sectorEntries.length > 0)) && (
        <div className={styles.bottomBar}>
          {settings.showLegend && <ClassLegend classes={classColors} />}

          {settings.showSectors && sectorEntries.length > 0 && (
            <SectorTimesStrip
              sectors={sectorEntries}
              sectorTimes={sectorTimes}
            />
          )}
        </div>
      )}
    </WidgetPanel>
  );
};
