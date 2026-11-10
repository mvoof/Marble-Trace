import { observer } from 'mobx-react-lite';
import { WidgetValue } from '@shared/ui/WidgetValue/WidgetValue';
import { FixedDigits } from '@shared/ui/FixedDigits/FixedDigits';
import { usePlayerStore } from '@entities/player/player-context';
import { useEnginePanelWidgetStore } from '@widgets/engine-panel/engine-panel.store';
import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import type { StatChipTone } from '@shared/ui/StatChip/StatChip';
import { EngineCell } from './EngineCell';
import { AdjustmentChip } from './AdjustmentChip';
import {
  ADJUSTMENT_SPECS,
  formatAdjustment,
  type AdjustmentKey,
} from './engine-panel-utils';
import styles from './EnginePanelWidget.module.scss';
import type { EnginePanelWidgetSettings } from './settings-schema';

// Traction control keeps the blue it has in every in-car box; the rest are
// plain readings.
const CHIP_TONE: Partial<Record<AdjustmentKey, StatChipTone>> = {
  showTc: 'info',
  showTc2: 'info',
};

export interface AdjustmentCellProps {
  cellId: AdjustmentKey;
  lead: boolean;
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
  ({ cellId, lead }: AdjustmentCellProps) => {
    const { carStatus } = usePlayerStore();
    const enginePanel = useEnginePanelWidgetStore();
    const settings =
      useWidgetSettings<EnginePanelWidgetSettings>('engine-panel');

    const spec = ADJUSTMENT_SPECS[cellId];
    const raw = carStatus?.[spec.field];
    const value = typeof raw === 'number' ? raw : null;
    const unit = 'unit' in spec ? spec.unit : undefined;
    const text = value === null ? '--' : formatAdjustment(value, spec.format);

    return (
      <EngineCell
        label={spec.label}
        lead={lead}
        lit={
          settings.highlightChanges !== false &&
          enginePanel.isChanged(spec.field)
        }
      >
        {lead ? (
          <WidgetValue
            value={<FixedDigits text={text} />}
            unit={unit}
            className={`${styles.value} ${value === null ? styles.valueEmpty : ''}`}
          />
        ) : (
          <AdjustmentChip text={text} tone={CHIP_TONE[cellId]} />
        )}
      </EngineCell>
    );
  }
);
