import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { cloneElement, type ReactElement } from 'react';
import { observer } from 'mobx-react-lite';
import { WidgetPanel } from '@ui/shared/WidgetPanel/WidgetPanel';
import { WidgetValue } from '@ui/shared/WidgetValue/WidgetValue';
import { EngineCell, type EngineCellProps } from './EngineCell';
import { AbsCell } from './AbsCell';
import { AdjustmentCell } from './AdjustmentCell';
import { ADJUSTMENT_CELLS, balanceCellRows } from './engine-panel-utils';
import { usePlayerStore, useUnitsStore } from '@store/root-store-context';
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

  const settings = useWidgetSettings<EnginePanelWidgetSettings>('engine-panel');
  const carStatus = playerStore.carStatus;
  const system = unitsStore.unitSystem;

  // Temperatures & pressures
  const oilTemp = carStatus?.oil_temp ?? null;
  const waterTemp = carStatus?.water_temp ?? null;
  const oilPress = carStatus?.oil_press ?? null;
  const voltage = carStatus?.voltage ?? null;

  const oilTempWarn = isOilTempWarning(oilTemp);
  const waterTempWarn = isWaterTempWarning(waterTemp);

  const formattedOilTemp = formatTempInt(oilTemp, system);
  const formattedWaterTemp = formatTempInt(waterTemp, system);
  const formattedOilPress = formatPressure(oilPress, system);
  const formattedVoltage = voltage !== null ? voltage.toFixed(1) : '--.-';

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

  // An adjustment the car does not publish reads back as null, and a cell that
  // would permanently say `--` is noise: the panel carries what this car has.
  const absCell = settings.showAbs && carStatus?.dc_abs != null && <AbsCell />;

  const adjustmentCells = ADJUSTMENT_CELLS.filter(
    (spec) =>
      settings[spec.settingKey] !== false && carStatus?.[spec.field] != null
  ).map((spec) => <AdjustmentCell key={spec.settingKey} spec={spec} />);

  const cells = [
    absCell,
    ...adjustmentCells,
    oilTempCell,
    oilPressCell,
    waterCell,
    voltageCell,
  ].filter(Boolean) as ReactElement<EngineCellProps>[];

  // In the horizontal modes the column setting is a ceiling, not a count: the
  // rows are balanced under it so the last one is never a stub, and every row
  // stretches to the full width whatever it holds.
  const maxCols = settings.horizontal
    ? Math.max(1, settings.horizontalColumns ?? 8)
    : (settings.verticalColumns ?? 2);

  const rowLengths = balanceCellRows(cells.length, maxCols);

  let taken = 0;
  const rows = rowLengths.map((length) => {
    const row = cells.slice(taken, taken + length);
    taken += length;

    return row;
  });

  return (
    <WidgetPanel
      direction="column"
      gap={0}
      minWidth={0}
      className={styles.root}
    >
      {rows.map((row, rowIndex) => (
        <div className={styles.row} key={rowIndex}>
          {row.map((cell, cellIndex) =>
            cloneElement(cell, {
              key: cellIndex,
              dividerRight: cellIndex < row.length - 1,
              dividerTop: rowIndex > 0,
            })
          )}
        </div>
      ))}
    </WidgetPanel>
  );
});
