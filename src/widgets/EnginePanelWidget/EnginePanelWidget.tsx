import { observer } from 'mobx-react-lite';
import { WidgetPanel } from '@/components/shared/WidgetPanel/WidgetPanel';
import { WidgetValue } from '@/components/shared/WidgetValue/WidgetValue';
import { EngineCell } from './EngineCell';
import {
  usePlayerStore,
  useUnitsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import type { EnginePanelWidgetSettings } from '@/types/widget-settings';
import type { UnitSystem } from '@/types';

import styles from './EnginePanelWidget.module.scss';

const isOilTempWarning = (celsius: number | null | undefined): boolean =>
  celsius != null && celsius >= 135;

const isWaterTempWarning = (celsius: number | null | undefined): boolean =>
  celsius != null && celsius >= 120;

const formatPressure = (
  kpa: number | null,
  unitSystem: UnitSystem
): { value: string; unit: string } => {
  if (kpa === null)
    return { value: '--.-', unit: unitSystem === 'metric' ? 'bar' : 'psi' };
  if (unitSystem === 'metric') {
    return { value: (kpa / 100).toFixed(1), unit: 'bar' }; // Changed to 1 decimal place to fit better
  }
  return { value: (kpa * 0.145038).toFixed(0), unit: 'psi' }; // Changed to 0 decimals for psi (e.g. 50 psi)
};

const formatTempInt = (celsius: number | null, system: UnitSystem): string => {
  if (celsius === null) return '--°';
  const converted = system === 'imperial' ? celsius * 1.8 + 32 : celsius;
  return `${Math.round(converted)}°`;
};

export const EnginePanelWidget = observer(() => {
  const playerStore = usePlayerStore();
  const unitsStore = useUnitsStore();
  const widgetSettingsStore = useWidgetSettingsStore();

  const settings =
    widgetSettingsStore.getSettings<EnginePanelWidgetSettings>('engine-panel');
  const carStatus = playerStore.carStatus;
  const carInputs = playerStore.carInputs;
  const system = unitsStore.unitSystem;

  // Temperatures & pressures
  const oilTemp = carStatus?.oil_temp ?? null;
  const waterTemp = carStatus?.water_temp ?? null;
  const oilPress = carStatus?.oil_press ?? null;
  const voltage = carStatus?.voltage ?? null;

  // In-car settings
  const dcAbs = carStatus?.dc_abs ?? null;
  const dcBrakeBias = carStatus?.dc_brake_bias ?? null;
  const dcTc = carStatus?.dc_traction_control ?? null;
  const dcThrottleShape = carStatus?.dc_throttle_shape ?? null;
  const absActive = carInputs?.brake_abs_active ?? false;

  const oilTempWarn = isOilTempWarning(oilTemp);
  const waterTempWarn = isWaterTempWarning(waterTemp);

  const formattedOilTemp = formatTempInt(oilTemp, system);
  const formattedWaterTemp = formatTempInt(waterTemp, system);
  const formattedOilPress = formatPressure(oilPress, system);
  const formattedVoltage = voltage !== null ? voltage.toFixed(1) : '--.-';

  const formattedAbs = dcAbs !== null ? Math.round(dcAbs).toString() : '--';
  const formattedTc = dcTc !== null ? Math.round(dcTc).toString() : '--';
  const formattedBias = dcBrakeBias !== null ? dcBrakeBias.toFixed(1) : '--.-';
  const formattedMap =
    dcThrottleShape !== null ? Math.round(dcThrottleShape).toString() : '--';

  const oilTempCell = settings.showOilTemp && (
    <EngineCell label="OIL" className={oilTempWarn ? styles.dangerFlash : ''}>
      <WidgetValue value={formattedOilTemp} className={styles.value} />
    </EngineCell>
  );

  const oilPressCell = settings.showOilPress && (
    <EngineCell label="OIL P">
      <WidgetValue
        value={formattedOilPress.value}
        unit={formattedOilPress.unit}
        className={styles.value}
      />
    </EngineCell>
  );

  const waterCell = settings.showWaterTemp && (
    <EngineCell
      label="WATER"
      className={waterTempWarn ? styles.dangerFlash : ''}
    >
      <WidgetValue value={formattedWaterTemp} className={styles.value} />
    </EngineCell>
  );

  const voltageCell = settings.showVoltage && (
    <EngineCell label="VOLT">
      <WidgetValue value={formattedVoltage} unit="V" className={styles.value} />
    </EngineCell>
  );

  const absCell = settings.showAbs && (
    <EngineCell label="ABS" className={absActive ? styles.absActive : ''}>
      <WidgetValue
        value={formattedAbs}
        className={`${styles.value} ${styles.yellowValue}`}
      />
    </EngineCell>
  );

  const tcCell = settings.showTc && (
    <EngineCell label="TC">
      <WidgetValue
        value={formattedTc}
        className={`${styles.value} ${styles.blueValue}`}
      />
    </EngineCell>
  );

  const biasCell = settings.showBrakeBias && (
    <EngineCell label="BIAS">
      <WidgetValue value={formattedBias} unit="%" className={styles.value} />
    </EngineCell>
  );

  const mapCell = settings.showEngineMap && (
    <EngineCell label="MAP">
      <WidgetValue value={formattedMap} className={styles.value} />
    </EngineCell>
  );

  const cells = [
    absCell,
    tcCell,
    mapCell,
    biasCell,
    oilTempCell,
    oilPressCell,
    waterCell,
    voltageCell,
  ].filter(Boolean);

  const cols = settings.horizontal
    ? Math.max(1, Math.min(settings.horizontalColumns ?? 8, cells.length))
    : (settings.verticalColumns ?? 2);

  return (
    <WidgetPanel
      direction={settings.horizontal ? 'row' : 'column'}
      gap={4}
      minWidth={0}
      className={styles.root}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridAutoRows: '1fr',
      }}
    >
      {cells}
    </WidgetPanel>
  );
});
