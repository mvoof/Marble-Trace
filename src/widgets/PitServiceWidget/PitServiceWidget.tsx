import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@/components/shared/WidgetPanel/WidgetPanel';
import { ServiceHeader } from './ServiceHeader/ServiceHeader';
import { PitSpeedPlate } from './PitSpeedPlate/PitSpeedPlate';
import { FuelOrder } from './FuelOrder/FuelOrder';
import { OrderHint } from './OrderHint/OrderHint';
import { RepairRow } from './RepairRow/RepairRow';
import { TowRow } from './TowRow/TowRow';
import { TireGrid } from './TireGrid/TireGrid';
import { ServiceFooter } from './ServiceFooter/ServiceFooter';

import styles from './PitServiceWidget.module.scss';
import type { PitServiceWidgetSettings } from '@/types/widget-settings';
import {
  usePitServiceWidgetStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import { useWidgetAutoHide } from '@/hooks/common/useWidgetAutoHide';

export const PitServiceWidget = observer(() => {
  const widgetSettings = useWidgetSettingsStore();
  const pitService = usePitServiceWidgetStore();

  const {
    showPitSpeed,
    showFuel,
    showTires,
    showRepairs,
    showFooter,
    alwaysVisible,
  } = widgetSettings.getSettings<PitServiceWidgetSettings>('pit-service');

  // Hiding through the auto-hide store rather than returning null: the
  // container paints the background, so a null child would leave an empty
  // dark plate on track.
  useWidgetAutoHide(alwaysVisible || pitService.isVisible);

  return (
    <WidgetPanel direction="column" gap={0}>
      <div className={styles.stack}>
        <ServiceHeader />

        {/*
          Being towed replaces the speed block — the car is not moving, and the
          countdown is the only number that matters up there. Everything below
          stays: the service order can still be changed while under tow, and it
          is applied the moment the car is dropped in the box.
        */}
        {pitService.isTowing ? <TowRow /> : showPitSpeed && <PitSpeedPlate />}

        {showFuel && <FuelOrder />}

        <OrderHint />

        {showRepairs && <RepairRow />}

        {showTires && <TireGrid />}

        {showFooter && <ServiceFooter />}
      </div>
    </WidgetPanel>
  );
});
