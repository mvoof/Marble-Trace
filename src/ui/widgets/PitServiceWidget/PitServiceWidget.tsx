import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@ui/shared/WidgetPanel/WidgetPanel';
import { FuelOrder } from './FuelOrder/FuelOrder';
import { OrderHint } from './OrderHint/OrderHint';
import { RepairRow } from './RepairRow/RepairRow';
import { TowRow } from './TowRow/TowRow';
import { TireGrid } from './TireGrid/TireGrid';
import { OrderChips } from './OrderChips/OrderChips';
import { ServiceFooter } from './ServiceFooter/ServiceFooter';

import styles from './PitServiceWidget.module.scss';
import type { PitServiceWidgetSettings } from '@/types/widget-settings';
import { usePitServiceWidgetStore } from '@store/root-store-context';

export const PitServiceWidget = observer(() => {
  const pitService = usePitServiceWidgetStore();

  const { showFuel, showTires, showRepairs, showFooter } =
    useWidgetSettings<PitServiceWidgetSettings>('pit-service');

  // One slot, two tenants. Under tow there is nothing to wait on but the
  // arrival; standing in the box the repair countdowns are the numbers being
  // watched. Both rows are the same height, so the panel does not resize as the
  // stop runs. The lane's own numbers — speed and distance — are the Pit Line
  // widget's, and are read while the car is still moving.
  const slot = (() => {
    if (pitService.isTowing) {
      return <TowRow />;
    }

    // Standing in the box, whether or not the crew has started: the repair
    // countdowns run before the first tire comes off.
    if (pitService.isInPitStall || pitService.isServiceActive) {
      return showRepairs ? <RepairRow /> : null;
    }

    return null;
  })();

  // The panel's shipped floor is 200 px — wider than this widget, which is as
  // wide as the digits in its tire grid and no wider.
  return (
    <WidgetPanel direction="column" gap={0} minWidth={0}>
      <div className={styles.stack}>
        <OrderHint />

        {slot}

        {showFuel && <FuelOrder />}

        {showTires && <TireGrid />}

        {showRepairs && <OrderChips />}

        {showFooter && <ServiceFooter />}
      </div>
    </WidgetPanel>
  );
});
