import { WidgetPanel } from '../primitives/WidgetPanel';
import { CornerModule } from './CornerModule/CornerModule';
import type { ChassisWidgetProps } from './types';
import { computeAxleDiff } from './chassis-utils';
import styles from './ChassisWidget.module.scss';

const SUSPENSION_BENT_THRESHOLD_MM = 18;

export const ChassisWidget = ({
  lf,
  rf,
  lr,
  rr,
  tempUnit,
  lengthUnit,
}: ChassisWidgetProps) => {
  const frontAxleDiff = computeAxleDiff(lf.rideHeight, rf.rideHeight);
  const rearAxleDiff = computeAxleDiff(lr.rideHeight, rr.rideHeight);

  const frontBent = Math.abs(frontAxleDiff) > SUSPENSION_BENT_THRESHOLD_MM;
  const rearBent = Math.abs(rearAxleDiff) > SUSPENSION_BENT_THRESHOLD_MM;

  return (
    <WidgetPanel direction="column" gap={8}>
      <div className={styles.carGrid}>
        <CornerModule
          data={lf}
          isSuspensionBent={frontBent}
          isRight={false}
          tempUnit={tempUnit}
          lengthUnit={lengthUnit}
        />
        <CornerModule
          data={rf}
          isSuspensionBent={frontBent}
          isRight={true}
          tempUnit={tempUnit}
          lengthUnit={lengthUnit}
        />
        <CornerModule
          data={lr}
          isSuspensionBent={rearBent}
          isRight={false}
          tempUnit={tempUnit}
          lengthUnit={lengthUnit}
        />
        <CornerModule
          data={rr}
          isSuspensionBent={rearBent}
          isRight={true}
          tempUnit={tempUnit}
          lengthUnit={lengthUnit}
        />
      </div>

      <div className={styles.axleRow}>
        <span className={styles.axleLabel}>F Δ</span>
        <span
          className={`${styles.axleValue} ${frontBent ? styles.axleDanger : ''}`}
        >
          {frontAxleDiff > 0 ? '+' : ''}
          {frontAxleDiff.toFixed(1)}
          <span className={styles.axleUnit}>{lengthUnit}</span>
        </span>
        <span className={styles.axleDivider} />
        <span className={styles.axleLabel}>R Δ</span>
        <span
          className={`${styles.axleValue} ${rearBent ? styles.axleDanger : ''}`}
        >
          {rearAxleDiff > 0 ? '+' : ''}
          {rearAxleDiff.toFixed(1)}
          <span className={styles.axleUnit}>{lengthUnit}</span>
        </span>
      </div>
    </WidgetPanel>
  );
};
