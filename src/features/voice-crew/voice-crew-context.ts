import { createStoreContext } from '@shared/lib/store-context';
import type { VoiceCrewStore } from './voice-crew.store';

export const [VoiceCrewContext, useVoiceCrewStore] =
  createStoreContext<VoiceCrewStore>('VoiceCrewStore');
