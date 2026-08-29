import { observer } from 'mobx-react-lite';

import { PitWarningHeader } from './PitWarningHeader/PitWarningHeader';
import { PitWarningFill } from './PitWarningFill/PitWarningFill';

import type { FuelWidgetSettings } from '@/types/widget-settings';
import { ReservedSlot } from '@ui/shared/ReservedSlot/ReservedSlot';
import styles from './FuelPitWarning.module.scss';
import {
  useBackendComputedStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

/**
 * The header row, the separator, the fill's amount cell and its footer, plus
 * `sp(sm)` of padding at each end — what `.pitWarning` and its two children
 * measure at design scale.
 */
const PIT_WARNING_HEIGHT_PX = 120;

export const FuelPitWarning = observer(() => {
  const { fuel } = useBackendComputedStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings = widgetSettings.getSettings<FuelWidgetSettings>('fuel');

  const lapsRemaining = fuel?.lapsRemaining ?? null;

  const isVisible =
    lapsRemaining !== null && lapsRemaining <= settings.pitWarningLaps;

  // The warning is the block the widget grows by at the worst possible moment:
  // it arrives near the end of a stint, and everything under it would shift as
  // the driver is reading it. It keeps its room from the start instead.
  if (!isVisible) {
    return <ReservedSlot height={PIT_WARNING_HEIGHT_PX} label="Pit warning" />;
  }

  return (
    <div className={styles.pitWarning}>
      <PitWarningHeader />

      <PitWarningFill />
    </div>
  );
});
