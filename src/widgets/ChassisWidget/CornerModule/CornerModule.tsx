import { observer } from 'mobx-react-lite';

import type { CornerPosition } from '@widgets/ChassisWidget/types';
import { buildCornerData, computeAxleDiff } from '@utils/widget/chassis-utils';
import { SuspensionText } from './SuspensionText';
import { TireWearCell } from './TireWearCell/TireWearCell';
import { TireTempCell } from './TireTempCell/TireTempCell';
import { TirePressureOverlay } from './TirePressureOverlay/TirePressureOverlay';
import styles from './CornerModule.module.scss';
import {
  useTelemetryStore,
  useUnitsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

const SUSPENSION_BENT_THRESHOLD_M = 0.018;

const AXLE_PAIRS: Record<CornerPosition, [CornerPosition, CornerPosition]> = {
  lf: ['lf', 'rf'],
  rf: ['lf', 'rf'],
  lr: ['lr', 'rr'],
  rr: ['lr', 'rr'],
};

interface CornerModuleProps {
  position: CornerPosition;
  isRight: boolean;
}

export const CornerModule = observer(
  ({ position, isRight }: CornerModuleProps) => {
    const telemetry = useTelemetryStore();
    const units = useUnitsStore();
    const widgetSettings = useWidgetSettingsStore();
    const { showSuspensionAndBrakes } = widgetSettings.getChassisSettings();
    const { chassis } = telemetry;
    const { system } = units;

    const [axleA, axleB] = AXLE_PAIRS[position];
    const axleDiff = computeAxleDiff(
      chassis?.[`${axleA}_ride_height`],
      chassis?.[`${axleB}_ride_height`]
    );
    const isSuspensionBent =
      axleDiff !== null && Math.abs(axleDiff) > SUSPENSION_BENT_THRESHOLD_M;

    const isMetric = system === 'metric';
    const tempUnit = isMetric ? '°C' : '°F';
    const lengthUnit = isMetric ? 'mm' : 'in';

    const data = buildCornerData(position, chassis, system);

    const { isPunctured, isBrakeOverheated } = data;
    const hasDamage = isSuspensionBent || isBrakeOverheated;

    const brakeColor = data.brakeTempColor;

    const rhFormatted =
      data.rideHeight != null
        ? data.rideHeight.toFixed(lengthUnit === 'mm' ? 1 : 2)
        : '---';

    const shkFormatted =
      data.shockDefl != null
        ? data.shockDefl.toFixed(lengthUnit === 'mm' ? 1 : 2)
        : '---';

    const brkFormatted =
      data.brakeTemp != null ? Math.round(data.brakeTemp).toString() : '---';

    const wearL = data.wearL != null ? Math.round(data.wearL * 100) : null;
    const wearM = data.wearM != null ? Math.round(data.wearM * 100) : null;
    const wearR = data.wearR != null ? Math.round(data.wearR * 100) : null;

    return (
      <div
        className={`${styles.cornerWrapper} ${isRight ? styles.cornerRight : ''}`}
      >
        <div className={styles.tireCore}>
          <div className={styles.wearRow}>
            <TireWearCell wear={wearL} />

            <TireWearCell wear={wearM} />

            <TireWearCell wear={wearR} />
          </div>

          <div
            className={`${styles.tireVisual} ${isPunctured ? styles.damagePulse : ''}`}
          >
            <div className={styles.tireSection}>
              <div
                className={styles.tireFill}
                style={{
                  height: `${Math.max(5, (data.wearL ?? 0) * 100)}%`,
                  backgroundColor: data.tempColorL,
                }}
              />
            </div>

            <div className={styles.tireSection}>
              <div
                className={styles.tireFill}
                style={{
                  height: `${Math.max(5, (data.wearM ?? 0) * 100)}%`,
                  backgroundColor: data.tempColorM,
                }}
              />
            </div>

            <div className={styles.tireSection}>
              <div
                className={styles.tireFill}
                style={{
                  height: `${Math.max(5, (data.wearR ?? 0) * 100)}%`,
                  backgroundColor: data.tempColorR,
                }}
              />
            </div>

            <TirePressureOverlay
              pressure={data.pressure}
              unit={data.pressureUnit}
              isPunctured={isPunctured}
            />
          </div>

          <div className={styles.tempRow}>
            <TireTempCell
              value={data.tempL}
              color={data.tempColorL}
              unit={tempUnit}
            />

            <TireTempCell
              value={data.tempM}
              color={data.tempColorM}
              unit={tempUnit}
            />

            <TireTempCell
              value={data.tempR}
              color={data.tempColorR}
              unit={tempUnit}
            />
          </div>
        </div>

        {showSuspensionAndBrakes && (
          <div
            className={`${styles.suspensionAndBrakesPanel} ${isRight ? styles.suspensionAndBrakesPanelRight : ''} ${hasDamage ? styles.damagePulse : ''}`}
          >
            <div
              className={styles.brakeBar}
              style={{ backgroundColor: brakeColor }}
            />

            <div className={styles.suspensionAndBrakesTexts}>
              <SuspensionText value={rhFormatted} unit={lengthUnit} />

              <SuspensionText
                value={brkFormatted}
                unit={tempUnit}
                color={brakeColor}
              />

              <SuspensionText value={shkFormatted} unit={lengthUnit} />
            </div>
          </div>
        )}
      </div>
    );
  }
);
