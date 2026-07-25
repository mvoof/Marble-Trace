import { useMemo } from 'react';
import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@/components/shared/WidgetPanel/WidgetPanel';
import { TrackSurface, type TrackPoint } from '@/types';
import { parseClassColor } from '@utils/formatters/color-utils';
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
  useCarsStore,
  usePaceCarStore,
  useSessionStore,
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
  onRotate?: (direction: 'cw' | 'ccw') => void;
}

export const TrackMapView = observer(
  ({
    trackData,
    isRecording,
    recordingProgress,
    isWaitingForSF,
    onRotate,
  }: TrackMapViewProps) => {
    const { sessionInfo } = useSessionStore();
    const { carPositions } = useCarsStore();
    const computed = useBackendComputedStore();
    const widgetSettings = useWidgetSettingsStore();
    const paceCarStore = usePaceCarStore();
    const { dragMode } = useAppSettingsStore();

    const rawSettings =
      widgetSettings.getSettings<TrackMapWidgetSettings>('track-map');

    const showSectors = rawSettings.showSectors ?? true;
    const showSectorsOnMap = rawSettings.showSectorsOnMap ?? showSectors;

    const settings = { ...rawSettings, showSectors, showSectorsOnMap };

    const sectors = sessionInfo?.sectors;

    const driverEntries = computed.standings?.entries ?? [];

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

    const competitorCars: CarOnTrack[] = driverEntries.map((entry) => ({
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

    // Pace cars are filtered out of standings, so pull them straight from the
    // session roster. In multiclass races each class has its own pace car.
    // Only shown while physically on track (lapDistPct >= 0). Hidden while
    // parked in its pit stall (or driving in) unless paceCarShowInPits is on —
    // driving back out is always shown so you can time the merge behind it.
    const paceCarShowInPits = settings.paceCarShowInPits ?? false;

    const paceCars: CarOnTrack[] = (sessionInfo?.cars ?? []).flatMap((car) => {
      if (!car.isPaceCar) return [];

      const lapDistPct = carPositions?.car_idx_lap_dist_pct[car.carIdx] ?? -1;

      if (lapDistPct < 0) return [];

      const pitPhase = paceCarStore.getPitPhase(car.carIdx);

      if (
        !paceCarShowInPits &&
        pitPhase !== 'onTrack' &&
        pitPhase !== 'pitOut'
      ) {
        return [];
      }

      return [
        {
          carIdx: car.carIdx,
          carNumber: '',
          carClassColor: parseClassColor(car.carClassColor),
          carClassId: car.carClassId,
          lapDistPct,
          trackSurface:
            carPositions?.car_idx_track_surface[car.carIdx] ??
            TrackSurface.NotInWorld,
          isPlayer: false,
          position: 0,
          classPosition: 0,
          isPaceCar: true,
          pitPhase,
        },
      ];
    });

    const cars: CarOnTrack[] = [...competitorCars, ...paceCars];

    if (!rotatedTrackData) {
      return (
        <WidgetPanel className={styles.trackMap} gap={0}>
          <RecordingOverlay
            isRecording={isRecording}
            isWaitingForSF={isWaitingForSF}
            progress={recordingProgress}
          />
        </WidgetPanel>
      );
    }

    const visibleSectors = settings.showSectorsOnMap ? sectors : null;

    const showStartFinish = settings.showStartFinish ?? true;

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
          showStartFinish={showStartFinish}
          paceCarUseClassColor={settings.paceCarUseClassColor}
          paceCarColor={settings.paceCarColor}
          paceCarRadiusPx={
            settings.paceCarRadiusPx ?? settings.targetDotRadiusPx
          }
        />
      </WidgetPanel>
    );
  }
);
