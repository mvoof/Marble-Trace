import { createStoreContext } from '@shared/lib/store-context';
import type { TrackRotationStore } from './track-rotation.store';

export const [TrackRotationContext, useTrackRotationStore] =
  createStoreContext<TrackRotationStore>('TrackRotationStore');
