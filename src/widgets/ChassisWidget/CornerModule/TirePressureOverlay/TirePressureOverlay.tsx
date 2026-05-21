import { observer } from 'mobx-react-lite';

import styles from './TirePressureOverlay.module.scss';

interface TirePressureOverlayProps {
  pressure: number | null;
  unit: string;
  isPunctured: boolean;
}

export const TirePressureOverlay = observer(
  ({ pressure, unit, isPunctured }: TirePressureOverlayProps) => {
    const pressureFormatted = pressure != null ? pressure.toFixed(1) : '---';

    return (
      <div className={styles.pressureOverlay}>
        <span
          className={`${styles.pressureValue} ${isPunctured ? styles.pressureDanger : ''}`}
        >
          {pressureFormatted}
        </span>

        <span className={styles.pressureUnit}>{unit}</span>
      </div>
    );
  }
);
