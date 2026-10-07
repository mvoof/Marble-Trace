import { useCallback, useEffect } from 'react';
import { observer } from 'mobx-react-lite';

import { TrackMapView, type TrackData } from '../TrackMapView/TrackMapView';
import type { TrackRotateDirection } from '@store/widgets/track-map/track-map.store';
import { useSessionStore } from '@store/data/session-context';
import { useTrackMapWidgetStore } from '@store/widgets/track-map/track-map-context';

export const TrackMapContent = observer(() => {
  const sessionData = useSessionStore();
  const trackMapWidget = useTrackMapWidgetStore();

  const trackId = sessionData.trackKey;

  useEffect(() => {
    if (!trackId) return;

    void trackMapWidget.onTrackChanged(trackId);
  }, [trackId, trackMapWidget]);

  const handleRotate = useCallback(
    (direction: TrackRotateDirection) => {
      if (!trackId) return;

      trackMapWidget.rotateTrack(trackId, direction);
    },
    [trackId, trackMapWidget]
  );

  const trackData: TrackData | null = trackMapWidget.trackShape
    ? {
        svgPath: trackMapWidget.trackShape.svgPath,
        viewBox: trackMapWidget.trackShape.viewBox,
        points: trackMapWidget.trackShape.points,
        rotation: trackMapWidget.trackRotation,
      }
    : null;

  return (
    <TrackMapView
      trackData={trackData}
      isRecording={trackMapWidget.isRecording}
      isWaitingForSF={trackMapWidget.isWaitingForSF}
      recordingProgress={trackMapWidget.recordingProgress}
      onRotate={handleRotate}
    />
  );
});
