import type { CornerData } from '../types';
import styles from './CornerModule.module.scss';

interface CornerModuleProps {
  data: CornerData;
  isSuspensionBent: boolean;
  isRight: boolean;
  tempUnit: string;
  lengthUnit: string;
  showInboard: boolean;
}

interface InboardTextProps {
  value: string;
  unit: string;
  color?: string;
  isRight: boolean;
}

const InboardText = ({
  value,
  unit,
  color = '#fff',
  isRight,
}: InboardTextProps) => (
  <div className={styles.inboardRow}>
    {isRight ? (
      <>
        <span className={styles.inboardValue} style={{ color }}>
          {value}
        </span>
        <span className={styles.inboardUnit} style={{ color }}>
          {unit}
        </span>
      </>
    ) : (
      <>
        <span className={styles.inboardValue} style={{ color }}>
          {value}
        </span>
        <span className={styles.inboardUnit} style={{ color }}>
          {unit}
        </span>
      </>
    )}
  </div>
);

export const CornerModule = ({
  data,
  isSuspensionBent,
  isRight,
  tempUnit,
  lengthUnit,
  showInboard,
}: CornerModuleProps) => {
  const { isPunctured, isBrakeOverheated } = data;
  const hasDamage = isSuspensionBent || isBrakeOverheated;

  const brakeColor = data.brakeTempColor;

  const rhFormatted = data.rideHeight.toFixed(lengthUnit === 'mm' ? 1 : 2);
  const shkFormatted = data.shockDefl.toFixed(lengthUnit === 'mm' ? 1 : 2);
  const brkFormatted = Math.round(data.brakeTemp).toString();
  const pressureFormatted = data.pressure.toFixed(1);

  return (
    <div
      className={`${styles.cornerWrapper} ${isRight ? styles.cornerRight : ''}`}
    >
      <div className={styles.tireCore}>
        <div className={styles.wearRow}>
          <span className={styles.wearValue}>
            {Math.round(data.wearL * 100)}
            <span className={styles.wearUnit}>%</span>
          </span>
          <span className={styles.wearValue}>
            {Math.round(data.wearM * 100)}
            <span className={styles.wearUnit}>%</span>
          </span>
          <span className={styles.wearValue}>
            {Math.round(data.wearR * 100)}
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
                height: `${Math.max(5, data.wearL * 100)}%`,
                backgroundColor: data.tempColorL,
              }}
            />
          </div>
          <div className={styles.tireSection}>
            <div
              className={styles.tireFill}
              style={{
                height: `${Math.max(5, data.wearM * 100)}%`,
                backgroundColor: data.tempColorM,
              }}
            />
          </div>
          <div className={styles.tireSection}>
            <div
              className={styles.tireFill}
              style={{
                height: `${Math.max(5, data.wearR * 100)}%`,
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
          <span className={styles.tempValue} style={{ color: data.tempColorL }}>
            {Math.round(data.tempL)}
            <span className={styles.tempUnit}>{tempUnit}</span>
          </span>
          <span className={styles.tempValue} style={{ color: data.tempColorM }}>
            {Math.round(data.tempM)}
            <span className={styles.tempUnit}>{tempUnit}</span>
          </span>
          <span className={styles.tempValue} style={{ color: data.tempColorR }}>
            {Math.round(data.tempR)}
            <span className={styles.tempUnit}>{tempUnit}</span>
          </span>
        </div>
      </div>

      {showInboard && (
        <div
          className={`${styles.inboardModule} ${isRight ? styles.inboardModuleRight : ''} ${hasDamage ? styles.damagePulse : ''}`}
        >
          <div
            className={styles.brakeBar}
            style={{ backgroundColor: brakeColor }}
          />
          <div className={styles.inboardTexts}>
            <InboardText
              value={rhFormatted}
              unit={lengthUnit}
              isRight={isRight}
            />
            <InboardText
              value={brkFormatted}
              unit={tempUnit}
              color={brakeColor}
              isRight={isRight}
            />
            <InboardText
              value={shkFormatted}
              unit={lengthUnit}
              isRight={isRight}
            />
          </div>
        </div>
      )}
    </div>
  );
};
