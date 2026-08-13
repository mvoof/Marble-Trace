import type { TFunction } from 'i18next';
import type { LapDeltaReference } from '@/types/widget-settings';

export const getDeltaReferenceDesc = (
  t: TFunction
): Record<LapDeltaReference, string> => ({
  personal_best: t('settingsPanels.delta.referenceDesc.personalBest', {
    ns: 'widgets',
  }),
  personal_optimal: t('settingsPanels.delta.referenceDesc.personalOptimal', {
    ns: 'widgets',
  }),
  session_best: t('settingsPanels.delta.referenceDesc.sessionBest', {
    ns: 'widgets',
  }),
  session_optimal: t('settingsPanels.delta.referenceDesc.sessionOptimal', {
    ns: 'widgets',
  }),
  session_last: t('settingsPanels.delta.referenceDesc.sessionLast', {
    ns: 'widgets',
  }),
});
