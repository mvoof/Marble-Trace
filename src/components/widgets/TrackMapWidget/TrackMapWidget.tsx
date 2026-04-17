import { WidgetPanel } from '../primitives';
import type { TrackPoint } from '../../../utils/track-recorder';
import type { TrackMapWidgetSettings } from '../../../store/widget-settings.store';
import type { Sector } from '../../../types/bindings';

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
  playerYaw: number | undefined;
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
  playerYaw,
  settings,
  sectors,
  sectorTimes,
}: TrackMapWidgetProps) => {
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

  const visibleSectors = settings.showSectors ? sectors : null;
  const sectorEntries =
    visibleSectors
      ?.filter((s) => s.SectorNum != null && s.SectorStartPct != null)
      .sort((a, b) => (a.SectorStartPct ?? 0) - (b.SectorStartPct ?? 0))
      .map((s) => ({ sectorNum: s.SectorNum! })) ?? [];

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
        sectors={visibleSectors}
        playerYaw={playerYaw}
      />

      {settings.showSectors && sectorEntries.length > 0 && (
        <SectorTimesStrip sectors={sectorEntries} sectorTimes={sectorTimes} />
      )}
    </WidgetPanel>
  );
};
