import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { WidgetPanel } from '@shared/ui/WidgetPanel/WidgetPanel';
import { WidgetValue } from '@shared/ui/WidgetValue/WidgetValue';
import { FixedDigits } from '@shared/ui/FixedDigits/FixedDigits';
import { EngineCell } from './EngineCell';
import { AbsCell } from './AbsCell';
import { AdjustmentCell } from './AdjustmentCell';
import { EngineStrip } from './EngineStrip';
import {
  ADJUSTMENT_SPECS,
  CELL_SLOTS,
  planEnginePanel,
  type AdjustmentKey,
  type CellId,
  type CellSlot,
} from './engine-panel-utils';
import { usePlayerStore } from '@entities/player/player-context';
import { useUnitsStore } from '@entities/app-settings/units-context';
import type { CarStatusFrame } from '@shared/contracts/generated/bindings';
import type { UnitSystem } from '@shared/contracts/domain';

import styles from './EnginePanelWidget.module.scss';
import type { EnginePanelWidgetSettings } from './settings-schema';

const OIL_TEMP_LIMIT_C = 135;
const WATER_TEMP_LIMIT_C = 120;

const isAdjustmentId = (id: CellId): id is AdjustmentKey =>
  id in ADJUSTMENT_SPECS;

const formatPressure = (
  kpa: number | null,
  unitSystem: UnitSystem
): { value: string; unit: string } => {
  if (kpa === null) {
    return { value: '--.-', unit: unitSystem === 'metric' ? 'bar' : 'psi' };
  }

  if (unitSystem === 'metric') {
    return { value: (kpa / 100).toFixed(1), unit: 'bar' };
  }

  return { value: (kpa * 0.145038).toFixed(0), unit: 'psi' };
};

/**
 * Grey with nothing to show, red when the figure reads zero, white otherwise.
 * The figure, not the raw value: with the engine off the sim leaves a trace of
 * oil pressure — 0.0085 kPa — that draws as 0.0 bar and is a dead engine all
 * the same.
 */
const gaugeStateClass = (shown: string | null): string => {
  if (shown === null) {
    return styles.valueEmpty;
  }

  return Number.parseFloat(shown) === 0 ? styles.valueDanger : '';
};

const formatTempInt = (celsius: number | null, system: UnitSystem): string => {
  if (celsius === null) {
    return '--';
  }

  const converted = system === 'imperial' ? celsius * 1.8 + 32 : celsius;

  return `${Math.round(converted)}`;
};

/**
 * The oil and the water in one cell.
 *
 * They are read together and they move slowly, so two plates of their own were
 * two more places the eye had to cross on the way to the value it came for.
 */
const TemperaturesCell = observer(
  ({
    carStatus,
    system,
    showOil,
    showWater,
  }: {
    carStatus: CarStatusFrame | null | undefined;
    system: UnitSystem;
    showOil: boolean;
    showWater: boolean;
  }) => {
    const oilTemp = carStatus?.oil_temp ?? null;
    const waterTemp = carStatus?.water_temp ?? null;

    const label = showOil && showWater ? 'OIL / W' : showOil ? 'OIL' : 'WATER';

    // Each temperature turns red on its own: the one over its line is the one
    // the driver has to act on.
    const temperatureClass = (
      celsius: number | null,
      limit: number
    ): string => {
      if (celsius === null) {
        return styles.valueEmpty;
      }

      return celsius >= limit ? styles.valueDanger : '';
    };

    const parts = [
      showOil
        ? {
            key: 'oil',
            text: formatTempInt(oilTemp, system),
            className: temperatureClass(oilTemp, OIL_TEMP_LIMIT_C),
          }
        : null,
      showWater
        ? {
            key: 'water',
            text: formatTempInt(waterTemp, system),
            className: temperatureClass(waterTemp, WATER_TEMP_LIMIT_C),
          }
        : null,
    ].filter((part) => part !== null);

    return (
      <EngineCell label={label}>
        <WidgetValue
          value={parts.map((part, partIndex) => (
            <span className={part.className} key={part.key}>
              {partIndex > 0 ? '/' : null}
              <FixedDigits text={part.text} />
            </span>
          ))}
          unit="°"
          className={styles.value}
        />
      </EngineCell>
    );
  }
);

export const EnginePanelWidget = observer(() => {
  const playerStore = usePlayerStore();
  const unitsStore = useUnitsStore();

  const settings = useWidgetSettings<EnginePanelWidgetSettings>('engine-panel');
  const carStatus = playerStore.carStatus;
  const system = unitsStore.unitSystem;

  const oilPress = formatPressure(carStatus?.oil_press ?? null, system);
  const voltage = carStatus?.voltage ?? null;
  const voltageText = voltage === null ? null : voltage.toFixed(1);
  const oilPressText = carStatus?.oil_press == null ? null : oilPress.value;

  const nodes: Partial<Record<CellId, ReactNode>> = {};

  // An adjustment the car does not publish reads back as null, and a cell that
  // would permanently say `--` is noise: the panel carries what this car has.
  const isDrawn = (slot: CellSlot): boolean => {
    if (!slot.settingKeys.some((key) => settings[key] !== false)) {
      return false;
    }

    if (isAdjustmentId(slot.id)) {
      return carStatus?.[ADJUSTMENT_SPECS[slot.id].field] != null;
    }

    if (slot.id === 'abs') {
      return carStatus?.dc_abs != null;
    }

    return true;
  };

  const drawn = CELL_SLOTS.filter(isDrawn);

  const strips = planEnginePanel(drawn);

  for (const slot of drawn) {
    const lead = slot.lead === true;

    if (isAdjustmentId(slot.id)) {
      nodes[slot.id] = <AdjustmentCell cellId={slot.id} lead={lead} />;

      continue;
    }

    if (slot.id === 'abs') {
      nodes.abs = <AbsCell />;

      continue;
    }

    if (slot.id === 'temps') {
      nodes.temps = (
        <TemperaturesCell
          carStatus={carStatus}
          system={system}
          showOil={settings.showOilTemp !== false}
          showWater={settings.showWaterTemp !== false}
        />
      );

      continue;
    }

    if (slot.id === 'oilPress') {
      nodes.oilPress = (
        <EngineCell label="OIL P">
          <WidgetValue
            value={<FixedDigits text={oilPress.value} />}
            unit={oilPress.unit}
            className={`${styles.value} ${gaugeStateClass(oilPressText)}`}
          />
        </EngineCell>
      );

      continue;
    }

    nodes.voltage = (
      <EngineCell label="VOLT">
        <WidgetValue
          value={<FixedDigits text={voltageText ?? '--.-'} />}
          unit="V"
          className={`${styles.value} ${gaugeStateClass(voltageText)}`}
        />
      </EngineCell>
    );
  }

  return (
    <WidgetPanel
      direction="column"
      gap={0}
      minWidth={0}
      className={styles.root}
    >
      {strips.map((strip) => (
        <EngineStrip strip={strip} nodes={nodes} key={strip.group} />
      ))}
    </WidgetPanel>
  );
});
