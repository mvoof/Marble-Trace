import { observer } from 'mobx-react-lite';
import { Droplets, Thermometer } from 'lucide-react';

import type { SpeedWidgetSettings } from '@/types/widget-settings';
import { formatTemp, tempUnit } from '@utils/formatters/telemetry-format';
import { isEngineTempWarning } from '@utils/widget/speed-utils';

import styles from './EnginePanel.module.scss';
import {
  usePlayerStore,
  useUnitsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

export const EnginePanel = observer(() => {
  const telemetry = usePlayerStore();
  const units = useUnitsStore();
  const widgetSettings = useWidgetSettingsStore();

  const { showTemps } =
    widgetSettings.getSettings<SpeedWidgetSettings>('speed');

  if (!showTemps) {
    return null;
  }

  const carStatus = telemetry.carStatus;
  const system = units.unitSystem;

  const oilTemp = formatTemp(carStatus?.oil_temp ?? null, system);
  const waterTemp = formatTemp(carStatus?.water_temp ?? null, system);

  const oilWarn = isEngineTempWarning(carStatus?.oil_temp);
  const waterWarn = isEngineTempWarning(carStatus?.water_temp);

  const unit = tempUnit(system);

  return (
    <div className={styles.tempsGroup}>
      <span
        className={`${styles.tempBadge} ${oilWarn ? styles.tempBadgeWarn : ''}`}
      >
        <Droplets
          className={`${styles.tempIcon} ${oilWarn ? styles.tempIconWarn : ''}`}
        />
        {oilTemp}
        {unit}
      </span>

      <span
        className={`${styles.tempBadge} ${waterWarn ? styles.tempBadgeWarn : ''}`}
      >
        <Thermometer
          className={`${styles.tempIcon} ${waterWarn ? styles.tempIconWarn : ''}`}
        />
        {waterTemp}
        {unit}
      </span>
    </div>
  );
});
