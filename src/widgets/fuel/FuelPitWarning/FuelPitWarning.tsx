import { observer } from 'mobx-react-lite';

import { PitWarningHeader } from './PitWarningHeader/PitWarningHeader';
import { PitWarningFill } from './PitWarningFill/PitWarningFill';

import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import { ReservedSlot } from '@entities/app-settings/ReservedSlot/ReservedSlot';
import styles from './FuelPitWarning.module.scss';
import { useBackendComputedStore } from '@entities/cars/computed-context';

/**
 * The header row of chips and its rule, then the fill with a multi-stop
 * plan's stops chip under the buffer beside it — the tallest the block gets — plus
 * `sp(sm)` of padding at each end, at design scale.
 */
const PIT_WARNING_HEIGHT_PX = 103;

export const FuelPitWarning = observer(() => {
  const { fuel } = useBackendComputedStore();

  const { appSettings } = useAppSettingsStore();

  const lapsRemaining = fuel?.lapsRemaining ?? null;

  const isVisible =
    lapsRemaining !== null && lapsRemaining <= appSettings.fuelPitWarningLaps;

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
