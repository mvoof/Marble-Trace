import { observer } from 'mobx-react-lite';
import { WidgetValue } from '@ui/shared/WidgetValue/WidgetValue';
import { FixedDigits } from '@ui/widgets/TimerWidget/FixedDigits/FixedDigits';
import {
  useEnginePanelWidgetStore,
  usePlayerStore,
} from '@store/root-store-context';
import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import type { EnginePanelWidgetSettings } from '@/types/widget-settings';
import { EngineCell } from './EngineCell';
import {
  ADJUSTMENT_SPECS,
  formatAdjustment,
  type AdjustmentKey,
  type CellGroup,
  type CellRenderWeight,
} from './engine-panel-utils';
import styles from './EnginePanelWidget.module.scss';

export interface AdjustmentCellProps {
  cellId: AdjustmentKey;
  group: CellGroup;
  weight: CellRenderWeight;
}

const TONE_CLASS: Partial<Record<CellGroup, string>> = {
  brake: styles.changeFlashBrake,
  diff: styles.changeFlashDiff,
};

/**
 * One in-car adjustment. Reads its own field, so a car that never publishes it
 * costs nothing but the null check — the parent decides whether the cell exists
 * at all, this decides what it says.
 *
 * Whether the cell is lit is the store's answer, not this component's: the
 * highlight is a trailing window after the last change, which needs a timer,
 * and a timer belongs in a store.
 */
export const AdjustmentCell = observer(
  ({ cellId, group, weight }: AdjustmentCellProps) => {
    const { carStatus } = usePlayerStore();
    const enginePanel = useEnginePanelWidgetStore();
    const settings =
      useWidgetSettings<EnginePanelWidgetSettings>('engine-panel');

    const spec = ADJUSTMENT_SPECS[cellId];
    const raw = carStatus?.[spec.field];
    const value = typeof raw === 'number' ? raw : null;
    const unit = 'unit' in spec ? spec.unit : undefined;
    const accent = 'accent' in spec && spec.accent;

    return (
      <EngineCell label={spec.label} weight={weight}>
        {settings.highlightChanges !== false &&
        enginePanel.isChanged(spec.field) ? (
          <div className={`${styles.changeFlash} ${TONE_CLASS[group] ?? ''}`} />
        ) : null}

        <WidgetValue
          value={
            <FixedDigits
              text={
                value === null ? '--' : formatAdjustment(value, spec.format)
              }
            />
          }
          unit={unit}
          className={`${styles.value} ${accent ? styles.blueValue : ''}`}
        />
      </EngineCell>
    );
  }
);
