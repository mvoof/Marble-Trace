import { observer } from 'mobx-react-lite';
import { WidgetValue } from '@ui/shared/WidgetValue/WidgetValue';
import { FixedDigits } from '@ui/shared/FixedDigits/FixedDigits';
import { EngineCell } from './EngineCell';
import {
  useEnginePanelWidgetStore,
  usePlayerStore,
} from '@store/root-store-context';
import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import type { EnginePanelWidgetSettings } from '@/types/widget-settings';
import type { CellRenderWeight } from './engine-panel-utils';
import styles from './EnginePanelWidget.module.scss';

export interface AbsCellProps {
  weight: CellRenderWeight;
}

// Separate from the root on purpose: the ABS light lives in the 60 Hz carInputs
// frame, and reading it in EnginePanelWidget would re-render every cell at
// physics rate. It is read through `isAbsActive`, which is the light itself
// rather than the frame carrying it, so a burst of inputs wakes nothing here.
export const AbsCell = observer(({ weight }: AbsCellProps) => {
  const { carStatus, isAbsActive } = usePlayerStore();
  const enginePanel = useEnginePanelWidgetStore();
  const settings = useWidgetSettings<EnginePanelWidgetSettings>('engine-panel');

  const dcAbs = carStatus?.dc_abs ?? null;

  const formattedAbs = dcAbs !== null ? Math.round(dcAbs).toString() : '--';

  return (
    <EngineCell
      label="ABS"
      weight={weight}
      className={isAbsActive ? styles.absActive : ''}
    >
      {settings.highlightChanges !== false &&
      enginePanel.isChanged('dc_abs') ? (
        <div className={styles.changeFlash} />
      ) : null}

      <WidgetValue
        value={<FixedDigits text={formattedAbs} />}
        className={`${styles.value} ${styles.yellowValue}`}
      />
    </EngineCell>
  );
});
