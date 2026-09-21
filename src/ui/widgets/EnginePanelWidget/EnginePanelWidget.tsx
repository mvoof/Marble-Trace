import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { WidgetPanel } from '@ui/shared/WidgetPanel/WidgetPanel';
import { WidgetValue } from '@ui/shared/WidgetValue/WidgetValue';
import { FixedDigits } from '@ui/widgets/TimerWidget/FixedDigits/FixedDigits';
import { EngineCell } from './EngineCell';
import { AbsCell } from './AbsCell';
import { AdjustmentCell } from './AdjustmentCell';
import { GroupPlate } from './GroupPlate';
import {
  ADJUSTMENT_SPECS,
  CELL_SLOTS,
  planEnginePanel,
  renderWeights,
  type AdjustmentKey,
  type CellId,
  type CellRenderWeight,
  type CellSlot,
} from './engine-panel-utils';
import { usePlayerStore, useUnitsStore } from '@store/root-store-context';
import type { CarStatusFrame } from '@/types/bindings';
import type { EnginePanelWidgetSettings } from '@/types/widget-settings';
import type { UnitSystem } from '@/types';

import styles from './EnginePanelWidget.module.scss';

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
    weight,
    showOil,
    showWater,
  }: {
    carStatus: CarStatusFrame | null | undefined;
    system: UnitSystem;
    weight: CellRenderWeight;
    showOil: boolean;
    showWater: boolean;
  }) => {
    const oilTemp = carStatus?.oil_temp ?? null;
    const waterTemp = carStatus?.water_temp ?? null;

    const overLimit =
      (showOil && oilTemp !== null && oilTemp >= OIL_TEMP_LIMIT_C) ||
      (showWater && waterTemp !== null && waterTemp >= WATER_TEMP_LIMIT_C);

    const label =
      showOil && showWater ? 'OIL / WATER' : showOil ? 'OIL' : 'WATER';

    const text = [
      showOil ? formatTempInt(oilTemp, system) : null,
      showWater ? formatTempInt(waterTemp, system) : null,
    ]
      .filter((part) => part !== null)
      .join('/');

    return (
      <EngineCell
        label={label}
        weight={weight}
        className={overLimit ? styles.overLimit : ''}
      >
        <WidgetValue
          value={<FixedDigits text={text} />}
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

  // The column setting is a ceiling in width units, not a cell count: the rows
  // break between plates and never through one, so a system's cells are never
  // found in two places.
  const maxCols = settings.horizontal
    ? Math.max(1, settings.horizontalColumns ?? 10)
    : (settings.verticalColumns ?? 3);

  const rows = planEnginePanel(drawn, maxCols);

  // A cell is drawn as the slot it landed in, which the plan knows and the
  // spec does not: the differential's cells are satellites by weight, but with
  // no lead in their plate they are drawn plain, at reading size.
  const weights = renderWeights(rows);

  for (const slot of drawn) {
    const weight = weights.get(slot.id) ?? 'plain';

    if (isAdjustmentId(slot.id)) {
      nodes[slot.id] = (
        <AdjustmentCell cellId={slot.id} group={slot.group} weight={weight} />
      );

      continue;
    }

    if (slot.id === 'abs') {
      nodes.abs = <AbsCell weight={weight} />;

      continue;
    }

    if (slot.id === 'temps') {
      nodes.temps = (
        <TemperaturesCell
          carStatus={carStatus}
          system={system}
          weight={weight}
          showOil={settings.showOilTemp !== false}
          showWater={settings.showWaterTemp !== false}
        />
      );

      continue;
    }

    if (slot.id === 'oilPress') {
      nodes.oilPress = (
        <EngineCell label="OIL P" weight={weight}>
          <WidgetValue
            value={<FixedDigits text={oilPress.value} />}
            unit={oilPress.unit}
            className={styles.value}
          />
        </EngineCell>
      );

      continue;
    }

    nodes.voltage = (
      <EngineCell label="VOLT" weight={weight}>
        <WidgetValue
          value={
            <FixedDigits
              text={voltage === null ? '--.-' : voltage.toFixed(1)}
            />
          }
          unit="V"
          className={styles.value}
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
      {rows.map((row, rowIndex) => (
        <div className={styles.row} key={rowIndex}>
          {row.map((group) => (
            <GroupPlate group={group} nodes={nodes} key={group.group} />
          ))}
        </div>
      ))}
    </WidgetPanel>
  );
});
