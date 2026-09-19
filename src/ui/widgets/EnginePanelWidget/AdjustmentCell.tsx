import { observer } from 'mobx-react-lite';
import { WidgetValue } from '@ui/shared/WidgetValue/WidgetValue';
import {
  useEnginePanelWidgetStore,
  usePlayerStore,
} from '@store/root-store-context';
import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import type { EnginePanelWidgetSettings } from '@/types/widget-settings';
import { EngineCell } from './EngineCell';
import {
  formatAdjustment,
  type AdjustmentCellSpec,
  type CellFlashTone,
} from './engine-panel-utils';
import styles from './EnginePanelWidget.module.scss';

export interface AdjustmentCellProps {
  spec: AdjustmentCellSpec;
  dividerRight?: boolean;
  dividerTop?: boolean;
}

const TONE_CLASS: Record<CellFlashTone, string> = {
  neutral: '',
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
  ({ spec, dividerRight = false, dividerTop = false }: AdjustmentCellProps) => {
    const { carStatus } = usePlayerStore();
    const enginePanel = useEnginePanelWidgetStore();
    const settings =
      useWidgetSettings<EnginePanelWidgetSettings>('engine-panel');

    const raw = carStatus?.[spec.field];
    const value = typeof raw === 'number' ? raw : null;

    return (
      <EngineCell
        label={spec.label}
        dividerRight={dividerRight}
        dividerTop={dividerTop}
      >
        {settings.highlightChanges !== false &&
        enginePanel.isChanged(spec.field) ? (
          <div
            className={`${styles.changeFlash} ${TONE_CLASS[spec.flashTone ?? 'neutral']}`}
          />
        ) : null}

        <WidgetValue
          value={value === null ? '--' : formatAdjustment(value, spec.format)}
          unit={spec.unit}
          className={`${styles.value} ${spec.accent ? styles.blueValue : ''}`}
        />
      </EngineCell>
    );
  }
);
