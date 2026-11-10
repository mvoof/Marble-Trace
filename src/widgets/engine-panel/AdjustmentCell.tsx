import { observer } from 'mobx-react-lite';
import { WidgetValue } from '@shared/ui/WidgetValue/WidgetValue';
import { FixedDigits } from '@shared/ui/FixedDigits/FixedDigits';
import { usePlayerStore } from '@entities/player/player-context';
import { useEnginePanelWidgetStore } from '@widgets/engine-panel/engine-panel.store';
import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { EngineCell } from './EngineCell';
import {
  ADJUSTMENT_SPECS,
  formatAdjustment,
  type AdjustmentKey,
  type CellRender,
} from './engine-panel-utils';
import styles from './EnginePanelWidget.module.scss';
import type { EnginePanelWidgetSettings } from './settings-schema';

export interface AdjustmentCellProps {
  cellId: AdjustmentKey;
  render: CellRender;
}

/**
 * One in-car adjustment. Reads its own field, so a car that never publishes it
 * costs nothing but the null check — the parent decides whether the cell exists
 * at all, this decides what it says.
 *
 * Whether the cell is lit is the store's answer, not this component's: the
 * highlight is a trailing window after the last change, which needs a timer,
 * and a timer belongs in a store. It lights in the tone of the cell's system,
 * which the group sets.
 */
export const AdjustmentCell = observer(
  ({ cellId, render }: AdjustmentCellProps) => {
    const { carStatus } = usePlayerStore();
    const enginePanel = useEnginePanelWidgetStore();
    const settings =
      useWidgetSettings<EnginePanelWidgetSettings>('engine-panel');

    const spec = ADJUSTMENT_SPECS[cellId];
    const raw = carStatus?.[spec.field];
    const value = typeof raw === 'number' ? raw : null;
    const unit = 'unit' in spec ? spec.unit : undefined;

    return (
      <EngineCell
        label={spec.label}
        render={render}
        lit={
          settings.highlightChanges !== false &&
          enginePanel.isChanged(spec.field)
        }
      >
        <WidgetValue
          value={
            <FixedDigits
              text={
                value === null ? '--' : formatAdjustment(value, spec.format)
              }
            />
          }
          unit={unit}
          className={`${styles.value} ${value === null ? styles.valueEmpty : ''}`}
        />
      </EngineCell>
    );
  }
);
