import { observer } from 'mobx-react-lite';
import { Info } from 'lucide-react';

import { telemetryStore } from '@store/iracing/telemetry.store';
import { widgetSettingsStore } from '@store/widget-settings.store';
import { WidgetPanel } from '@/components/shared/primitives/WidgetPanel/WidgetPanel';
import { CornerModule } from '@widgets/ChassisWidget/CornerModule/CornerModule';
import { CenterLabels } from './CenterLabels/CenterLabels';

import styles from './ChassisWidget.module.scss';

export const ChassisWidget = observer(() => {
  const { carStatus } = telemetryStore;
  const { showSuspensionAndBrakes } = widgetSettingsStore.getChassisSettings();

  const onPitRoad = carStatus?.on_pit_road ?? false;

  return (
    <WidgetPanel direction="column" gap={0}>
      <div
        className={`${styles.carGrid} ${showSuspensionAndBrakes ? styles.carGridSuspensionAndBrakes : ''}`}
      >
        <CornerModule
          position="lf"
          isRight={false}
          showSuspensionAndBrakes={showSuspensionAndBrakes}
        />

        <CenterLabels showSuspensionAndBrakes={showSuspensionAndBrakes} />

        <CornerModule
          position="rf"
          isRight={true}
          showSuspensionAndBrakes={showSuspensionAndBrakes}
        />

        <CornerModule
          position="lr"
          isRight={false}
          showSuspensionAndBrakes={showSuspensionAndBrakes}
        />

        <CenterLabels showSuspensionAndBrakes={showSuspensionAndBrakes} />

        <CornerModule
          position="rr"
          isRight={true}
          showSuspensionAndBrakes={showSuspensionAndBrakes}
        />
      </div>

      {!onPitRoad && (
        <div className={styles.staleNotice}>
          <Info size={12} className={styles.staleIcon} />

          <span>Tire data updates only in pits</span>
        </div>
      )}
    </WidgetPanel>
  );
});
