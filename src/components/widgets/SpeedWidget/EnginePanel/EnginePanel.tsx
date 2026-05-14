import { observer } from 'mobx-react-lite';
import { Droplet, Thermometer } from 'lucide-react';

import { telemetryStore } from '../../../../store/iracing/telemetry.store';
import { unitsStore } from '../../../../store/units.store';
import { formatTemp, tempUnit } from '../../../../utils/telemetry-format';
import { isEngineTempWarning } from '../speed-utils';

import styles from './EnginePanel.module.scss';

export const EnginePanel = observer(() => {
  const carStatus = telemetryStore.carStatus;
  const system = unitsStore.system;

  const oilTemp = formatTemp(carStatus?.oil_temp ?? null, system);
  const waterTemp = formatTemp(carStatus?.water_temp ?? null, system);

  const oilTempWarn = isEngineTempWarning(carStatus?.oil_temp);
  const waterTempWarn = isEngineTempWarning(carStatus?.water_temp);

  const unit = tempUnit(system);

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

        <span className={styles.tempUnit}>{unit}</span>
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

        <span className={styles.tempUnit}>{unit}</span>
      </div>
    </div>
  );
});
