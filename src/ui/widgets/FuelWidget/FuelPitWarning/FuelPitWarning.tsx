import { observer } from 'mobx-react-lite';

import { PitWarningHeader } from './PitWarningHeader/PitWarningHeader';
import { PitWarningFill } from './PitWarningFill/PitWarningFill';

import type { FuelWidgetSettings } from '@/types/widget-settings';
import styles from './FuelPitWarning.module.scss';
import {
  useBackendComputedStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

export const FuelPitWarning = observer(() => {
  const { fuel } = useBackendComputedStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings = widgetSettings.getSettings<FuelWidgetSettings>('fuel');

  const lapsRemaining = fuel?.lapsRemaining ?? null;

  const isVisible =
    lapsRemaining !== null && lapsRemaining <= settings.pitWarningLaps;

  if (!isVisible) {
    return null;
  }

  return (
    <div className={styles.pitWarning}>
      <PitWarningHeader />

      <PitWarningFill />
    </div>
  );
});
