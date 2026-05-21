import { observer } from 'mobx-react-lite';

import type { CornerData } from '@widgets/ChassisWidget/types';
import { SuspensionText } from './SuspensionText';
import { TireWearCell } from './TireWearCell/TireWearCell';
import { TireTempCell } from './TireTempCell/TireTempCell';
import { TirePressureOverlay } from './TirePressureOverlay/TirePressureOverlay';
import styles from './CornerModule.module.scss';

interface CornerModuleProps {
  data: CornerData;
  isSuspensionBent: boolean;
  isRight: boolean;
  tempUnit: string;
  lengthUnit: string;
  showSuspensionAndBrakes: boolean;
}

export const CornerModule = observer(
  ({
    data,
    isSuspensionBent,
    isRight,
    tempUnit,
    lengthUnit,
    showSuspensionAndBrakes,
  }: CornerModuleProps) => {
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
