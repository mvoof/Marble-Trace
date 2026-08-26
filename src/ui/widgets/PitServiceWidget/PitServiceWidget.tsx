import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@ui/shared/WidgetPanel/WidgetPanel';
import { PitSpeedPlate } from './PitSpeedPlate/PitSpeedPlate';
import { PitApproachRail } from './PitApproachRail/PitApproachRail';
import { FuelOrder } from './FuelOrder/FuelOrder';
import { OrderHint } from './OrderHint/OrderHint';
import { RepairRow } from './RepairRow/RepairRow';
import { TowRow } from './TowRow/TowRow';
import { TireGrid } from './TireGrid/TireGrid';
import { OrderChips } from './OrderChips/OrderChips';
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

  // One slot, three tenants. Standing in the box the speed is zero and the
  // repair countdowns are the numbers being watched; under tow neither applies
  // and the only thing to wait on is the arrival. All three rows are the same
  // height, so the panel does not resize as the stop runs.
  const slot = (() => {
    if (pitService.isTowing) {
      return <TowRow />;
    }

    // Standing in the box, whether or not the crew has started: the speed is
    // zero from the moment the car stops, and the repair countdowns run before
    // the first tire comes off.
    if (pitService.isInPitStall || pitService.isServiceActive) {
      return showRepairs ? <RepairRow /> : null;
    }

    return showPitSpeed ? <PitSpeedPlate /> : null;
  })();

  return (
    // A side rail turns the panel into a row: the stack keeps its own width and
    // the rail hangs against the edge, which is why the manifest widens
    // designWidth by the rail instead of letting it eat into the columns.
    <WidgetPanel direction={isSideRail ? 'row' : 'column'} gap={0}>
      <div className={styles.stack}>
        {slot}

        {!isSideRail && rail}

        {showFuel && <FuelOrder />}

        <OrderHint />

        {showTires && <TireGrid />}

        {showRepairs && <OrderChips />}

        {showFooter && <ServiceFooter />}
      </div>

      {isSideRail && rail}
    </WidgetPanel>
  );
});
