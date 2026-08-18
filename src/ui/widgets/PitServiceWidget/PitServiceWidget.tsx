import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@ui/shared/WidgetPanel/WidgetPanel';
import { ServiceHeader } from './ServiceHeader/ServiceHeader';
import { PitSpeedPlate } from './PitSpeedPlate/PitSpeedPlate';
import { PitApproachRail } from './PitApproachRail/PitApproachRail';
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
import { useWidgetAutoHide } from '@ui/hooks/useWidgetAutoHide';

export const PitServiceWidget = observer(() => {
  const widgetSettings = useWidgetSettingsStore();
  const pitService = usePitServiceWidgetStore();

  const {
    showPitSpeed,
    showPitApproach,
    pitApproachPlacement,
    pitApproachSide,
    pitApproachCueDistM,
    showPitBrakeCue,
    showFuel,
    showTires,
    showRepairs,
    showFooter,
    alwaysVisible,
  } = widgetSettings.getSettings<PitServiceWidgetSettings>('pit-service');

  // Hiding through the auto-hide store rather than returning null: the
  // container paints the background, so a null child would leave an empty
  // dark plate on track.
  useWidgetAutoHide(alwaysVisible || pitService.panel.isVisible);

  const rail = showPitApproach ? (
    <PitApproachRail
      placement={pitApproachPlacement}
      side={pitApproachSide}
      cueDistM={pitApproachCueDistM}
      withBrakeCue={showPitBrakeCue}
    />
  ) : null;

  const isSideRail = pitApproachPlacement === 'side';

  return (
    // A side rail turns the panel into a row: the stack keeps its own width and
    // the rail hangs against the edge, which is why the manifest widens
    // designWidth by the rail instead of letting it eat into the columns.
    <WidgetPanel direction={isSideRail ? 'row' : 'column'} gap={0}>
      <div className={styles.stack}>
        <ServiceHeader />

        {/*
          Being towed replaces the speed block — the car is not moving, and the
          countdown is the only number that matters up there. Everything below
          stays: the service order can still be changed while under tow, and it
          is applied the moment the car is dropped in the box.
        */}
        {pitService.isTowing ? <TowRow /> : showPitSpeed && <PitSpeedPlate />}

        {!isSideRail && rail}

        {showFuel && <FuelOrder />}

        <OrderHint />

        {showRepairs && <RepairRow />}

        {showTires && <TireGrid />}

        {showFooter && <ServiceFooter />}
      </div>

      {isSideRail && rail}
    </WidgetPanel>
  );
});
