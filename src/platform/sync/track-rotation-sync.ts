import { comparer, reaction } from 'mobx';

import {
  emitTrackRotation,
  listenTo,
  type TrackRotationRequest,
  type UnlistenFn,
} from '@platform/services/events.service';
import { publishRemoteControl } from '@platform/services/remote.service';
import type { MainRoot } from '@store/roots/main-root';

/**
 * Main's half of the track-map angle: it takes the overlays' rotate steps,
 * broadcasts every angle it stores, and tells the remote screens the current
 * track's angle whenever the track changes — the server replays that message
 * to a screen that connects later, which is how a tablet opened mid-session
 * draws the map turned the way the user left it.
 */
export const registerTrackRotationOwnership = async (
  root: MainRoot
): Promise<UnlistenFn> => {
  const owner = root.trackRotation;

  const unlisten = await listenTo<TrackRotationRequest>(
    'track-rotation-requested',
    (e) => {
      void owner.step(e.payload.trackId, e.payload.direction);
    }
  );

  // Subscribed before the read, so a step sent meanwhile queues behind it.
  void owner.load();

  const disposers = [
    reaction(
      () => owner.lastChange,
      (change) => {
        if (!change) return;

        void emitTrackRotation(change);
      }
    ),
    reaction(
      () => ({ trackId: root.session.trackKey, isLoaded: owner.isLoaded }),
      ({ trackId, isLoaded }) => {
        if (!trackId || !isLoaded) return;

        void publishRemoteControl('track-rotation', {
          trackId,
          rotation: owner.rotationOf(trackId),
        }).catch((error: unknown) =>
          console.error('[track-rotation] failed to reach the remote:', error)
        );
      },
      { fireImmediately: true, equals: comparer.structural }
    ),
  ];

  return () => {
    unlisten();
    disposers.forEach((dispose) => dispose());
  };
};
