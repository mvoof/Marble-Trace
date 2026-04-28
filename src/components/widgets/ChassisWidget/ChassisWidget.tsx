import { forwardRef } from 'react';
import { Info } from 'lucide-react';
import { WidgetPanel } from '../primitives/WidgetPanel';
import { CornerModule } from './CornerModule/CornerModule';
import type { ChassisWidgetProps } from './types';
import { computeAxleDiff } from './chassis-utils';
import styles from './ChassisWidget.module.scss';

const SUSPENSION_BENT_THRESHOLD_MM = 18;

export const ChassisWidget = forwardRef<HTMLElement, ChassisWidgetProps>(
  ({ lf, rf, lr, rr, tempUnit, lengthUnit, showInboard, onPitRoad }, ref) => {
    const frontAxleDiff = computeAxleDiff(lf.rideHeight, rf.rideHeight);
    const rearAxleDiff = computeAxleDiff(lr.rideHeight, rr.rideHeight);

    const frontBent = Math.abs(frontAxleDiff) > SUSPENSION_BENT_THRESHOLD_MM;
    const rearBent = Math.abs(rearAxleDiff) > SUSPENSION_BENT_THRESHOLD_MM;

    const renderCenterLabels = () => {
      if (!showInboard) return null;
      return (
        <div className={styles.centerLabels}>
          <span className={styles.centerLabel}>RH</span>
          <span className={styles.centerLabel}>BRK</span>
          <span className={styles.centerLabel}>SHK</span>
        </div>
      );
    };

    return (
      <WidgetPanel ref={ref} direction="column" gap={0} fitContent>
        <div
          className={`${styles.carGrid} ${showInboard ? styles.carGridWithInboard : ''}`}
        >
          <CornerModule
            data={lf}
            isSuspensionBent={frontBent}
            isRight={false}
            tempUnit={tempUnit}
            lengthUnit={lengthUnit}
            showInboard={showInboard}
          />
          {renderCenterLabels()}
          <CornerModule
            data={rf}
            isSuspensionBent={frontBent}
            isRight={true}
            tempUnit={tempUnit}
            lengthUnit={lengthUnit}
            showInboard={showInboard}
          />
          <CornerModule
            data={lr}
            isSuspensionBent={rearBent}
            isRight={false}
            tempUnit={tempUnit}
            lengthUnit={lengthUnit}
            showInboard={showInboard}
          />
          {renderCenterLabels()}
          <CornerModule
            data={rr}
            isSuspensionBent={rearBent}
            isRight={true}
            tempUnit={tempUnit}
            lengthUnit={lengthUnit}
            showInboard={showInboard}
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
  }
);

ChassisWidget.displayName = 'ChassisWidget';
