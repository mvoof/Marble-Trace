import { reaction, type IReactionDisposer, compareStructural } from 'mobx';

import { voiceCrewSettingsOf } from '@entities/app-settings/app-settings.store';
import { configureVoiceCrewSilent } from '@shared/api/voice.service';
import type { RendererCore } from '@app/roots/renderer-core';

/**
 * The main window's half of the voice crew: its settings, pushed to the
 * backend. Registered after hydration, so the first push is the user's.
 */
export const registerVoiceMainReactions = (
  root: RendererCore
): IReactionDisposer[] => [
  reaction(
    () => voiceCrewSettingsOf(root.appSettings.appSettings),
    (settings) => configureVoiceCrewSilent(settings),
    { equals: compareStructural, fireImmediately: true }
  ),
];
