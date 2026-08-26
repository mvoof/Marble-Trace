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
    // The docked rail hangs *outside* the panel, on the edge the driver picked:
    // it is a glance target, not a column of the widget, and neither switching
    // it on nor moving it may resize the box or squeeze a single row inside it.
    // That is what `overflowVisible` in the manifest is for.
    <WidgetPanel
      direction="column"
      gap={0}
      className={isSideRail ? styles.panelWithRail : undefined}
    >
      <div className={styles.stack}>
        <OrderHint />

        {slot}

        {!isSideRail && rail}

        {showFuel && <FuelOrder />}

        {showTires && <TireGrid />}

        {showRepairs && <OrderChips />}

        {showFooter && <ServiceFooter />}
      </div>

      {/*
        A child of the panel, not of the stack: the stack is the growing half of
        the flexbox and can run past the plate when the content is taller than
        the box, and a rail anchored to it would hang below the widget instead
        of standing alongside it.
      */}
      {isSideRail && rail}
    </WidgetPanel>
  );
});
