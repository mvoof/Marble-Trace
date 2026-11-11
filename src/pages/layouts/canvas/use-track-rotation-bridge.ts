import { useLayoutEffect } from 'react';
import { reaction, runInAction } from 'mobx';

import { useSessionStore } from '@entities/session/session-context';
import { useTrackRotationStore } from '@entities/track/track-rotation-context';
import type { PreviewCoreHandle } from '@features/preview/preview-host-context';

/**
 * Keeps the editor's sample map and the real one on the same angle.
 *
 * The editor draws a synthetic track, so rotating it there has to be filed
 * under the track the user is actually on — the preview store owns no track of
 * its own and never reaches the file. The reverse direction matters just as
 * much: a map turned in an overlay must already look turned when the editor
 * opens.
 */
export const useTrackRotationBridge = (previewStore: PreviewCoreHandle) => {
  const trackRotation = useTrackRotationStore();
  const sessionStore = useSessionStore();

  useLayoutEffect(() => {
    const previewMap = previewStore.trackMapWidget;
    const storedRotation = () =>
      trackRotation.rotationOf(sessionStore.trackKey);

    runInAction(() => previewMap.setTrackRotation(storedRotation()));

    const disposers = [
      reaction(
        () => previewMap.trackRotation,
        (rotation) => {
          if (rotation === storedRotation()) {
            return;
          }

          void trackRotation.setRotation(sessionStore.trackKey, rotation);
        }
      ),
      reaction(storedRotation, (rotation) => {
        runInAction(() => previewMap.setTrackRotation(rotation));
      }),
    ];

    return () => disposers.forEach((dispose) => dispose());
  }, [previewStore, sessionStore, trackRotation]);
};
