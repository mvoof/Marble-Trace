import { useTranslation } from 'react-i18next';

import { useCarCatalogueStore } from '@entities/cars/car-catalogue-context';
import type { RuleSituation } from '@entities/layout/auto-switch-rules';

import { SESSION_LOOKS } from './session-labels';
import { ruleCarName } from './rule-options';
import { useLiveCars } from './use-live-cars';

/** A situation in words, "Race · GT3 · BMW M4 GT3": what a chip and the Now line say. */
export const useSituationLabel = (): ((situation: RuleSituation) => string) => {
  const catalogue = useCarCatalogueStore();
  const liveCars = useLiveCars();
  const { t } = useTranslation('main-app');

  return (situation) => {
    const carName =
      situation.carId === null
        ? null
        : (ruleCarName(catalogue.cars, liveCars, situation.carId) ??
          t('layoutList.autoSwitch.carById', { id: situation.carId }));
    const sessionName =
      situation.context === null
        ? t('layoutList.autoSwitch.anySession')
        : t(SESSION_LOOKS[situation.context].labelKey);
    const parts = [sessionName, situation.carClass, carName].filter(
      (part): part is string => part !== null
    );

    return parts.join(' · ');
  };
};
