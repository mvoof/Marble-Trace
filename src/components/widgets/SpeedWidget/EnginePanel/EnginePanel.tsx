import { observer } from 'mobx-react-lite';
import { Droplet, Thermometer } from 'lucide-react';
import { telemetryStore } from '../../../../store/iracing/telemetry.store';
import { isEngineTempWarning } from '../speed-utils';
import styles from './EnginePanel.module.scss';

interface EnginePanelProps {
  formatTemp: (v: number | null) => string;
  tempUnit: string;
}

export const EnginePanel = observer(
  ({ formatTemp, tempUnit }: EnginePanelProps) => {
    const carStatus = telemetryStore.carStatus;
    const oilTemp = formatTemp(carStatus?.oil_temp ?? null);
    const waterTemp = formatTemp(carStatus?.water_temp ?? null);
    const oilTempWarn = isEngineTempWarning(carStatus?.oil_temp);
    const waterTempWarn = isEngineTempWarning(carStatus?.water_temp);

    return (
      <div className={styles.tempsGroup}>
        <div className={styles.tempRow}>
          <Droplet
            className={`${styles.tempIcon} ${oilTempWarn ? styles.tempIconWarn : ''}`}
          />

          <span
            className={`${styles.tempValue} ${oilTempWarn ? styles.tempValueWarn : ''}`}
          >
            {oilTemp}
          </span>

          <span className={styles.tempUnit}>{tempUnit}</span>
        </div>

        <div className={styles.tempRow}>
          <Thermometer
            className={`${styles.tempIcon} ${waterTempWarn ? styles.tempIconWarn : ''}`}
          />

          <span
            className={`${styles.tempValue} ${waterTempWarn ? styles.tempValueWarn : ''}`}
          >
            {waterTemp}
          </span>

          <span className={styles.tempUnit}>{tempUnit}</span>
        </div>
      </div>
    );
  }
);
