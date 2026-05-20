import { observer } from 'mobx-react-lite';
import { Info } from 'lucide-react';

import { telemetryStore } from '../../../../store/iracing/telemetry.store';
import { unitsStore } from '../../../../store/units.store';
import { widgetSettingsStore } from '../../../../store/widget-settings.store';
import { WidgetPanel } from '../../../shared/primitives/WidgetPanel/WidgetPanel';
import { CornerModule } from '../CornerModule/CornerModule';
import { buildAllCorners, computeAxleDiff } from '../chassis-utils';

import styles from './ChassisLayout.module.scss';

const SUSPENSION_BENT_THRESHOLD_MM = 18;

const CenterLabels = observer(
  ({ showSuspensionAndBrakes }: { showSuspensionAndBrakes: boolean }) => {
    if (!showSuspensionAndBrakes) {
      return null;
    }

    return (
      <div className={styles.centerLabels}>
        <span className={styles.centerLabel}>RH</span>
        <span className={styles.centerLabel}>BRK</span>
        <span className={styles.centerLabel}>SHK</span>
      </div>
    );
  }
);

export const ChassisLayout = observer(() => {
  const { chassis, carStatus } = telemetryStore;
  const { showSuspensionAndBrakes } = widgetSettingsStore.getChassisSettings();
  const { system } = unitsStore;

  const isMetric = system === 'metric';
  const corners = buildAllCorners(chassis, system);
  const onPitRoad = carStatus?.on_pit_road ?? false;

  const tempUnit = isMetric ? '°C' : '°F';
  const lengthUnit = isMetric ? 'mm' : 'in';

  const frontAxleDiff = computeAxleDiff(
    corners.lf.rideHeight,
    corners.rf.rideHeight
  );
  const rearAxleDiff = computeAxleDiff(
    corners.lr.rideHeight,
    corners.rr.rideHeight
  );

  const frontBent =
    frontAxleDiff !== null &&
    Math.abs(frontAxleDiff) > SUSPENSION_BENT_THRESHOLD_MM;

  const rearBent =
    rearAxleDiff !== null &&
    Math.abs(rearAxleDiff) > SUSPENSION_BENT_THRESHOLD_MM;

  return (
    <WidgetPanel direction="column" gap={0}>
      <div
        className={`${styles.carGrid} ${showSuspensionAndBrakes ? styles.carGridSuspensionAndBrakes : ''}`}
      >
        <CornerModule
          data={corners.lf}
          isSuspensionBent={frontBent}
          isRight={false}
          tempUnit={tempUnit}
          lengthUnit={lengthUnit}
          showSuspensionAndBrakes={showSuspensionAndBrakes}
        />

        <CenterLabels showSuspensionAndBrakes={showSuspensionAndBrakes} />

        <CornerModule
          data={corners.rf}
          isSuspensionBent={frontBent}
          isRight={true}
          tempUnit={tempUnit}
          lengthUnit={lengthUnit}
          showSuspensionAndBrakes={showSuspensionAndBrakes}
        />

        <CornerModule
          data={corners.lr}
          isSuspensionBent={rearBent}
          isRight={false}
          tempUnit={tempUnit}
          lengthUnit={lengthUnit}
          showSuspensionAndBrakes={showSuspensionAndBrakes}
        />

        <CenterLabels showSuspensionAndBrakes={showSuspensionAndBrakes} />

        <CornerModule
          data={corners.rr}
          isSuspensionBent={rearBent}
          isRight={true}
          tempUnit={tempUnit}
          lengthUnit={lengthUnit}
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
