import { Info } from 'lucide-react';
import { WidgetPanel } from '../primitives/WidgetPanel/WidgetPanel';
import { CornerModule } from './CornerModule/CornerModule';
import type { ChassisWidgetProps } from './types';
import { computeAxleDiff } from './chassis-utils';
import styles from './ChassisWidget.module.scss';

const SUSPENSION_BENT_THRESHOLD_MM = 18;

const CenterLabels = ({
  showSuspensionAndBrakes,
}: {
  showSuspensionAndBrakes: boolean;
}) => {
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
};

export const ChassisWidget = ({
  lf,
  rf,
  lr,
  rr,
  tempUnit,
  lengthUnit,
  showSuspensionAndBrakes,
  onPitRoad,
}: ChassisWidgetProps) => {
  const frontAxleDiff = computeAxleDiff(lf.rideHeight, rf.rideHeight);
  const rearAxleDiff = computeAxleDiff(lr.rideHeight, rr.rideHeight);

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
          data={lf}
          isSuspensionBent={frontBent}
          isRight={false}
          tempUnit={tempUnit}
          lengthUnit={lengthUnit}
          showSuspensionAndBrakes={showSuspensionAndBrakes}
        />

        <CenterLabels showSuspensionAndBrakes={showSuspensionAndBrakes} />

        <CornerModule
          data={rf}
          isSuspensionBent={frontBent}
          isRight={true}
          tempUnit={tempUnit}
          lengthUnit={lengthUnit}
          showSuspensionAndBrakes={showSuspensionAndBrakes}
        />

        <CornerModule
          data={lr}
          isSuspensionBent={rearBent}
          isRight={false}
          tempUnit={tempUnit}
          lengthUnit={lengthUnit}
          showSuspensionAndBrakes={showSuspensionAndBrakes}
        />

        <CenterLabels showSuspensionAndBrakes={showSuspensionAndBrakes} />

        <CornerModule
          data={rr}
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
};
