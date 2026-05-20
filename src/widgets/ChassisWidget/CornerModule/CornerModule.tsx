import { observer } from 'mobx-react-lite';

import type { CornerData } from '@widgets/ChassisWidget/types';
import { SuspensionText } from './SuspensionText';
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

    const pressureFormatted =
      data.pressure != null ? data.pressure.toFixed(1) : '---';

    const wearL = data.wearL != null ? Math.round(data.wearL * 100) : null;
    const wearM = data.wearM != null ? Math.round(data.wearM * 100) : null;
    const wearR = data.wearR != null ? Math.round(data.wearR * 100) : null;

    return (
      <div
        className={`${styles.cornerWrapper} ${isRight ? styles.cornerRight : ''}`}
      >
        <div className={styles.tireCore}>
          <div className={styles.wearRow}>
            <span className={styles.wearValue}>
              {wearL ?? '--'}
              <span className={styles.wearUnit}>%</span>
            </span>
            <span className={styles.wearValue}>
              {wearM ?? '--'}
              <span className={styles.wearUnit}>%</span>
            </span>
            <span className={styles.wearValue}>
              {wearR ?? '--'}
              <span className={styles.wearUnit}>%</span>
            </span>
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
            <div className={styles.pressureOverlay}>
              <span
                className={`${styles.pressureValue} ${isPunctured ? styles.pressureDanger : ''}`}
              >
                {pressureFormatted}
              </span>
              <span className={styles.pressureUnit}>{data.pressureUnit}</span>
            </div>
          </div>

          <div className={styles.tempRow}>
            <span
              className={styles.tempValue}
              style={{ color: data.tempColorL }}
            >
              {data.tempL != null ? Math.round(data.tempL) : '--'}
              <span className={styles.tempUnit}>{tempUnit}</span>
            </span>
            <span
              className={styles.tempValue}
              style={{ color: data.tempColorM }}
            >
              {data.tempM != null ? Math.round(data.tempM) : '--'}
              <span className={styles.tempUnit}>{tempUnit}</span>
            </span>
            <span
              className={styles.tempValue}
              style={{ color: data.tempColorR }}
            >
              {data.tempR != null ? Math.round(data.tempR) : '--'}
              <span className={styles.tempUnit}>{tempUnit}</span>
            </span>
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
