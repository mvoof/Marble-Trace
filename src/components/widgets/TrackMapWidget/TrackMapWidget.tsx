import { WidgetPanel } from '../primitives';
import type { TrackPoint } from '../../../utils/track-recorder';
import type { TrackMapWidgetSettings } from '../../../store/widget-settings.store';

import { RecordingOverlay } from './RecordingOverlay/RecordingOverlay';
import { ClassLegend } from './ClassLegend/ClassLegend';
import { TrackMapSvg } from './TrackMapSvg/TrackMapSvg';
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

interface SectorInfo {
  SectorNum: number | null;
  SectorStartPct: number | null;
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
  sectors: SectorInfo[] | null | undefined;
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
        sectors={sectors}
        playerYaw={playerYaw}
      />
    </WidgetPanel>
  );
};
